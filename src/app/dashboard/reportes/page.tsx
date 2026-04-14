'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx'; // Necesitas instalarlo: npm install xlsx

const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";

export default function ReporteBalance() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  
  // FILTROS
  const [fechaDesde, setFechaDesde] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0]);
  const [filtroVariedad, setFiltroVariedad] = useState('TODAS');
  const [filtroProceso, setFiltroProceso] = useState('TODOS');

  useEffect(() => {
    fetchReporte();
  }, [fechaDesde, fechaHasta, filtroVariedad, filtroProceso]);

  const fetchReporte = async () => {
    setLoading(true);
    try {
      // Consultamos la Vista Inteligente que creamos en SQL
      let query = supabase
        .from('reporte_balance_masa')
        .select('*')
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)
        .order('fecha', { ascending: false });

      const { data: res, error } = await query;
      if (error) throw error;
      setData(res || []);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // EXPORTAR A EXCEL
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Balance_Masa");
    XLSX.writeFile(wb, `Balance_Masa_${fechaDesde}_al_${fechaHasta}.xlsx`);
  };

  // EXPORTAR A WHATSAPP (SUBTOTALES/RESUMEN)
  const exportToWhatsApp = () => {
    const totalCPO = data.reduce((acc, curr) => acc + curr.total_cpo, 0);
    const totalRBD = data.reduce((acc, curr) => acc + curr.total_rbd, 0);
    const totalAGL = data.reduce((acc, curr) => acc + curr.agl_produccion, 0);
    const avgMerma = (data.reduce((acc, curr) => acc + curr.porcentaje_merma, 0) / data.length) || 0;

    const msg = `*RESUMEN BALANCE DE MASA*%0A` +
                `*Periodo:* ${fechaDesde} a ${fechaHasta}%0A%0A` +
                `*Total CPO (Entrada):* ${totalCPO.toLocaleString()} KG%0A` +
                `*Total RBD (Salida):* ${totalRBD.toLocaleString()} KG%0A` +
                `*Total AGL (Prod):* ${totalAGL.toLocaleString()} KG%0A%0A` +
                `*MERMA PROMEDIO:* ${avgMerma.toFixed(2)}%25%0A` +
                `✅ _REPORTE GENERADO DESDE EL SISTEMA_`;

    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 py-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-zinc-900 border border-white/10 p-3 rounded-2xl text-[10px] font-black text-zinc-400">
              VOLVER
            </button>
            <h1 className="text-blue-500 font-black text-lg tracking-[0.2em]">REPORTE DE BALANCE</h1>
          </div>
          
          <div className="flex gap-2">
            <button onClick={exportToExcel} className="bg-emerald-600 px-4 py-2 rounded-xl text-[9px] font-black">EXCEL</button>
            <button onClick={exportToWhatsApp} className="bg-zinc-800 px-4 py-2 rounded-xl text-[9px] font-black">WHATSAPP</button>
            <button onClick={() => window.print()} className="bg-zinc-800 px-4 py-2 rounded-xl text-[9px] font-black">PDF / IMPRIMIR</button>
          </div>
        </header>

        {/* FILTROS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-900/50 p-6 rounded-[30px] border border-white/5">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-zinc-500">DESDE</label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-zinc-500">HASTA</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-zinc-500">VARIEDAD</label>
            <select value={filtroVariedad} onChange={(e) => setFiltroVariedad(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white">
              <option value="TODAS">TODAS</option>
              <option value="ALTO OLEICO">ALTO OLEICO</option>
              <option value="GUINENSIS">GUINENSIS</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-zinc-500">PROCESO</label>
            <select value={filtroProceso} onChange={(e) => setFiltroProceso(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white">
              <option value="TODOS">TODOS</option>
              <option value="NORMAL">NORMAL</option>
              <option value="REPROCESO">REPROCESO</option>
            </select>
          </div>
        </div>

        {/* TABLA DE RESULTADOS */}
        <div className="bg-zinc-900 rounded-[30px] border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-white/5 text-zinc-500 font-black">
                <tr>
                  <th className="p-4">FECHA</th>
                  <th className="p-4">CPO (ENTRADA)</th>
                  <th className="p-4">RBD (SALIDA)</th>
                  <th className="p-4">AGL (PROD)</th>
                  <th className="p-4">INV DS3</th>
                  <th className="p-4">BALANCE ACP</th>
                  <th className="p-4">DIFERENCIA</th>
                  <th className="p-4">% MERMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={8} className="p-10 text-center animate-pulse">CARGANDO BALANCE...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center">NO HAY DATOS EN ESTE RANGO</td></tr>
                ) : data.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold">{item.fecha}</td>
                    <td className="p-4 tabular-nums">{item.total_cpo?.toLocaleString()}</td>
                    <td className="p-4 tabular-nums text-emerald-400">{item.total_rbd?.toLocaleString()}</td>
                    <td className="p-4 tabular-nums text-orange-400">{item.agl_produccion?.toLocaleString()}</td>
                    <td className="p-4 tabular-nums text-blue-400">{item.inv_final_ds3?.toLocaleString()}</td>
                    <td className="p-4 tabular-nums font-black">{item.balance_acp?.toLocaleString()}</td>
                    <td className="p-4 tabular-nums text-red-400">{item.diferencia_kg?.toLocaleString()}</td>
                    <td className={`p-4 font-black ${item.porcentaje_merma > 1 ? 'text-red-500' : 'text-zinc-400'}`}>
                      {item.porcentaje_merma?.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}