'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReporteRefineria() {
  const [operaciones, setOperaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroProducto, setFiltroProducto] = useState('TODOS');
  const [filtroOperador, setFiltroOperador] = useState('');
  const [filtroLocalidad, setFiltroLocalidad] = useState('TODOS');

  const cargarDatos = async () => {
    setLoading(true);
    let query = supabase.from('operaciones_refineria').select('*').order('created_at', { ascending: false });

    if (fechaInicio) query = query.gte('created_at', fechaInicio);
    if (fechaFin) query = query.lte('created_at', fechaFin);
    if (filtroProducto !== 'TODOS') query = query.eq('tipo_operacion', filtroProducto);
    if (filtroOperador) query = query.ilike('usuario_registro', `%${filtroOperador}%`);
    // Si manejas localidad en metadata o columna específica:
    // if (filtroLocalidad !== 'TODOS') query = query.eq('localidad', filtroLocalidad);

    const { data } = await query;
    if (data) setOperaciones(data);
    setLoading(false);
  };

  useEffect(() => { cargarDatos(); }, [fechaInicio, fechaFin, filtroProducto, filtroLocalidad]);

  const handleCorregir = async (op: any) => {
    const password = prompt("AUTORIZACIÓN REQUERIDA: Ingrese clave de administrador:");
    if (password !== 'orj2026') {
      alert("Acceso denegado.");
      return;
    }

    const nuevoValor = prompt(`Corregir valor para ${op.tipo_operacion}:`, op.valor_lectura);
    if (nuevoValor && !isNaN(parseFloat(nuevoValor))) {
      const { error } = await supabase
        .from('operaciones_refineria')
        .update({ 
          valor_lectura: parseFloat(nuevoValor), 
          observaciones: `${op.observaciones || ''} [CORREGIDO POR ADMIN]` 
        })
        .eq('id', op.id);
      
      if (!error) {
        alert("Dato actualizado correctamente.");
        cargarDatos();
      }
    }
  };

  // Cálculos de Subtotales por producto
  const calcularSubtotal = (tipo: string) => 
    operaciones.filter(o => o.tipo_operacion === tipo).reduce((acc, curr) => acc + curr.valor_lectura, 0);

  // --- EXPORTACIÓN ---
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(operaciones.map(o => ({
      Fecha: new Date(o.created_at).toLocaleString(),
      Producto: o.tipo_operacion,
      Lectura: o.valor_lectura,
      Operador: o.usuario_registro,
      Obs: o.observaciones
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, "Reporte_Produccion.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-b-4 border-slate-800">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic">Auditoría de Producción</h1>
            <p className="text-[10px] font-bold text-gray-400">CONTROL DE FLUJÓMETROS E INVENTARIOS</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase">Excel</button>
            <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase">PDF / Imprimir</button>
          </div>
        </header>

        {/* PANEL DE FILTROS */}
        <div className="bg-white p-4 rounded-2xl shadow-sm grid grid-cols-2 md:grid-cols-5 gap-3 border border-gray-200">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase">Producto</label>
            <select value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)} className="w-full border-2 border-gray-100 rounded-lg p-2 text-xs font-bold">
              <option value="TODOS">TODOS</option>
              <option value="INGRESO_ACP">INGRESO ACP</option>
              <option value="SALIDA_RBD">SALIDA RBD</option>
              <option value="SALIDA_FATTY_ACID">ÁCIDO GRASO</option>
              <option value="INVENTARIO_PROCESO">INVENTARIO</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase">Operador</label>
            <input type="text" placeholder="Nombre..." value={filtroOperador} onChange={(e) => setFiltroOperador(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && cargarDatos()} className="w-full border-2 border-gray-100 rounded-lg p-2 text-xs" />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase">Localidad</label>
            <select value={filtroLocalidad} onChange={(e) => setFiltroLocalidad(e.target.value)} className="w-full border-2 border-gray-100 rounded-lg p-2 text-xs font-bold">
              <option value="TODOS">TODAS</option>
              <option value="REFINERIA">REFINERÍA</option>
              <option value="EXTRACTORA">EXTRACTORA</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase">Desde</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full border-2 border-gray-100 rounded-lg p-2 text-xs" />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase">Hasta</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full border-2 border-gray-100 rounded-lg p-2 text-xs" />
          </div>
        </div>

        {/* RESUMEN DE SUB-TOTALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-xl">
            <p className="text-[10px] font-black text-blue-600 uppercase">Subtotal ACP</p>
            <p className="text-2xl font-black text-blue-900">{calcularSubtotal('INGRESO_ACP').toLocaleString()} kg</p>
          </div>
          <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-xl">
            <p className="text-[10px] font-black text-green-600 uppercase">Subtotal RBD</p>
            <p className="text-2xl font-black text-green-900">{calcularSubtotal('SALIDA_RBD').toLocaleString()} kg</p>
          </div>
          <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded-xl">
            <p className="text-[10px] font-black text-purple-600 uppercase">Subtotal Ácido Graso</p>
            <p className="text-2xl font-black text-purple-900">{calcularSubtotal('SALIDA_FATTY_ACID').toLocaleString()} kg</p>
          </div>
        </div>

        {/* TABLA DE DATOS */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[9px] tracking-widest">
              <tr>
                <th className="p-4">Fecha/Hora</th>
                <th className="p-4">Producto</th>
                <th className="p-4">Operador</th>
                <th className="p-4 text-center">Evidencia</th>
                <th className="p-4 text-right">Lectura (kg)</th>
                <th className="p-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {operaciones.map((op) => (
                <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-gray-500">{new Date(op.created_at).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md font-black text-[9px] text-white ${
                      op.tipo_operacion === 'INGRESO_ACP' ? 'bg-blue-600' : 
                      op.tipo_operacion === 'SALIDA_RBD' ? 'bg-green-600' : 'bg-purple-600'
                    }`}>
                      {op.tipo_operacion}
                    </span>
                  </td>
                  <td className="p-4 font-medium">{op.usuario_registro}</td>
                  <td className="p-4 text-center">
                    {op.foto_url ? (
                      <a href={op.foto_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold text-[10px]">
                        📄 VER FOTO
                      </a>
                    ) : <span className="text-gray-300">N/A</span>}
                  </td>
                  <td className="p-4 text-right font-mono font-black text-base text-slate-800">
                    {op.valor_lectura.toLocaleString()}
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleCorregir(op)}
                      className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-600 transition-colors"
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}