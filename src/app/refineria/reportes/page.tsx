'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function ReporteRefineria() {
  const [operaciones, setOperaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroProducto, setFiltroProducto] = useState('TODOS');

  const cargarDatos = async () => {
    setLoading(true);
    // Traemos todos los datos para poder calcular los diferenciales correctamente
    let query = supabase.from('operaciones_refineria')
      .select('*')
      .order('created_at', { ascending: true }); // Ascendente para calcular el delta linealmente

    const { data } = await query;
    
    if (data) {
      // LÓGICA DE EXCEL: Calcular diferencial respecto a la lectura anterior por producto
      const procesados = data.map((lectura, index, array) => {
        // Buscamos la lectura anterior del MISMO tipo de operación
        const lecturaAnterior = array
          .slice(0, index)
          .reverse()
          .find(item => item.tipo_operacion === lectura.tipo_operacion);

        const diferencial = lecturaAnterior 
          ? lectura.valor_lectura - lecturaAnterior.valor_lectura 
          : 0; // La primera lectura del histórico es el punto cero

        return {
          ...lectura,
          consumo_periodo: diferencial > 0 ? diferencial : 0 // Evitamos negativos si resetearon el contador
        };
      });

      // Aplicar filtros de fecha y producto después de calcular deltas
      let filtrados = [...procesados].reverse(); // Revertir para mostrar lo más nuevo arriba

      if (fechaInicio) filtrados = filtrados.filter(f => f.created_at >= fechaInicio);
      if (fechaFin) filtrados = filtrados.filter(f => f.created_at <= fechaFin);
      if (filtroProducto !== 'TODOS') filtrados = filtrados.filter(f => f.tipo_operacion === filtroProducto);

      setOperaciones(filtrados);
    }
    setLoading(false);
  };

  useEffect(() => { cargarDatos(); }, [fechaInicio, fechaFin, filtroProducto]);

  // Subtotales basados en el diferencial (Consumo Real)
  const calcularTotalReal = (tipo: string) => 
    operaciones.filter(o => o.tipo_operacion === tipo).reduce((acc, curr) => acc + curr.consumo_periodo, 0);

  const handleCorregir = async (op: any) => {
    const password = prompt("CLAVE ADMIN:");
    if (password !== 'orj2026') return alert("Error");
    const nuevo = prompt("Valor correcto del contador:", op.valor_lectura);
    if (nuevo) {
      await supabase.from('operaciones_refineria').update({ valor_lectura: parseFloat(nuevo) }).eq('id', op.id);
      cargarDatos();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-7xl mx-auto space-y-4">
        
        <header className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-slate-900 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black italic uppercase italic">Balance de Masas</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cálculo por Diferencial de Contadores</p>
          </div>
          <button onClick={cargarDatos} className="bg-slate-800 text-white px-6 py-2 rounded-xl text-[10px] font-black">ACTUALIZAR</button>
        </header>

        {/* SELECTORES */}
        <div className="bg-white p-4 rounded-xl shadow-sm flex gap-4">
          <select value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)} className="border-2 p-2 rounded-lg text-xs font-bold">
            <option value="TODOS">TODOS LOS PRODUCTOS</option>
            <option value="INGRESO_ACP">INGRESO ACP</option>
            <option value="SALIDA_RBD">SALIDA RBD</option>
            <option value="SALIDA_FATTY_ACID">ÁCIDO GRASO</option>
          </select>
          <input type="date" onChange={(e) => setFechaInicio(e.target.value)} className="border-2 p-2 rounded-lg text-xs" />
          <input type="date" onChange={(e) => setFechaFin(e.target.value)} className="border-2 p-2 rounded-lg text-xs" />
        </header>

        {/* TARJETAS DE PRODUCCIÓN REAL (Deltas) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg">
            <span className="text-[10px] font-black opacity-60 uppercase">ACP Procesado (Δ)</span>
            <p className="text-3xl font-black">{calcularTotalReal('INGRESO_ACP').toLocaleString()} <span className="text-sm">kg</span></p>
          </div>
          <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-lg">
            <span className="text-[10px] font-black opacity-60 uppercase">RBD Producido (Δ)</span>
            <p className="text-3xl font-black">{calcularTotalReal('SALIDA_RBD').toLocaleString()} <span className="text-sm">kg</span></p>
          </div>
          <div className="bg-purple-700 p-4 rounded-2xl text-white shadow-lg">
            <span className="text-[10px] font-black opacity-60 uppercase">Ácido Recuperado (Δ)</span>
            <p className="text-3xl font-black">{calcularTotalReal('SALIDA_FATTY_ACID').toLocaleString()} <span className="text-sm">kg</span></p>
          </div>
        </div>

        {/* TABLA DETALLADA */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-tighter">
              <tr>
                <th className="p-4">Fecha/Hora</th>
                <th className="p-4">Producto</th>
                <th className="p-4">Lectura Contador</th>
                <th className="p-4 text-emerald-500">Diferencial (Neto)</th>
                <th className="p-4">Evidencia</th>
                <th className="p-4">Auditar</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y">
              {operaciones.map((op) => (
                <tr key={op.id} className="hover:bg-gray-50">
                  <td className="p-4 font-bold text-gray-500">{new Date(op.created_at).toLocaleString()}</td>
                  <td className="p-4">
                    <span className="font-black text-[9px]">{op.tipo_operacion}</span>
                  </td>
                  <td className="p-4 font-mono text-gray-400">{op.valor_lectura.toLocaleString()}</td>
                  <td className="p-4 font-black text-base text-emerald-600">
                    +{op.consumo_periodo.toLocaleString()} kg
                  </td>
                  <td className="p-4">
                    {op.foto_url && (
                      <a href={op.foto_url} target="_blank" className="text-[9px] bg-gray-100 p-1 px-2 rounded font-bold hover:bg-black hover:text-white transition-all">VER FOTO</a>
                    )}
                  </td>
                  <td className="p-4">
                    <button onClick={() => handleCorregir(op)} className="opacity-30 hover:opacity-100 transition-opacity">✏️</button>
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