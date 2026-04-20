'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]); 
  const [modoVista, setModoVista] = useState<'AUDITORIA' | 'GERENCIAL'>('AUDITORIA');
  
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [filtroVariedad, setFiltroVariedad] = useState('TODOS');
  const [filtroOperacion, setFiltroOperacion] = useState('TODOS');

  useEffect(() => {
    if (modoVista === 'AUDITORIA') fetchAuditoria();
  }, [fechaInicio, fechaFin, modoVista, filtroVariedad, filtroOperacion]);

  const fetchAuditoria = async () => {
    setLoading(true);
    const { data: todos, error } = await supabase
      .from('operaciones_refineria')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && todos) {
      const procesados = todos.map((reg, index) => {
        const anterior = todos.slice(0, index).reverse().find(r => r.tipo_operacion === reg.tipo_operacion);
        const lecturaActual = parseFloat(reg.valor_lectura) || 0;
        const lecturaAnterior = anterior ? parseFloat(anterior.valor_lectura) : lecturaActual;
        
        // Lógica de cálculo incluyendo SALIDA_RBD
        const kg = (reg.tipo_operacion === 'ENTRADA_ACP' || reg.tipo_operacion === 'SALIDA_RBD') 
          ? (lecturaActual - lecturaAnterior) 
          : lecturaActual;

        return { ...reg, lecturaAnterior, kgResultantes: kg };
      });
      
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

  const enviarWhatsAppSinNumero = () => {
    if (registros.length === 0) return alert("No hay datos para enviar");

    let mensaje = `*REPORTE AUDITORIA REFINERIA*\n`;
    mensaje += `*Periodo:* ${fechaInicio} a ${fechaFin}\n\n`;
    
    registros.forEach(r => {
      mensaje += `🔹 *${r.tipo_operacion}* | ${r.variedad}\n`;
      mensaje += `L. Act: ${parseFloat(r.valor_lectura).toLocaleString()} - L. Ant: ${r.lecturaAnterior.toLocaleString()}\n`;
      mensaje += `*DIF: ${r.kgResultantes.toLocaleString()} KG*\n`;
      mensaje += `----------------------------\n`;
    });

    // Al no incluir número después de /send, WhatsApp abre el selector de contactos
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const renderTablaAuditoria = () => {
    const opGrupos = Array.from(new Set(registros.map(r => r.tipo_operacion)));
    return opGrupos.map(opName => {
      const registrosOp = registros.filter(r => r.tipo_operacion === opName);
      const variedadesOp = Array.from(new Set(registrosOp.map(r => r.variedad)));

      return (
        <div key={opName} className="mb-10 bg-zinc-900 rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
          <div className="p-6 bg-white/5 border-b border-white/10 text-2xl font-black italic uppercase">{opName}</div>
          {variedadesOp.map(varName => {
            const items = registrosOp.filter(r => r.variedad === varName);
            const subtotal = items.reduce((acc, curr) => acc + (curr.kgResultantes || 0), 0);
            return (
              <div key={varName} className="border-b border-white/5 last:border-0">
                <div className="px-6 py-3 bg-white/5 text-blue-400 font-black text-[10px] tracking-widest uppercase italic">Variedad: {varName}</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] text-zinc-500 uppercase font-bold border-b border-white/5">
                      <th className="p-4">Fecha / Hora</th>
                      <th className="p-4 text-center">Evidencia</th>
                      <th className="p-4 text-right">Lectura Anterior</th>
                      <th className="p-4 text-right text-white">Lectura Actual</th>
                      <th className="p-4 text-right">Resultado KG</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300 text-[11px]">
                    {items.map(r => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="p-4 text-center">
                          {r.foto_url && (
                            <button onClick={() => window.open(r.foto_url, '_blank')} className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30 text-[9px] font-bold hover:bg-blue-600 hover:text-white">👁️ VER FOTO</button>
                          )}
                        </td>
                        <td className="p-4 text-right">{r.lecturaAnterior?.toLocaleString()}</td>
                        <td className="p-4 text-right font-bold text-white">{parseFloat(r.valor_lectura).toLocaleString()}</td>
                        <td className="p-4 text-right font-black text-blue-400">{r.kgResultantes?.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-black/40 font-black">
                      <td colSpan={4} className="p-6 text-right text-zinc-400 uppercase">SUBTOTAL {varName}</td>
                      <td className="p-6 text-right text-3xl text-emerald-400 tabular-nums">{subtotal.toLocaleString()} KG</td>
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
        
        {/* HEADER Y ACCIONES */}
        <div className="bg-zinc-900 p-8 rounded-[40px] border border-white/10 space-y-6 shadow-2xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <h1 className="text-3xl font-black italic tracking-tighter">Auditoría Refinería</h1>
            <div className="flex flex-wrap gap-3 justify-center">
              <button className="bg-emerald-600 px-6 py-2 rounded-xl font-black hover:bg-emerald-700 transition-all">📊 EXCEL</button>
              <button className="bg-red-600 px-6 py-2 rounded-xl font-black hover:bg-red-700 transition-all">📕 PDF</button>
              {/* Botón de WhatsApp directo al selector de contactos */}
              <button 
                onClick={enviarWhatsAppSinNumero} 
                className="bg-green-500 text-black px-6 py-2 rounded-xl font-black hover:bg-green-400 transition-all flex items-center gap-2"
              >
                <span className="text-lg">📲</span> ENVIAR A WHATSAPP
              </button>
            </div>
          </div>
          <div className="flex bg-black p-1.5 rounded-2xl border border-white/10 w-fit">
            <button className="px-6 py-2 rounded-xl font-black bg-white text-black">AUDITORÍA</button>
          </div>
        </div>

        {/* FILTROS CON OPCIÓN SALIDA_RBD */}
        <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-zinc-600 font-bold ml-2">FECHA INICIO</span>
            <input type="date" className="bg-black border border-white/10 p-3 rounded-xl" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-zinc-600 font-bold ml-2">FECHA FIN</span>
            <input type="date" className="bg-black border border-white/10 p-3 rounded-xl" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-zinc-600 font-bold ml-2">OPERACIÓN</span>
            <select className="bg-black border border-white/10 p-3 rounded-xl" value={filtroOperacion} onChange={e => setFiltroOperacion(e.target.value)}>
              <option value="TODOS">TODAS</option>
              <option value="ENTRADA_ACP">ENTRADA_ACP</option>
              <option value="SALIDA_RBD">SALIDA_RBD</option>
              <option value="ACIDO_GRASO">ACIDO_GRASO</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-zinc-600 font-bold ml-2">VARIEDAD</span>
            <select className="bg-black border border-white/10 p-3 rounded-xl" value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)}>
              <option value="TODOS">TODAS</option>
              <option value="ALTO OLEICO">ALTO OLEICO</option>
              <option value="GUINENSIS">GUINENSIS</option>
            </select>
          </div>
        </div>

        {loading ? <div className="p-20 text-center animate-pulse text-zinc-600 font-black">CARGANDO...</div> : renderTablaAuditoria()}
      </div>
    </div>
  );
}