'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]);
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [modoVista, setModoVista] = useState<'AUDITORIA' | 'BALANCE'>('AUDITORIA');

  // Filtro por defecto: primer día del mes actual
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [filtroProceso, setFiltroProceso] = useState('TODOS');
  const [filtroVariedad, setFiltroVariedad] = useState('TODOS');
  const [filtroProducto, setFiltroProducto] = useState('TODOS');

  const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";

  useEffect(() => {
    if (modoVista === 'AUDITORIA') fetchAuditoria();
    else fetchBalanceMasico();
  }, [fechaInicio, fechaFin, filtroProceso, filtroVariedad, filtroProducto, modoVista]);

  const fetchAuditoria = async () => {
    setLoading(true);
    const { data: todos, error } = await supabase.from('operaciones_refineria').select('*').order('created_at', { ascending: true });
    if (!error && todos) {
      const procesados = todos.map((reg, index) => {
        const anterior = todos.slice(0, index).reverse().find(r => r.tipo_operacion === reg.tipo_operacion);
        const lecturaActual = parseFloat(reg.valor_lectura) || 0;
        const lecturaAnterior = anterior ? parseFloat(anterior.valor_lectura) : lecturaActual;
        const kg = (reg.tipo_operacion === 'ENTRADA_ACP' || reg.tipo_operacion === 'SALIDA_RBD') ? (lecturaActual - lecturaAnterior) : lecturaActual;
        return { ...reg, lecturaAnterior, kgResultantes: kg };
      });
      setRegistros(procesados.filter(r => {
        const f = r.created_at.split('T')[0];
        return f >= fechaInicio && f <= fechaFin;
      }));
    }
    setLoading(false);
  };

  const fetchBalanceMasico = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('reporte_balance_masa').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin).order('fecha', { ascending: false });
    if (!error) setBalanceData(data || []);
    setLoading(false);
  };

  // --- LÓGICA DE EXPORTACIÓN ---

  const exportarExcel = () => {
    const dataExport = modoVista === 'AUDITORIA' 
      ? registros.map(r => ({ FECHA: r.created_at, TIPO: r.tipo_operacion, KG: r.kgResultantes }))
      : balanceData.map(b => ({ FECHA: b.fecha, CPO: b.total_cpo, RBD: b.total_rbd, AGL: b.agl_produccion, 'INV DS3': b.inv_final_ds3, BALANCE: b.balance_acp, MERMA: b.porcentaje_merma }));
    
    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Refineria");
    XLSX.writeFile(wb, `Reporte_${modoVista}_${fechaInicio}.xlsx`);
  };

  const exportarPDF = () => {
    window.print(); // Abre el diálogo de impresión optimizado por CSS
  };

  const enviarTotalesWhatsApp = () => {
    if (balanceData.length === 0) return alert("No hay datos para enviar");

    // Calculamos los totales del periodo
    const tCPO = balanceData.reduce((a, b) => a + (b.total_cpo || 0), 0);
    const tRBD = balanceData.reduce((a, b) => a + (b.total_rbd || 0), 0);
    const tAGL = balanceData.reduce((a, b) => a + (b.agl_produccion || 0), 0);
    const avgMerma = (tCPO > 0) ? ((tCPO - (tRBD + tAGL)) / tCPO * 100) : 0;

    const msg = `*📊 RESUMEN BALANCE MÁSICO*%0A` +
                `*PERIODO:* ${fechaInicio} al ${fechaFin}%0A%0A` +
                `*TOTAL ENTRADA CPO:* ${tCPO.toLocaleString()} KG%0A` +
                `*TOTAL SALIDA RBD:* ${tRBD.toLocaleString()} KG%0A` +
                `*TOTAL PROD. AGL:* ${tAGL.toLocaleString()} KG%0A%0A` +
                `*MERMA GLOBAL:* ${avgMerma.toFixed(2)}%25%0A` +
                `✅ _REPORTE GENERADO AUTOMÁTICAMENTE_`;

    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[10px] print:bg-white print:text-black">
      
      {/* PANEL DE CONTROL - Oculto en Impresión */}
      <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 mb-6 space-y-6 print:hidden">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-black border border-white/10 px-4 py-2 rounded-xl text-zinc-500 font-black">VOLVER</button>
          <div className="flex bg-black p-1 rounded-xl border border-white/10">
            <button onClick={() => setModoVista('AUDITORIA')} className={`px-4 py-2 rounded-lg transition-all ${modoVista === 'AUDITORIA' ? 'bg-orange-600 text-white' : 'text-zinc-600'}`}>AUDITORÍA</button>
            <button onClick={() => setModoVista('BALANCE')} className={`px-4 py-2 rounded-lg transition-all ${modoVista === 'BALANCE' ? 'bg-blue-600 text-white' : 'text-zinc-600'}`}>BALANCE MÁSICO</button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white" />
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white" />
          
          <button onClick={exportarExcel} className="bg-zinc-800 border border-white/10 py-3 rounded-xl font-black hover:bg-zinc-700">📊 EXCEL</button>
          <button onClick={exportarPDF} className="bg-zinc-800 border border-white/10 py-3 rounded-xl font-black hover:bg-zinc-700">📄 PDF</button>
          <button onClick={enviarTotalesWhatsApp} className="bg-emerald-600 py-3 rounded-xl font-black shadow-lg shadow-emerald-900/20">💬 TOTALES WS</button>
        </div>
      </div>

      {/* TABLAS */}
      <div className="bg-zinc-900 rounded-[35px] border border-white/5 overflow-hidden print:border-none print:bg-white">
        {modoVista === 'AUDITORIA' ? (
          <table className="w-full text-left">
            <thead className="bg-white/5 font-black text-zinc-500">
              <tr>
                <th className="p-4">FECHA / HORA</th>
                <th className="p-4">OPERACIÓN</th>
                <th className="p-4 text-right">L. ACTUAL</th>
                <th className="p-4 text-right text-orange-500">KG RESULTANTES</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-4 font-bold">{r.tipo_operacion}</td>
                  <td className="p-4 text-right">{parseFloat(r.valor_lectura).toLocaleString()}</td>
                  <td className="p-4 text-right font-black text-orange-400">{r.kgResultantes.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-blue-900/20 font-black text-blue-400">
              <tr>
                <th className="p-4">FECHA</th>
                <th className="p-4 text-right">CPO</th>
                <th className="p-4 text-right">RBD</th>
                <th className="p-4 text-right">AGL</th>
                <th className="p-4 text-right">DS3</th>
                <th className="p-4 text-right text-white">BALANCE</th>
                <th className="p-4 text-right text-red-500">% MERMA</th>
              </tr>
            </thead>
            <tbody>
              {balanceData.map((b, i) => (
                <tr key={i} className="border-b border-white/5 text-[11px] hover:bg-blue-500/5 transition-colors">
                  <td className="p-4 font-bold">{b.fecha}</td>
                  <td className="p-4 text-right tabular-nums">{b.total_cpo.toLocaleString()}</td>
                  <td className="p-4 text-right tabular-nums text-emerald-400">{b.total_rbd.toLocaleString()}</td>
                  <td className="p-4 text-right tabular-nums text-orange-400">{b.agl_produccion.toLocaleString()}</td>
                  <td className="p-4 text-right tabular-nums text-blue-400">{b.inv_final_ds3.toLocaleString()}</td>
                  <td className="p-4 text-right tabular-nums font-black">{b.balance_acp.toLocaleString()}</td>
                  <td className={`p-4 text-right font-black ${b.porcentaje_merma > 1 ? 'text-red-500' : 'text-zinc-500'}`}>
                    {b.porcentaje_merma.toFixed(2)}%
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