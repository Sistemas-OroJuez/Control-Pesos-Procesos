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
  const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";

  useEffect(() => {
    if (modoVista === 'AUDITORIA') fetchAuditoria();
    else fetchBalanceGerencial();
  }, [fechaInicio, fechaFin, modoVista, filtroVariedad, filtroOperacion]);

  const fetchAuditoria = async () => {
    setLoading(true);
    let query = supabase
      .from('operaciones_refineria')
      .select('*')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('operacion', { ascending: true })
      .order('variedad', { ascending: true });

    if (filtroVariedad !== 'TODOS') query = query.eq('variedad', filtroVariedad);
    if (filtroOperacion !== 'TODOS') query = query.eq('operacion', filtroOperacion);

    const { data } = await query;
    setRegistros(data || []);
    setLoading(false);
  };

  const fetchBalanceGerencial = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('balance_refineria')
      .select('*')
      .gte('fecha3', fechaInicio)
      .lte('fecha3', fechaFin)
      .order('fecha3', { ascending: false });
    setBalanceData(data || []);
    setLoading(false);
  };

  // Lógica de conversión para Ácido Graso
  const getKgVacio = (vacio: number, tanque: string) => {
    const factores: { [key: string]: number } = { '1': 0.92, '2': 0.95, 'DEFAULT': 0.90 };
    return vacio * (factores[tanque] || factores['DEFAULT']);
  };

  const enviarWhatsApp = (items: any[], titulo: string) => {
    let mensaje = `*REPORTE ${titulo}*\n_Periodo: ${fechaInicio} a ${fechaFin}_\n\n`;
    items.forEach(r => {
      let res = r.valor_lectura - (r.lectura_anterior || 0);
      if (r.operacion === 'ACIDO GRASO') {
        res = (getKgVacio(r.medida_vacio, r.tanque_id) + (r.egreso_produccion || 0) + (r.egreso_venta || 0)) - (r.lectura_anterior || 0);
      }
      mensaje += `🔹 *${r.variedad}* (${r.fecha})\n`;
      mensaje += `L.Act: ${r.valor_lectura.toLocaleString()} | L.Ant: ${r.lectura_anterior?.toLocaleString() || 0}\n`;
      mensaje += `*Dif: ${res.toLocaleString()} Kg*\n\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const renderTablaAuditoria = () => {
    // Agrupamiento manual para asegurar que se muestren los datos
    const opGrupos = Array.from(new Set(registros.map(r => r.operacion)));

    return opGrupos.map(opName => {
      const registrosOp = registros.filter(r => r.operacion === opName);
      const variedadesOp = Array.from(new Set(registrosOp.map(r => r.variedad)));

      return (
        <div key={opName} className="mb-12 bg-zinc-900 rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
          <div className="p-6 bg-white/5 flex justify-between items-center border-b border-white/10">
            <h2 className="text-2xl font-black text-white uppercase italic">{opName}</h2>
            <button onClick={() => enviarWhatsApp(registrosOp, opName)} className="bg-emerald-500 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20">
              📲 Enviar WhatsApp
            </button>
          </div>

          {variedadesOp.map(varName => {
            const items = registrosOp.filter(r => r.variedad === varName);
            let subtotalLec = 0;
            let subtotalDif = 0;

            return (
              <div key={varName} className="border-b border-white/5 last:border-0">
                <div className="px-6 py-3 bg-white/5">
                  <span className="text-blue-400 font-black text-xs uppercase tracking-widest">Variedad: {varName}</span>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] text-zinc-500 uppercase font-bold border-b border-white/5">
                      <th className="p-4">Fecha</th>
                      <th className="p-4 text-right">L. Actual</th>
                      <th className="p-4 text-right">L. Anterior</th>
                      <th className="p-4 text-right">Resultado Kg</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300 text-xs">
                    {items.map(r => {
                      let resultado = r.valor_lectura - (r.lectura_anterior || 0);
                      if (opName === 'ACIDO GRASO') {
                        resultado = (getKgVacio(r.medida_vacio, r.tanque_id) + (r.egreso_produccion || 0) + (r.egreso_venta || 0)) - (r.lectura_anterior || 0);
                      }
                      subtotalLec += r.valor_lectura;
                      subtotalDif += resultado;

                      return (
                        <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4">{r.fecha}</td>
                          <td className="p-4 text-right font-bold text-white">{r.valor_lectura.toLocaleString()}</td>
                          <td className="p-4 text-right text-zinc-500">{r.lectura_anterior?.toLocaleString() || 0}</td>
                          <td className="p-4 text-right font-black text-blue-400">{resultado.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {/* FILA DE SUBTOTALES GRANDES */}
                    <tr className="bg-zinc-800/50">
                      <td className="p-6 text-xs font-black text-zinc-400 uppercase">SUBTOTAL {varName}</td>
                      <td className="p-6 text-right text-xl font-bold text-white">{subtotalLec.toLocaleString()}</td>
                      <td className="p-6"></td>
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

  const renderTablaGerencial = () => (
    <div className="bg-zinc-900 rounded-[40px] shadow-2xl overflow-hidden border border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] text-left border-collapse">
          <thead className="bg-white/5 text-zinc-500 font-bold uppercase border-b border-white/10">
            <tr>
              <th className="p-4">Fecha</th>
              <th className="p-4 text-right">L.I. CPO</th>
              <th className="p-4 text-right">L.F. CPO</th>
              <th className="p-4 text-right">L.I. RBD</th>
              <th className="p-4 text-right">L.F. RBD</th>
              <th className="p-4 text-right text-white">Total CPO</th>
              <th className="p-4 text-right text-emerald-400">Total RBD</th>
              <th className="p-4 text-right font-black text-blue-400">Balance</th>
              <th className="p-4 text-right">Merma %</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {balanceData.map((b, i) => {
              const tCPO = b.flujometro_final_cpo - b.flujometro_inicial_cpo;
              const tRBD = b.flujometro_final_rbd - b.flujometro_inicial_rbd;
              const bal = (tCPO + b.inventario_inicial_ds3) - (tRBD + b.agl + b.reproceso + b.inventario_final_ds3);
              const merm = tCPO > 0 ? (bal / tCPO) * 100 : 0;
              return (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4 font-bold">{b.fecha3}</td>
                  <td className="p-4 text-right">{b.flujometro_inicial_cpo?.toLocaleString()}</td>
                  <td className="p-4 text-right">{b.flujometro_final_cpo?.toLocaleString()}</td>
                  <td className="p-4 text-right">{b.flujometro_inicial_rbd?.toLocaleString()}</td>
                  <td className="p-4 text-right">{b.flujometro_final_rbd?.toLocaleString()}</td>
                  <td className="p-4 text-right font-bold text-white">{tCPO.toLocaleString()}</td>
                  <td className="p-4 text-right font-bold text-emerald-400">{tRBD.toLocaleString()}</td>
                  <td className="p-4 text-right font-black text-blue-400">{bal.toLocaleString()}</td>
                  <td className={`p-4 text-right font-black ${merm > 1 ? 'text-red-500' : 'text-emerald-500'}`}>{merm.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black p-4 md:p-8 font-sans text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER Y SELECTOR */}
        <div className="bg-zinc-900 p-8 rounded-[45px] border border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">Auditoría Refinería</h1>
            <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Panel de Control Operativo</p>
          </div>
          
          <div className="flex bg-black/50 p-1.5 rounded-[25px] border border-white/10">
            <button onClick={() => setModoVista('AUDITORIA')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black transition-all ${modoVista === 'AUDITORIA' ? 'bg-white text-black' : 'text-zinc-500'}`}>AUDITORÍA</button>
            <button onClick={() => setModoVista('GERENCIAL')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black transition-all ${modoVista === 'GERENCIAL' ? 'bg-white text-black' : 'text-zinc-500'}`}>GERENCIAL</button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-zinc-900 p-6 rounded-[35px] border border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <input type="date" className="bg-black border border-white/10 p-3 rounded-2xl text-xs font-bold" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          <input type="date" className="bg-black border border-white/10 p-3 rounded-2xl text-xs font-bold" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          <select className="bg-black border border-white/10 p-3 rounded-2xl text-xs font-bold" value={filtroOperacion} onChange={e => setFiltroOperacion(e.target.value)}>
            <option value="TODOS">TODAS LAS OPERACIONES</option>
            <option value="ENTRADA ACP">ENTRADA ACP</option>
            <option value="SALIDA RBD">SALIDA RBD</option>
            <option value="ACIDO GRASO">ACIDO GRASO</option>
          </select>
          <select className="bg-black border border-white/10 p-3 rounded-2xl text-xs font-bold" value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)}>
            <option value="TODOS">TODAS LAS VARIEDADES</option>
            <option value="GUINENSIS">GUINENSIS</option>
            <option value="HIBRIDO">HIBRIDO</option>
          </select>
        </div>

        {/* CONTENIDO */}
        {loading ? (
          <div className="flex justify-center p-20 animate-pulse text-zinc-500 font-black">CARGANDO DATOS...</div>
        ) : (
          modoVista === 'AUDITORIA' ? renderTablaAuditoria() : renderTablaGerencial()
        )}

      </div>
    </div>
  );
}