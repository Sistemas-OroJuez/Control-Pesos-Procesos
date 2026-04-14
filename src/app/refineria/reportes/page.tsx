'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]);
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [modoVista, setModoVista] = useState<'AUDITORIA' | 'BALANCE'>('AUDITORIA');

  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);

  const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";

  useEffect(() => {
    if (modoVista === 'AUDITORIA') fetchAuditoria();
    else fetchBalanceMasico();
  }, [fechaInicio, fechaFin, modoVista]);

  const fetchAuditoria = async () => {
    setLoading(true);
    try {
      const { data: todos, error } = await supabase.from('operaciones_refineria').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      if (todos) {
        const procesados = todos.map((reg, index) => {
          const anterior = todos.slice(0, index).reverse().find(r => r.tipo_operacion === reg.tipo_operacion);
          const lecturaActual = parseFloat(reg.valor_lectura) || 0;
          const lecturaAnterior = anterior ? parseFloat(anterior.valor_lectura) : lecturaActual;
          const kg = (reg.tipo_operacion === 'ENTRADA_ACP' || reg.tipo_operacion === 'SALIDA_RBD') ? (lecturaActual - lecturaAnterior) : lecturaActual;
          return { ...reg, lecturaAnterior, kgResultantes: kg };
        });
        setRegistros(procesados.filter(r => {
          const f = r.created_at?.split('T')[0];
          return f >= fechaInicio && f <= fechaFin;
        }));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchBalanceMasico = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reporte_balance_masa')
        .select('*')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .order('fecha', { ascending: false });
      
      if (error) throw error;
      setBalanceData(data || []);
    } catch (err) {
      console.error("Error en balance:", err);
      setBalanceData([]);
    }
    setLoading(false);
  };

  const exportarExcel = () => {
    if (modoVista === 'BALANCE' && balanceData.length === 0) return alert("No hay datos");
    const dataExport = modoVista === 'AUDITORIA' 
      ? registros.map(r => ({ FECHA: r.created_at, TIPO: r.tipo_operacion, KG: r.kgResultantes }))
      : balanceData.map(b => ({ 
          FECHA: b.fecha, 
          CPO: b.total_cpo || 0, 
          RBD: b.total_rbd || 0, 
          AGL: b.agl_produccion || 0, 
          BALANCE: b.balance_acp || 0, 
          MERMA: (b.porcentaje_merma || 0).toFixed(2) + '%' 
        }));
    
    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_${modoVista}.xlsx`);
  };

  const enviarTotalesWhatsApp = () => {
    const tCPO = balanceData.reduce((a, b) => a + (Number(b.total_cpo) || 0), 0);
    const tRBD = balanceData.reduce((a, b) => a + (Number(b.total_rbd) || 0), 0);
    const tAGL = balanceData.reduce((a, b) => a + (Number(b.agl_produccion) || 0), 0);
    const avgMerma = tCPO > 0 ? ((tCPO - (tRBD + tAGL)) / tCPO * 100) : 0;

    const msg = `*📊 BALANCE MÁSICO*%0A*CPO:* ${tCPO.toLocaleString()} KG%0A*RBD:* ${tRBD.toLocaleString()} KG%0A*AGL:* ${tAGL.toLocaleString()} KG%0A*MERMA:* ${avgMerma.toFixed(2)}%25`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[10px]">
      <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 mb-6 space-y-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4 gap-2">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-black border border-white/10 px-4 py-2 rounded-xl text-zinc-500 font-black">VOLVER</button>
          <div className="flex bg-black p-1 rounded-xl border border-white/10 overflow-hidden">
            <button onClick={() => setModoVista('AUDITORIA')} className={`px-3 py-2 rounded-lg transition-all ${modoVista === 'AUDITORIA' ? 'bg-orange-600 text-white' : 'text-zinc-600'}`}>AUDITORÍA</button>
            <button onClick={() => setModoVista('BALANCE')} className={`px-3 py-2 rounded-lg transition-all ${modoVista === 'BALANCE' ? 'bg-blue-600 text-white' : 'text-zinc-600'}`}>BALANCE</button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white" />
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white" />
          <button onClick={exportarExcel} className="bg-zinc-800 py-3 rounded-xl font-black">📊 EXCEL</button>
          <button onClick={() => window.print()} className="bg-zinc-800 py-3 rounded-xl font-black">📄 PDF</button>
          <button onClick={enviarTotalesWhatsApp} className="bg-emerald-600 py-3 rounded-xl font-black">💬 TOTALES</button>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-[35px] border border-white/5 overflow-hidden min-h-[200px]">
        {loading ? (
          <div className="p-20 text-center animate-pulse text-zinc-500 font-black tracking-widest">CARGANDO DATOS...</div>
        ) : modoVista === 'AUDITORIA' ? (
          <table className="w-full text-left">
            <thead className="bg-white/5 text-zinc-500 font-black">
              <tr>
                <th className="p-4">FECHA</th>
                <th className="p-4">OPERACIÓN</th>
                <th className="p-4 text-right">KG</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-4 font-bold">{r.tipo_operacion}</td>
                  <td className="p-4 text-right font-black text-orange-400">{(r.kgResultantes || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-blue-900/20 text-blue-400 font-black">
              <tr>
                <th className="p-4">FECHA</th>
                <th className="p-4 text-right">CPO</th>
                <th className="p-4 text-right">RBD</th>
                <th className="p-4 text-right text-white">BALANCE</th>
                <th className="p-4 text-right text-red-500">%</th>
              </tr>
            </thead>
            <tbody>
              {balanceData.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-zinc-600">SIN DATOS DE BALANCE</td></tr>
              ) : balanceData.map((b, i) => (
                <tr key={i} className="border-b border-white/5 text-[11px]">
                  <td className="p-4 font-bold">{b.fecha || '---'}</td>
                  <td className="p-4 text-right tabular-nums">{(b.total_cpo || 0).toLocaleString()}</td>
                  <td className="p-4 text-right tabular-nums text-emerald-400">{(b.total_rbd || 0).toLocaleString()}</td>
                  <td className="p-4 text-right tabular-nums font-black">{(b.balance_acp || 0).toLocaleString()}</td>
                  <td className={`p-4 text-right font-black ${(b.porcentaje_merma || 0) > 1 ? 'text-red-500' : 'text-zinc-500'}`}>
                    {(b.porcentaje_merma || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}