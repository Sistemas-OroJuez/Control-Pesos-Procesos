'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]); // Para Auditoría
  const [balanceData, setBalanceData] = useState<any[]>([]); // Para el Excel
  const [modoVista, setModoVista] = useState<'AUDITORIA' | 'GERENCIAL'>('AUDITORIA');
  
  // FILTROS (Default: primer día del mes)
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);

  const CLAVE_MAESTRA = "orj2026";
  const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";

  useEffect(() => {
    if (modoVista === 'AUDITORIA') fetchAuditoria();
    else fetchBalanceGerencial();
  }, [fechaInicio, fechaFin, modoVista]);

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
        return f >= fechaInicio && f <= fechaFin;
      }).reverse()); // Reverse para ver lo más reciente arriba
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

  // --- FUNCIÓN PARA EDITAR CORRECCIÓN OCR ---
  const editarRegistro = async (id: string, valorActual: any) => {
    const clave = prompt("🔐 INGRESE CLAVE DE AUTORIZACIÓN:");
    if (clave !== CLAVE_MAESTRA) return alert("❌ CLAVE INCORRECTA");

    const nuevoValorStr = prompt("📝 CORREGIR VALOR DE LECTURA (OCR):", valorActual);
    
    if (nuevoValorStr !== null && nuevoValorStr !== "") {
      const valorNumerico = parseFloat(nuevoValorStr);
      
      if (isNaN(valorNumerico)) {
        return alert("⚠️ INGRESE UN NÚMERO VÁLIDO");
      }

      // Actualización visual inmediata para que el jefe vea el cambio
      setRegistros(prev => prev.map(r => r.id === id ? { ...r, valor_lectura: valorNumerico } : r));

      const { error } = await supabase
        .from('operaciones_refineria')
        .update({ valor_lectura: valorNumerico })
        .eq('id', id);

      if (error) {
        alert("❌ ERROR AL GUARDAR: " + error.message);
        fetchAuditoria(); // Revertir si hay error
      } else {
        alert("✅ VALOR CORREGIDO");
        fetchAuditoria(); // Recargar para recalcular KG Resultantes
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
    const merma = tCPO > 0 ? ((tCPO - (tRBD + tAGL)) / tCPO * 100) : 0;

    const msg = `*📊 RESUMEN GERENCIAL*%0A*ENTRADA CPO:* ${tCPO.toLocaleString()} KG%0A*SALIDA RBD:* ${tRBD.toLocaleString()} KG%0A*PROD AGL:* ${tAGL.toLocaleString()} KG%0A*MERMA:* ${merma.toFixed(2)}%25`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[10px]">
      
      {/* HEADER Y SELECTOR */}
      <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 mb-6 space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-white/5 pb-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-black border border-white/10 px-4 py-2 rounded-xl text-zinc-500 font-black">VOLVER</button>
          
          <div className="flex bg-black p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setModoVista('AUDITORIA')}
              className={`px-4 py-2 rounded-lg transition-all ${modoVista === 'AUDITORIA' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-600'}`}
            >VISTA AUDITORÍA</button>
            <button 
              onClick={() => setModoVista('GERENCIAL')}
              className={`px-4 py-2 rounded-lg transition-all ${modoVista === 'GERENCIAL' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-600'}`}
            >BALANCE GERENCIAL</button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white" />
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white" />
          <button onClick={exportarExcel} className="bg-zinc-800 py-3 rounded-xl font-black">📊 EXCEL</button>
          <button onClick={() => window.print()} className="bg-zinc-800 py-3 rounded-xl font-black">📄 PDF</button>
          <button onClick={enviarWhatsApp} className="bg-emerald-600 py-3 rounded-xl font-black">💬 WHATSAPP</button>
        </div>
      </div>

      {/* TABLA DINAMICA */}
      <div className="bg-zinc-900 rounded-[35px] border border-white/5 overflow-hidden shadow-2xl min-h-[400px]">
        {loading ? (
          <div className="p-20 text-center animate-pulse text-zinc-500 font-black tracking-[0.3em]">PROCESANDO DATOS...</div>
        ) : modoVista === 'AUDITORIA' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-zinc-500 border-b border-white/10 font-black">
                  <th className="p-4 text-[9px]">FECHA / HORA</th>
                  <th className="p-4 text-[9px]">OPERACIÓN</th>
                  <th className="p-4 text-right text-[9px]">L. ANTERIOR</th>
                  <th className="p-4 text-right text-[9px] text-white">L. ACTUAL</th>
                  <th className="p-4 text-right text-orange-500 text-[9px]">KG RESULTANTES</th>
                  <th className="p-4 text-center text-[9px]">EVIDENCIA</th>
                  <th className="p-4 text-center text-[9px]">EDIT</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-white/5 hover:bg-white/5 transition-all">
                    <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-4 font-bold">{r.tipo_operacion}</td>
                    <td className="p-4 text-right text-zinc-600">{r.lecturaAnterior?.toLocaleString()}</td>
                    <td className="p-4 text-right font-bold bg-white/5">{parseFloat(r.valor_lectura || 0).toLocaleString()}</td>
                    <td className="p-4 text-right font-black text-orange-400">{r.kgResultantes?.toLocaleString()}</td>
                    <td className="p-4 text-center">{r.foto_url && <a href={r.foto_url} target="_blank" className="bg-zinc-800 p-2 rounded-lg inline-block">📸</a>}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => editarRegistro(r.id, r.valor_lectura)}
                        className="bg-blue-500/10 p-2 rounded-lg text-blue-500 hover:bg-blue-500 hover:text-white transition-all"
                      >
                        ✏️
                      </button>
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
                  <th className="p-3 text-right">TOTAL ACP (KG)</th>
                  <th className="p-3 text-right">TOTAL RBD (KG)</th>
                  <th className="p-3 text-right text-white">BALANCE CPO</th>
                  <th className="p-3 text-right text-red-500">% MERMA</th>
                </tr>
              </thead>
              <tbody className="text-[10px]">
                {balanceData.map((b, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-blue-500/5 transition-all">
                    <td className="p-3 font-bold">{b.fecha}</td>
                    <td className="p-3 text-right tabular-nums">{(b.total_cpo || 0).toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums text-emerald-400">{(b.total_rbd || 0).toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums font-black text-white">{(b.balance_acp || 0).toLocaleString()}</td>
                    <td className={`p-3 text-right font-black ${b.porcentaje_merma > 1 ? 'text-red-500' : 'text-zinc-500'}`}>
                      {(b.porcentaje_merma || 0).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}