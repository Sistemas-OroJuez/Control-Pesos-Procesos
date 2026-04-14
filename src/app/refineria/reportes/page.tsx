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
        const kg = (reg.tipo_operacion === 'ENTRADA_ACP' || reg.tipo_operacion === 'SALIDA_RBD') 
          ? (lecturaActual - lecturaAnterior) 
          : lecturaActual;
        return { ...reg, lecturaAnterior, kgResultantes: kg };
      });

      setRegistros(procesados.filter(r => {
        const f = r.created_at.split('T')[0];
        return f >= fechaInicio && f <= fechaFin;
      }).reverse());
    }
    setLoading(false);
  };

  const fetchBalanceGerencial = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('reporte_balance_masa').select('*')
      .gte('fecha', fechaInicio).lte('fecha', fechaFin).order('fecha', { ascending: false });
    if (!error) setBalanceData(data || []);
    setLoading(false);
  };

  // --- FUNCIÓN PARA EDITAR CORREGIDA ---
  const editarRegistro = async (id: string, valorActual: any) => {
    const clave = prompt("INGRESE CLAVE DE AUTORIZACIÓN:");
    if (clave !== CLAVE_MAESTRA) return alert("CLAVE INCORRECTA");

    const nuevoValorStr = prompt("NUEVO VALOR DE LECTURA (OCR):", valorActual);
    
    if (nuevoValorStr !== null && nuevoValorStr !== "") {
      const valorNumerico = parseFloat(nuevoValorStr);
      
      if (isNaN(valorNumerico)) {
        return alert("POR FAVOR INGRESE UN NÚMERO VÁLIDO");
      }

      setLoading(true);
      const { error } = await supabase
        .from('operaciones_refineria')
        .update({ valor_lectura: valorNumerico })
        .eq('id', id);

      if (error) {
        alert("ERROR AL GUARDAR: " + error.message);
      } else {
        alert("✅ CAMBIO GUARDADO EN BASE DE DATOS");
        // Forzamos la recarga completa para ver los nuevos KG
        await fetchAuditoria();
      }
      setLoading(false);
    }
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(modoVista === 'AUDITORIA' ? registros : balanceData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_${modoVista}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[10px]">
      
      <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 mb-6 space-y-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-black border border-white/10 px-4 py-2 rounded-xl text-zinc-500 font-black">VOLVER</button>
          <div className="flex bg-black p-1 rounded-xl border border-white/10">
            <button onClick={() => setModoVista('AUDITORIA')} className={`px-4 py-2 rounded-lg transition-all ${modoVista === 'AUDITORIA' ? 'bg-orange-600 text-white' : 'text-zinc-600'}`}>AUDITORÍA</button>
            <button onClick={() => setModoVista('GERENCIAL')} className={`px-4 py-2 rounded-lg transition-all ${modoVista === 'GERENCIAL' ? 'bg-blue-600 text-white' : 'text-zinc-600'}`}>BALANCE GERENCIAL</button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white" />
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white" />
          <button onClick={exportarExcel} className="bg-zinc-800 py-3 rounded-xl font-black">📊 EXCEL</button>
          <button onClick={() => window.print()} className="bg-zinc-800 py-3 rounded-xl font-black">📄 PDF</button>
          <button onClick={() => alert("Función WhatsApp lista")} className="bg-emerald-600 py-3 rounded-xl font-black">💬 WHATSAPP</button>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-[35px] border border-white/5 overflow-hidden shadow-2xl">
        {modoVista === 'AUDITORIA' ? (
          <table className="w-full text-left">
            <thead className="bg-white/5 text-zinc-500 font-black border-b border-white/10">
              <tr>
                <th className="p-4 text-[9px]">FECHA / HORA</th>
                <th className="p-4 text-[9px]">OPERACIÓN</th>
                <th className="p-4 text-right text-[9px]">L. ANTERIOR</th>
                <th className="p-4 text-right text-white text-[9px]">LECTURA ACTUAL</th>
                <th className="p-4 text-right text-orange-500 text-[9px]">KG RESULTANTES</th>
                <th className="p-4 text-center text-[9px]">EVIDENCIA</th>
                <th className="p-4 text-center text-[9px]">EDIT</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-all">
                  <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-4 font-bold">{r.tipo_operacion}</td>
                  <td className="p-4 text-right text-zinc-600">{r.lecturaAnterior?.toLocaleString()}</td>
                  <td className="p-4 text-right font-bold text-white bg-white/5">{parseFloat(r.valor_lectura || 0).toLocaleString()}</td>
                  <td className="p-4 text-right font-black text-orange-400">{r.kgResultantes?.toLocaleString()}</td>
                  <td className="p-4 text-center">{r.foto_url && <a href={r.foto_url} target="_blank" className="text-xl">📸</a>}</td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => editarRegistro(r.id, r.valor_lectura)}
                      className="bg-blue-500/10 p-2 rounded-lg text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-lg"
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-blue-900/20 text-blue-400 font-black border-b border-blue-500/20">
              <tr>
                <th className="p-4">FECHA</th>
                <th className="p-4 text-right">TOTAL CPO</th>
                <th className="p-4 text-right">TOTAL RBD</th>
                <th className="p-4 text-right">AGL PROD.</th>
                <th className="p-4 text-right text-white">BALANCE</th>
                <th className="p-4 text-right text-red-500">% MERMA</th>
              </tr>
            </thead>
            <tbody>
              {balanceData.map((b, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-blue-500/5 transition-colors">
                  <td className="p-4 font-bold">{b.fecha}</td>
                  <td className="p-4 text-right">{(b.total_cpo || 0).toLocaleString()}</td>
                  <td className="p-4 text-right text-emerald-400">{(b.total_rbd || 0).toLocaleString()}</td>
                  <td className="p-4 text-right text-orange-400">{(b.agl_produccion || 0).toLocaleString()}</td>
                  <td className="p-4 text-right font-black text-white">{(b.balance_acp || 0).toLocaleString()}</td>
                  <td className={`p-4 text-right font-black ${b.porcentaje_merma > 1 ? 'text-red-500' : 'text-zinc-500'}`}>
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