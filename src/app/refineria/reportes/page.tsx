'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]);
  
  // FILTROS DE ESTADO
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [filtroProceso, setFiltroProceso] = useState('TODOS');
  const [filtroVariedad, setFiltroVariedad] = useState('TODOS');
  const [filtroProducto, setFiltroProducto] = useState('TODOS');

  const CLAVE_MAESTRA = "orj2026";

  useEffect(() => {
    fetchData();
  }, [fechaInicio, fechaFin, filtroProceso, filtroVariedad, filtroProducto]);

  const fetchData = async () => {
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

        return { 
          ...reg, 
          lecturaAnterior, 
          kgResultantes: kg 
        };
      });

      setRegistros(procesados.filter(r => {
        const f = r.created_at.split('T')[0];
        const matchFecha = f >= fechaInicio && f <= fechaFin;
        return matchFecha;
      }).reverse());
    }
    setLoading(false);
  };

  // --- FUNCIÓN DE EDICIÓN CON ACTUALIZACIÓN FORZADA ---
  const editarRegistro = async (id: string, valorActual: any) => {
    const clave = prompt("🔐 INGRESE CLAVE DE AUTORIZACIÓN:");
    if (clave !== CLAVE_MAESTRA) return alert("❌ CLAVE INCORRECTA");

    const nuevoValorStr = prompt("📝 CORREGIR VALOR DE LECTURA:", valorActual);
    
    if (nuevoValorStr !== null && nuevoValorStr !== "") {
      const valorNumerico = parseFloat(nuevoValorStr);
      
      if (isNaN(valorNumerico)) {
        return alert("⚠️ INGRESE UN NÚMERO VÁLIDO");
      }

      // PASO 1: Actualización visual inmediata (Optimistic Update)
      // Esto hace que el usuario vea el cambio al instante
      setRegistros(prev => prev.map(r => 
        r.id === id ? { ...r, valor_lectura: valorNumerico } : r
      ));

      // PASO 2: Guardar en la base de datos
      const { error } = await supabase
        .from('operaciones_refineria')
        .update({ valor_lectura: valorNumerico })
        .eq('id', id);

      if (error) {
        alert("❌ ERROR EN BASE DE DATOS: " + error.message);
        fetchData(); // Si falla, recargamos los datos originales
      } else {
        alert("✅ REGISTRO ACTUALIZADO");
        // PASO 3: Recargar todo para que los KG RESULTANTES se recalculen
        fetchData();
      }
    }
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(registros);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, "Reporte_Auditoria.xlsx");
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[10px]">
      
      <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 mb-6 space-y-6">
        <h1 className="text-xl font-black text-orange-500">REPORTE DE AUDITORÍA OCR</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[8px] ml-2">INICIO</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[8px] ml-2">FIN</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-white" />
          </div>
          <button onClick={exportarExcel} className="bg-zinc-800 border border-white/5 py-4 rounded-2xl font-black hover:bg-zinc-700 transition-all">📊 EXPORTAR EXCEL</button>
          <button onClick={() => window.print()} className="bg-zinc-800 border border-white/5 py-4 rounded-2xl font-black hover:bg-zinc-700 transition-all">📄 IMPRIMIR PDF</button>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-[35px] border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-zinc-500 border-b border-white/10 font-black">
                <th className="p-4">FECHA / HORA</th>
                <th className="p-4">OPERACIÓN</th>
                <th className="p-4 text-right">L. ANTERIOR</th>
                <th className="p-4 text-right text-white">L. ACTUAL (OCR)</th>
                <th className="p-4 text-right text-orange-500">KG RESULTANTES</th>
                <th className="p-4 text-center">EVIDENCIA</th>
                <th className="p-4 text-center">CORREGIR</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center animate-pulse">CARGANDO DATOS...</td></tr>
              ) : registros.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-zinc-600">NO HAY REGISTROS EN ESTE RANGO</td></tr>
              ) : (
                registros.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-white/5 hover:bg-white/5 transition-all">
                    <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-4 font-bold">{r.tipo_operacion}</td>
                    <td className="p-4 text-right text-zinc-600">{(r.lecturaAnterior || 0).toLocaleString()}</td>
                    <td className="p-4 text-right font-black text-white bg-white/5">
                      {parseFloat(r.valor_lectura || 0).toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-black text-orange-400">
                      {(r.kgResultantes || 0).toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      {r.foto_url && (
                        <a href={r.foto_url} target="_blank" className="bg-zinc-800 p-2 rounded-lg inline-block hover:scale-110 transition-transform">📸</a>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => editarRegistro(r.id, r.valor_lectura)}
                        className="bg-blue-600/20 text-blue-500 p-2 rounded-xl border border-blue-500/30 hover:bg-blue-600 hover:text-white transition-all"
                      >
                        ✏️ EDITAR
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}