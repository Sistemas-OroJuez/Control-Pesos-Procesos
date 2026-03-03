'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReporteGeneral() {
  const router = useRouter();
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const getPrimerDiaMes = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };

  const [filtros, setFiltros] = useState({
    fechaDesde: getPrimerDiaMes(),
    fechaHasta: new Date().toISOString().split('T')[0],
    localidad: ''
  });

  const [localidades, setLocalidades] = useState<any[]>([]);

  useEffect(() => {
    fetchInicial();
  }, []);

  async function fetchInicial() {
    const { data: locs } = await supabase.from('localidades').select('*').order('nombre');
    if (locs) setLocalidades(locs);
    consultar();
  }

  async function consultar() {
    setLoading(true);
    // IMPORTANTE: Asegúrate que estos nombres (foto_visor_inicio, etc) sean los de tu tabla
    const { data, error } = await supabase
      .from('procesos_batch')
      .select(`
        *,
        operadores (
          nombre,
          sitios (nombre, localidad_id, localidades (nombre))
        )
      `)
      .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
      .lte('created_at', `${filtros.fechaHasta}T23:59:59`)
      .order('created_at', { ascending: false });

    if (data) {
      const filtrados = filtros.localidad 
        ? data.filter(i => i.operadores?.sitios?.localidad_id === filtros.localidad)
        : data;
      setDatos(filtrados);
    }
    setLoading(false);
  }

  // --- BOTONES DE EXPORTACIÓN ---
  const exportarExcel = () => {
    const excelData = datos.map(r => ({
      "Fecha/Hora": new Date(r.created_at).toLocaleString(),
      "Batch #": r.batch_id,
      "Sitio": r.operadores?.sitios?.nombre,
      "Operador": r.operadores?.nombre,
      "Peso (Kg)": r.peso_final_digitado,
      "Visor 0": r.foto_visor_inicio,
      "Tq Vacio": r.foto_tanque_vacio,
      "Visor con Peso": r.foto_visor_final,
      "Novedad": r.observaciones,
      "Foto Justificacion": r.foto_observacion
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_Pesajes_${filtros.fechaDesde}.xlsx`);
  };

  const exportarPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.text("REPORTE GENERAL DE PESAJES", 14, 15);
    autoTable(doc, {
      head: [['Batch', 'Fecha', 'Sitio', 'Operador', 'Peso Kg', 'Observación']],
      body: datos.map(r => [r.batch_id, new Date(r.created_at).toLocaleDateString(), r.operadores?.sitios?.nombre, r.operadores?.nombre, r.peso_final_digitado, r.observaciones]),
      startY: 20,
      headStyles: { fillColor: [185, 28, 28] }
    });
    doc.save("Reporte.pdf");
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* BARRA SUPERIOR CON BOTONES DE EXPORTACIÓN */}
      <nav className="bg-white p-4 shadow-md border-b-4 border-red-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-100 rounded-xl font-bold text-[10px]">← VOLVER</button>
            <h1 className="text-red-700 font-black uppercase text-sm">Reporte de Auditoría</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={exportarExcel} className="bg-green-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-sm">Excel</button>
            <button onClick={exportarPDF} className="bg-gray-800 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-sm">PDF</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4">
        {/* FILTROS */}
        <div className="bg-white p-6 rounded-3xl shadow-sm mb-4 flex flex-wrap gap-4 items-end border">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-gray-400">FECHA DESDE</label>
            <input type="date" className="p-3 border-2 rounded-xl font-bold text-xs" value={filtros.fechaDesde} onChange={e => setFiltros({...filtros, fechaDesde: e.target.value})} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-gray-400">FECHA HASTA</label>
            <input type="date" className="p-3 border-2 rounded-xl font-bold text-xs" value={filtros.fechaHasta} onChange={e => setFiltros({...filtros, fechaHasta: e.target.value})} />
          </div>
          <button onClick={consultar} className="bg-red-700 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] h-[48px]">Actualizar Reporte</button>
        </div>

        {/* TABLA DE RESULTADOS CON LINKS */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden border">
          <table className="w-full text-[10px] border-collapse">
            <thead className="bg-gray-50 text-gray-500 font-black uppercase">
              <tr>
                <th className="p-4 text-left border-b">Batch / Fecha</th>
                <th className="p-4 text-left border-b">Sitio / Operador</th>
                <th className="p-4 text-center border-b">Fotos Auditoría (Links)</th>
                <th className="p-4 text-right border-b">Peso Registrado</th>
                <th className="p-4 text-left border-b">Novedad / Justificación</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {datos.map(reg => (
                <tr key={reg.id} className="hover:bg-red-50 transition-colors">
                  <td className="p-4 border-b">
                    <p className="text-red-700 font-black text-sm">#{reg.batch_id}</p>
                    <p className="text-gray-400 font-bold">{new Date(reg.created_at).toLocaleString()}</p>
                  </td>
                  <td className="p-4 border-b">
                    <p className="font-black text-gray-800 uppercase">{reg.operadores?.sitios?.nombre}</p>
                    <p className="text-gray-500 font-bold">{reg.operadores?.nombre}</p>
                  </td>
                  
                  {/* AQUÍ ESTÁN LOS BOTONES CON TU NOMENCLATURA */}
                  <td className="p-4 border-b">
                    <div className="flex gap-1 justify-center">
                      {reg.foto_visor_inicio && <a href={reg.foto_visor_inicio} target="_blank" className="bg-blue-600 text-white px-2 py-1.5 rounded-lg font-black text-[9px] uppercase shadow-sm">Visor 0</a>}
                      {reg.foto_tanque_vacio && <a href={reg.foto_tanque_vacio} target="_blank" className="bg-blue-600 text-white px-2 py-1.5 rounded-lg font-black text-[9px] uppercase shadow-sm">Tq Vacio</a>}
                      {reg.foto_visor_final && <a href={reg.foto_visor_final} target="_blank" className="bg-blue-600 text-white px-2 py-1.5 rounded-lg font-black text-[9px] uppercase shadow-sm">Visor con Peso</a>}
                    </div>
                  </td>
                  
                  <td className="p-4 text-right border-b">
                    <p className="text-lg font-black text-red-700">{reg.peso_final_digitado} <span className="text-[10px]">kg</span></p>
                  </td>
                  
                  {/* NOVEDAD Y FOTO JUSTIFICACION */}
                  <td className="p-4 border-b">
                    <div className="flex flex-col gap-1">
                      <p className="text-gray-500 italic truncate max-w-[150px]">{reg.observaciones || 'Sin observaciones'}</p>
                      {reg.foto_observacion && (
                        <a href={reg.foto_observacion} target="_blank" className="text-orange-600 font-black text-[9px] underline uppercase">Ver Justificación Novedad</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos.length === 0 && <div className="p-20 text-center font-black text-gray-300 uppercase tracking-widest">No hay datos en el rango seleccionado</div>}
        </div>
      </main>
    </div>
  );
}