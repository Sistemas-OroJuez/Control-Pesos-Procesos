'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReporteRefineria() {
  const [operaciones, setOperaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const cargarDatos = async () => {
    setLoading(true);
    let query = supabase.from('operaciones_refineria').select('*').order('created_at', { ascending: false });
    if (fechaInicio) query = query.gte('created_at', fechaInicio);
    if (fechaFin) query = query.lte('created_at', fechaFin);
    const { data } = await query;
    if (data) setOperaciones(data);
    setLoading(false);
  };

  useEffect(() => { cargarDatos(); }, [fechaInicio, fechaFin]);

  // --- EXPORTAR A EXCEL ---
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(operaciones.map(op => ({
      Fecha: new Date(op.created_at).toLocaleString(),
      Tipo: op.tipo_operacion,
      Valor: op.valor_lectura,
      Masa: op.masa_kg_h,
      Temp: op.temperatura_c,
      Densidad: op.densidad_kg_l,
      Observaciones: op.observaciones
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Refineria");
    XLSX.writeFile(wb, `Reporte_Produccion_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // --- EXPORTAR A PDF ---
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("REPORTE DE PRODUCCIÓN - REFINERÍA", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Fecha', 'Operación', 'Valor (kg)', 'Obs']],
      body: operaciones.map(op => [
        new Date(op.created_at).toLocaleDateString(),
        op.tipo_operacion,
        op.valor_lectura.toLocaleString(),
        op.observaciones || ''
      ]),
    });
    doc.save(`Reporte_Produccion_${Date.now()}.pdf`);
  };

  // --- ENVIAR POR WHATSAPP ---
  const sendWhatsApp = () => {
    const tACP = operaciones.filter(o => o.tipo_operacion === 'INGRESO_ACP').reduce((acc, curr) => acc + curr.valor_lectura, 0);
    const tRBD = operaciones.filter(o => o.tipo_operacion === 'SALIDA_RBD').reduce((acc, curr) => acc + curr.valor_lectura, 0);
    
    const mensaje = `*REPORTE REFINERÍA*%0A------------------%0A*Total ACP:* ${tACP.toLocaleString()} kg%0A*Total RBD:* ${tRBD.toLocaleString()} kg%0A*Fecha:* ${new Date().toLocaleDateString()}%0A------------------%0AVer detalle en la App.`;
    window.open(`https://wa.me/?text=${mensaje}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-black text-gray-900 italic uppercase">Dashboard de Control</h1>
          
          {/* BOTONES DE EXPORTACIÓN */}
          <div className="flex gap-2">
            <button onClick={exportToExcel} className="bg-green-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-800 transition-all">Excel</button>
            <button onClick={exportToPDF} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-700 transition-all">PDF</button>
            <button onClick={sendWhatsApp} className="bg-green-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-600 transition-all">WhatsApp</button>
          </div>
        </div>

        {/* FILTROS (Igual que antes) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm flex flex-wrap gap-4 items-end border border-gray-200">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase">Desde:</label>
            <input type="date" onChange={(e) => setFechaInicio(e.target.value)} className="border-2 border-gray-100 p-2 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase">Hasta:</label>
            <input type="date" onChange={(e) => setFechaFin(e.target.value)} className="border-2 border-gray-100 p-2 rounded-xl text-sm" />
          </div>
          <button onClick={cargarDatos} className="bg-black text-white px-6 py-2 rounded-xl font-bold uppercase text-[10px]">Filtrar</button>
        </div>

        {/* TABLA DE AUDITORÍA CON FOTOS */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-900 text-white">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase">Fecha</th>
                  <th className="p-4 text-[10px] font-black uppercase">Tipo</th>
                  <th className="p-4 text-[10px] font-black uppercase">Foto (Evidencia OCR)</th>
                  <th className="p-4 text-[10px] font-black uppercase text-right">Lectura</th>
                  <th className="p-4 text-[10px] font-black uppercase text-center">Auditoría</th>
                </tr>
              </thead>
              <tbody>
                {operaciones.map((op) => (
                  <tr key={op.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                    <td className="p-4 text-[10px] font-bold text-gray-500">{new Date(op.created_at).toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`text-[8px] font-black px-2 py-1 rounded-md text-white ${op.tipo_operacion.includes('INGRESO') ? 'bg-blue-600' : 'bg-green-600'}`}>
                        {op.tipo_operacion}
                      </span>
                    </td>
                    <td className="p-4">
                      {op.foto_url ? (
                        <div className="group relative w-20 h-12">
                          <img src={op.foto_url} className="w-full h-full object-cover rounded border border-gray-300 shadow-sm" />
                          <div className="hidden group-hover:block absolute z-50 -top-40 left-0 w-64 h-40 bg-white border-2 border-black rounded-lg shadow-2xl overflow-hidden">
                            <img src={op.foto_url} className="w-full h-full object-contain bg-black" />
                          </div>
                        </div>
                      ) : <span className="text-gray-300 italic text-[10px]">No foto</span>}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-gray-800 text-lg">
                      {op.valor_lectura.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={async () => {
                          const val = prompt("Corregir valor según foto:", op.valor_lectura);
                          if(val) {
                            await supabase.from('operaciones_refineria').update({ valor_lectura: parseFloat(val), observaciones: 'OCR CORREGIDO' }).eq('id', op.id);
                            cargarDatos();
                          }
                        }}
                        className="bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 p-2 rounded-lg transition-colors"
                        title="Corregir error del OCR"
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
    </div>
  );
}