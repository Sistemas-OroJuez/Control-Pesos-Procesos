'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]); 
  const [balanceData, setBalanceData] = useState<any[]>([]); 
  const [modoVista, setModoVista] = useState<'AUDITORIA' | 'GERENCIAL'>('AUDITORIA');
  
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [filtroVariedad, setFiltroVariedad] = useState('TODOS');
  const [filtroOperacion, setFiltroOperacion] = useState('TODOS');

  const CLAVE_MAESTRA = "orj2026";

  useEffect(() => {
    if (modoVista === 'AUDITORIA') fetchAuditoria();
    else fetchBalanceGerencial();
  }, [fechaInicio, fechaFin, modoVista, filtroVariedad, filtroOperacion]);

  const fetchAuditoria = async () => {
    setLoading(true);
    // Usamos created_at tal como en tu archivo funcional
    const { data: todos, error } = await supabase
      .from('operaciones_refineria')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && todos) {
      const procesados = todos.map((reg, index) => {
        // Lógica exacta de tu archivo: buscar el anterior por tipo_operacion
        const anterior = todos.slice(0, index).reverse().find(r => r.tipo_operacion === reg.tipo_operacion);
        const lecturaActual = parseFloat(reg.valor_lectura) || 0;
        const lecturaAnterior = anterior ? parseFloat(anterior.valor_lectura) : lecturaActual;
        
        // Cálculo de KG según tu archivo funcional
        const kg = (reg.tipo_operacion === 'ENTRADA_ACP' || reg.tipo_operacion === 'SALIDA_RBD') 
          ? (lecturaActual - lecturaAnterior) 
          : lecturaActual;

        return { ...reg, lecturaAnterior, kgResultantes: kg };
      });
      
      // Filtrado por fecha usando created_at
      setRegistros(procesados.filter(r => {
        const f = r.created_at.split('T')[0];
        const cumpleFecha = f >= fechaInicio && f <= fechaFin;
        const cumpleVariedad = filtroVariedad === 'TODOS' || r.variedad === filtroVariedad;
        const cumpleOperacion = filtroOperacion === 'TODOS' || r.tipo_operacion === filtroOperacion;
        return cumpleFecha && cumpleVariedad && cumpleOperacion;
      }).reverse()); 
    }
    setLoading(false);
  };

  const fetchBalanceGerencial = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reporte_balance_masa') // Nombre de tabla según tu archivo
      .select('*')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: false });
    setBalanceData(data || []);
    setLoading(false);
  };

  const renderTablaAuditoria = () => {
    // Agrupamos por tipo_operacion (campo correcto)
    const opGrupos = Array.from(new Set(registros.map(r => r.tipo_operacion)));

    return opGrupos.map(opName => {
      const registrosOp = registros.filter(r => r.tipo_operacion === opName);
      const variedadesOp = Array.from(new Set(registrosOp.map(r => r.variedad)));

      return (
        <div key={opName} className="mb-10 bg-zinc-900 rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
          <div className="p-6 bg-white/5 flex justify-between items-center border-b border-white/10">
            <h2 className="text-2xl font-black text-white uppercase italic">{opName}</h2>
          </div>

          {variedadesOp.map(varName => {
            const items = registrosOp.filter(r => r.variedad === varName);
            const subtotalDif = items.reduce((acc, curr) => acc + (curr.kgResultantes || 0), 0);

            return (
              <div key={varName} className="border-b border-white/5 last:border-0">
                <div className="px-6 py-3 bg-white/5">
                  <span className="text-blue-400 font-black text-[10px] uppercase tracking-widest">Variedad: {varName}</span>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] text-zinc-500 uppercase font-bold border-b border-white/5">
                      <th className="p-4">Fecha / Hora</th>
                      <th className="p-4 text-right">Lectura Anterior</th>
                      <th className="p-4 text-right text-white">Lectura Actual</th>
                      <th className="p-4 text-right">Resultado KG</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300 text-[11px]">
                    {items.map(r => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="p-4 text-right">{r.lecturaAnterior?.toLocaleString()}</td>
                        <td className="p-4 text-right font-bold text-white">{parseFloat(r.valor_lectura).toLocaleString()}</td>
                        <td className="p-4 text-right font-black text-blue-400">{r.kgResultantes?.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-black/40">
                      <td colSpan={3} className="p-6 text-xs font-black text-zinc-400 uppercase">SUBTOTAL {varName}</td>
                      <td className="p-6 text-right text-3xl font-black text-emerald-400 tabular-nums">
                        {subtotalDif.toLocaleString()} <span className="text-xs">KG</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-black p-4 md:p-8 font-sans text-white uppercase text-[10px]">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-zinc-900 p-8 rounded-[40px] border border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <h1 className="text-3xl font-black italic tracking-tighter">Auditoría Refinería</h1>
          <div className="flex bg-black p-1.5 rounded-2xl border border-white/10">
            <button onClick={() => setModoVista('AUDITORIA')} className={`px-6 py-2 rounded-xl font-black ${modoVista === 'AUDITORIA' ? 'bg-white text-black' : 'text-zinc-500'}`}>AUDITORÍA</button>
            <button onClick={() => setModoVista('GERENCIAL')} className={`px-6 py-2 rounded-xl font-black ${modoVista === 'GERENCIAL' ? 'bg-white text-black' : 'text-zinc-500'}`}>GERENCIAL</button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <input type="date" className="bg-black border border-white/10 p-3 rounded-xl" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          <input type="date" className="bg-black border border-white/10 p-3 rounded-xl" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          <select className="bg-black border border-white/10 p-3 rounded-xl" value={filtroOperacion} onChange={e => setFiltroOperacion(e.target.value)}>
            <option value="TODOS">TODAS LAS OPERACIONES</option>
            <option value="ENTRADA_ACP">ENTRADA_ACP</option>
            <option value="SALIDA_RBD">SALIDA_RBD</option>
            <option value="ACIDO_GRASO">ACIDO_GRASO</option>
          </select>
          <select className="bg-black border border-white/10 p-3 rounded-xl" value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)}>
            <option value="TODOS">TODAS LAS VARIEDADES</option>
            <option value="ALTO OLEICO">ALTO OLEICO</option>
            <option value="GUINENSIS">GUINENSIS</option>
          </select>
        </div>

        {loading ? (
          <div className="p-20 text-center animate-pulse text-zinc-600 font-black">CARGANDO...</div>
        ) : (
          modoVista === 'AUDITORIA' ? renderTablaAuditoria() : <div className="text-center text-zinc-500">Vista Gerencial en desarrollo...</div>
        )}
      </div>
    </div>
  );
}