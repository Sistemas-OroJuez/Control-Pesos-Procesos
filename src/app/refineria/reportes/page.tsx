'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]); 
  const [balanceData, setBalanceData] = useState<any[]>([]); 
  const [modoVista, setModoVista] = useState<'AUDITORIA' | 'GERENCIAL'>('AUDITORIA');
  
  // Estados para Filtros
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
    const { data: todos, error } = await supabase
      .from('operaciones_refineria')
      .select('*')
      .order('created_at', { ascending: true });

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
    try {
      const { data, error } = await supabase
        .from('reporte_balance_masa')
        .select('*')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .order('fecha', { ascending: false });
      if (error) throw error;
      setBalanceData(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const editarRegistro = async (id: string, valorActual: any) => {
    const clave = prompt("🔐 INGRESE CLAVE DE AUTORIZACIÓN:");
    if (clave !== CLAVE_MAESTRA) return alert("❌ CLAVE INCORRECTA");
    const nuevoValorStr = prompt("📝 CORREGIR VALOR DE LECTURA (OCR):", valorActual);
    if (nuevoValorStr !== null && nuevoValorStr !== "") {
      const valorNumerico = parseFloat(nuevoValorStr);
      if (isNaN(valorNumerico)) return alert("⚠️ INGRESE UN NÚMERO VÁLIDO");
      setLoading(true);
      setRegistros(prev => prev.map(r => r.id === id ? { ...r, valor_lectura: valorNumerico } : r));
      const { data, error } = await supabase.from('operaciones_refineria').update({ valor_lectura: valorNumerico }).eq('id', id).select();
      if (error) {
        alert("❌ ERROR EN DB: " + error.message);
        fetchAuditoria(); 
      } else {
        alert("✅ VALOR GUARDADO");
        setTimeout(() => fetchAuditoria(), 800);
      }
    }
  };

  const exportarExcel = () => {
    const dataExport = modoVista === 'AUDITORIA' ? registros : balanceData;
    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_${modoVista}.xlsx`);
  };

  const enviarWhatsApp = () => {
    if (balanceData.length === 0) return alert("No hay datos para enviar");
    const tCPO = balanceData.reduce((a, b) => a + (b.total_cpo || 0), 0);
    const tRBD = balanceData.reduce((a, b) => a + (b.total_rbd || 0), 0);
    const tAGL = balanceData.reduce((a, b) => a + (b.agl_produccion || 0), 0);
    const msg = `*📊 RESUMEN GERENCIAL*%0A*ENTRADA CPO:* ${tCPO.toLocaleString()} KG%0A*SALIDA RBD:* ${tRBD.toLocaleString()} KG%0A*PROD AGL:* ${tAGL.toLocaleString()} KG`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[10px]">
      <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 mb-6 space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-white/5 pb-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-black border border-white/10 px-4 py-2 rounded-xl text-zinc-500 font-black">VOLVER</button>
          <div className="flex bg-black p-1 rounded-xl border border-white/10">
            <button onClick={() => setModoVista('AUDITORIA')} className={`px-4 py-2 rounded-lg transition-all ${modoVista === 'AUDITORIA' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-600'}`}>VISTA AUDITORÍA</button>
            <button onClick={() => setModoVista('GERENCIAL')} className={`px-4 py-2 rounded-lg transition-all ${modoVista === 'GERENCIAL' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-600'}`}>BALANCE GERENCIAL</button>
          </div>
        </div>

        {/* SECCIÓN DE FILTROS */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 ml-2">INICIO</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 ml-2">FIN</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white w-full" />
          </div>
          
          {modoVista === 'AUDITORIA' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-zinc-500 ml-2">VARIEDAD</label>
                <select value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white w-full">
                  <option value="TODOS">TODOS</option>
                  <option value="ALTO OLEICO">ALTO OLEICO</option>
                  <option value="GUINENSIS">GUINENSIS</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-zinc-500 ml-2">OPERACIÓN</label>
                <select value={filtroOperacion} onChange={e => setFiltroOperacion(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white w-full">
                  <option value="TODOS">TODAS</option>
                  <option value="ENTRADA_ACP">ENTRADA_ACP</option>
                  <option value="SALIDA_RBD">SALIDA_RBD</option>
                  <option value="PRODUCCION_AGL">PRODUCCION_AGL</option>
                </select>
              </div>
            </>
          )}

          <div className="flex items-end gap-2 md:col-span-2">
            <button onClick={exportarExcel} className="flex-1 bg-zinc-800 py-3 rounded-xl font-black hover:bg-zinc-700 transition-all">📊 EXCEL</button>
            <button onClick={enviarWhatsApp} className="flex-1 bg-emerald-600 py-3 rounded-xl font-black shadow-lg hover:bg-emerald-500 transition-all">💬 WHATSAPP</button>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-[35px] border border-white/5 overflow-hidden shadow-2xl min-h-[400px]">
        {loading ? (
          <div className="p-20 text-center animate-pulse text-zinc-500 font-black tracking-[0.3em]">PROCESANDO DATOS...</div>
        ) : modoVista === 'AUDITORIA' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-zinc-500 border-b border-white/10 font-black">
                  <th className="p-4">FECHA / HORA</th>
                  <th className="p-4">OPERACIÓN</th>
                  <th className="p-4 text-right">L. ANTERIOR</th>
                  <th className="p-4 text-right text-white">L. ACTUAL</th>
                  <th className="p-4 text-right text-orange-500">KG RESULTANTES</th>
                  <th className="p-4 text-center">EVIDENCIA</th>
                  <th className="p-4 text-center">EDIT</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-white/5 hover:bg-white/5 transition-all">
                    <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-4">
                      <div className="font-bold">{r.tipo_operacion}</div>
                      <div className="text-[8px] text-zinc-600">{r.variedad}</div>
                    </td>
                    <td className="p-4 text-right text-zinc-600">{r.lecturaAnterior?.toLocaleString()}</td>
                    <td className="p-4 text-right font-bold bg-white/5">{parseFloat(r.valor_lectura || 0).toLocaleString()}</td>
                    <td className="p-4 text-right font-black text-orange-400">{r.kgResultantes?.toLocaleString()}</td>
                    <td className="p-4 text-center">{r.foto_url && <a href={r.foto_url} target="_blank" className="bg-zinc-800 p-2 rounded-lg inline-block">📸</a>}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => editarRegistro(r.id, r.valor_lectura)} className="bg-blue-500/10 p-2 rounded-lg text-blue-500 hover:bg-blue-500 shadow-md">✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-blue-900/20 text-blue-400 border-b border-blue-500/10 font-black text-[8px]">
                  <th className="p-3">FECHA</th>
                  <th className="p-3 text-right">INV. INICIAL DS3</th>
                  <th className="p-3 text-right">TOTAL CPO (KG)</th>
                  <th className="p-3 text-right">TOTAL RBD (KG)</th>
                  <th className="p-3 text-right">AGL</th>
                  <th className="p-3 text-right">REPROCESO</th>
                  <th className="p-3 text-right">INV. FINAL DS3</th>
                  <th className="p-3 text-right text-white">BALANCE CPO</th>
                  <th className="p-3 text-right text-red-500">% MERMA</th>
                </tr>
              </thead>
              <tbody className="text-[10px]">
                {balanceData.map((b, i) => {
                  const totalCPO = b.total_cpo || 0;
                  const totalRBD = b.total_rbd || 0;
                  const agl = b.agl_produccion || 0;
                  const invIni = b.inventario_inicial_ds3 || 0;
                  const invFin = b.inventario_final_ds3 || 0;
                  const balanceCPO = totalCPO + invIni - invFin;
                  const diferencia = balanceCPO - (totalRBD + agl);
                  const merma = balanceCPO > 0 ? (diferencia / balanceCPO) * 100 : 0;

                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-blue-500/5 transition-all">
                      <td className="p-3 font-bold">{b.fecha}</td>
                      <td className="p-3 text-right text-zinc-500">{invIni.toLocaleString()}</td>
                      <td className="p-3 text-right tabular-nums font-bold">{totalCPO.toLocaleString()}</td>
                      <td className="p-3 text-right tabular-nums text-emerald-400">{totalRBD.toLocaleString()}</td>
                      <td className="p-3 text-right text-orange-300">{agl.toLocaleString()}</td>
                      <td className="p-3 text-right text-zinc-500">{b.reproceso || 0}</td>
                      <td className="p-3 text-right text-zinc-500">{invFin.toLocaleString()}</td>
                      <td className="p-3 text-right tabular-nums font-black text-white bg-white/5">{balanceCPO.toLocaleString()}</td>
                      <td className={`p-3 text-right font-black ${merma > 1 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {merma.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}