'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function ReporteRefineria() {
  const [operaciones, setOperaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroProducto, setFiltroProducto] = useState('TODOS');

  const cargarDatos = async () => {
    setLoading(true);
    // Traemos todo o historial para calcular correctamente os diferenciais
    let query = supabase
      .from('operaciones_refineria')
      .select('*')
      .order('created_at', { ascending: true });

    const { data, error } = await query;
    
    if (data) {
      // LÓXICA DE EXCEL: Calcular o neto (Delta) entre lecturas consecutivas por produto
      const procesados = data.map((lectura, index, array) => {
        // Buscamos a lectura anterior do MESMO tipo de operación
        const lecturaAnterior = array
          .slice(0, index)
          .reverse()
          .find(item => item.tipo_operacion === lectura.tipo_operacion);

        // Se existe lectura anterior, restamos. Se non, o neto é 0 (inicio de conteo)
        const diferencial = lecturaAnterior 
          ? lectura.valor_lectura - lecturaAnterior.valor_lectura 
          : 0;

        return {
          ...lectura,
          consumo_periodo: diferencial >= 0 ? diferencial : 0 
        };
      });

      // Aplicamos os filtros de usuario sobre os datos procesados
      let filtrados = [...procesados].reverse(); // O máis novo arriba para a táboa

      if (fechaInicio) filtrados = filtrados.filter(f => f.created_at >= fechaInicio);
      if (fechaFin) filtrados = filtrados.filter(f => f.created_at <= `${fechaFin}T23:59:59`);
      if (filtroProducto !== 'TODOS') filtrados = filtrados.filter(f => f.tipo_operacion === filtroProducto);

      setOperaciones(filtrados);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, fechaFin, filtroProducto]);

  // Totais Reais baseados na suma de diferenciais (Neto)
  const calcularTotalNeto = (tipo: string) => 
    operaciones.filter(o => o.tipo_operacion === tipo).reduce((acc, curr) => acc + curr.consumo_periodo, 0);

  const handleCorregir = async (op: any) => {
    const password = prompt("AUTORIZACIÓN: Ingrese clave de administrador:");
    if (password !== 'orj2026') {
      alert("Acceso denegado.");
      return;
    }

    const nuevoValor = prompt(`Corregir lectura do contador para ${op.tipo_operacion}:`, op.valor_lectura);
    if (nuevoValor && !isNaN(parseFloat(nuevoValor))) {
      const { error } = await supabase
        .from('operaciones_refineria')
        .update({ 
          valor_lectura: parseFloat(nuevoValor), 
          observaciones: `${op.observaciones || ''} [CORREXIÓN ADMIN]` 
        })
        .eq('id', op.id);
      
      if (!error) {
        alert("Lectura actualizada.");
        cargarDatos();
      }
    }
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(operaciones.map(o => ({
      Fecha: new Date(o.created_at).toLocaleString(),
      Producto: o.tipo_operacion,
      Lectura_Contador: o.valor_lectura,
      Neto_Procesado: o.consumo_periodo,
      Operador: o.usuario_registro,
      Observaciones: o.observaciones
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Balance_Refineria");
    XLSX.writeFile(wb, `Reporte_Produccion_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* CABECEIRA */}
        <header className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black italic uppercase italic text-slate-800">Balance de Masas</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center md:text-left">Cálculo por Diferencial de Contadores</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="bg-green-700 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-800 transition-all">Excel</button>
            <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all">PDF / Imprimir</button>
          </div>
        </header>

        {/* FILTROS */}
        <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 border border-gray-200">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase mb-1">Producto</label>
            <select value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)} className="border-2 p-2 rounded-lg text-xs font-bold outline-none focus:border-slate-500">
              <option value="TODOS">TODOS OS PRODUCTOS</option>
              <option value="INGRESO_ACP">INGRESO ACP</option>
              <option value="SALIDA_RBD">SALIDA RBD</option>
              <option value="SALIDA_FATTY_ACID">ÁCIDO GRASO</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase mb-1">Desde</label>
            <input type="date" onChange={(e) => setFechaInicio(e.target.value)} className="border-2 p-2 rounded-lg text-xs outline-none focus:border-slate-500" />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase mb-1">Hasta</label>
            <input type="date" onChange={(e) => setFechaFin(e.target.value)} className="border-2 p-2 rounded-lg text-xs outline-none focus:border-slate-500" />
          </div>
        </div>

        {/* TARJETAS DE PRODUCCIÓN REAL (Suma de deltas) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-600 p-5 rounded-2xl text-white shadow-lg">
            <span className="text-[10px] font-black opacity-60 uppercase">ACP Procesado (Total Δ)</span>
            <p className="text-3xl font-black">{calcularTotalNeto('INGRESO_ACP').toLocaleString()} <span className="text-sm">kg</span></p>
          </div>
          <div className="bg-emerald-600 p-5 rounded-2xl text-white shadow-lg">
            <span className="text-[10px] font-black opacity-60 uppercase">RBD Producido (Total Δ)</span>
            <p className="text-3xl font-black">{calcularTotalNeto('SALIDA_RBD').toLocaleString()} <span className="text-sm">kg</span></p>
          </div>
          <div className="bg-purple-700 p-5 rounded-2xl text-white shadow-lg">
            <span className="text-[10px] font-black opacity-60 uppercase">Ácido Recuperado (Total Δ)</span>
            <p className="text-3xl font-black">{calcularTotalNeto('SALIDA_FATTY_ACID').toLocaleString()} <span className="text-sm">kg</span></p>
          </div>
        </div>

        {/* TÁBOA DETALLADA */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-tighter">
                <tr>
                  <th className="p-4">Fecha/Hora</th>
                  <th className="p-4">Producto</th>
                  <th className="p-4">Lectura Contador</th>
                  <th className="p-4 text-emerald-400">Neto (Delta)</th>
                  <th className="p-4">Operador</th>
                  <th className="p-4 text-center">Evidencia</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-gray-100 bg-white">
                {operaciones.map((op) => (
                  <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-400">{new Date(op.created_at).toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[8px] font-black text-white ${
                        op.tipo_operacion === 'INGRESO_ACP' ? 'bg-blue-600' : 
                        op.tipo_operacion === 'SALIDA_RBD' ? 'bg-emerald-600' : 'bg-purple-600'
                      }`}>
                        {op.tipo_operacion}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-gray-400">{op.valor_lectura.toLocaleString()}</td>
                    <td className="p-4 font-black text-base text-emerald-600">
                      +{op.consumo_periodo.toLocaleString()} kg
                    </td>
                    <td className="p-4 font-medium text-gray-700">{op.usuario_registro}</td>
                    <td className="p-4 text-center">
                      {op.foto_url ? (
                        <a href={op.foto_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-blue-600 hover:underline">
                          📄 VER FOTO
                        </a>
                      ) : <span className="text-gray-200">-</span>}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleCorregir(op)}
                        className="p-2 hover:bg-red-50 rounded-full text-slate-300 hover:text-red-600 transition-colors"
                        title="Corregir valor"
                      >
                        ✏️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {operaciones.length === 0 && !loading && (
            <div className="p-10 text-center text-gray-400 font-bold uppercase text-xs">
              Non se atoparon rexistros para este filtro
            </div>
          )}
        </div>

      </div>
      <footer className="mt-8 text-center pb-10">
        <p className="text-[9px] text-gray-300 font-black uppercase tracking-[0.4em]">SISTEMA DE AUDITORÍA OROJUEZ - REFINERÍA</p>
      </footer>
    </div>
  );
}