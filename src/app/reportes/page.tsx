'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function ReporteGeneral() {
  const router = useRouter();
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [filtros, setFiltros] = useState({
    fechaDesde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fechaHasta: new Date().toISOString().split('T')[0]
  });

  useEffect(() => { consultar(); }, []);

  async function consultar() {
    setLoading(true);
    // Traemos TODOS los campos explícitamente para asegurar los links
    const { data } = await supabase
      .from('procesos_batch')
      .select(`
        id, created_at, batch_id, peso_final_digitado, observaciones,
        foto_visor_inicio, foto_tanque_vacio, foto_visor_final, foto_observacion,
        variedad, proveedor, turno,
        operadores (nombre, sitios (nombre))
      `)
      .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
      .lte('created_at', `${filtros.fechaHasta}T23:59:59`)
      .order('created_at', { ascending: false });

    if (data) setDatos(data);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white p-6 rounded-3xl shadow-lg border-b-8 border-red-700 mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-black text-red-700 uppercase italic">Reporte General de Pesajes</h1>
          <div className="flex gap-2">
            <button onClick={() => {/* Excel Logic */}} className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase">Exportar Excel</button>
            <button onClick={() => router.push('/dashboard')} className="bg-gray-200 px-4 py-2 rounded-xl font-bold text-xs uppercase text-gray-600">Volver</button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-800 text-white text-[10px] uppercase font-black">
              <tr>
                <th className="p-4">Batch / Fecha</th>
                <th className="p-4">Sitio / Operador</th>
                <th className="p-4 text-center">Auditoría Visual (FOTOS)</th>
                <th className="p-4 text-right">Peso Kg</th>
                <th className="p-4">Novedad / Justificación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {datos.map((reg) => (
                <tr key={reg.id} className="hover:bg-red-50 transition-colors">
                  <td className="p-4">
                    <p className="font-black text-red-700 text-base">#{reg.batch_id}</p>
                    <p className="text-[10px] text-gray-400 font-bold">{new Date(reg.created_at).toLocaleString()}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-black text-gray-800 uppercase">{reg.operadores?.sitios?.nombre}</p>
                    <p className="text-[10px] text-gray-500 font-bold">{reg.operadores?.nombre} • {reg.turno}</p>
                  </td>
                  
                  {/* NOMENCLATURA SOLICITADA */}
                  <td className="p-4">
                    <div className="flex gap-2 justify-center">
                      {reg.foto_visor_inicio && (
                        <a href={reg.foto_visor_inicio} target="_blank" className="bg-blue-600 hover:bg-blue-800 text-white px-3 py-2 rounded-lg font-black text-[9px] uppercase shadow-md transition-all">Visor 0</a>
                      )}
                      {reg.foto_tanque_vacio && (
                        <a href={reg.foto_tanque_vacio} target="_blank" className="bg-blue-600 hover:bg-blue-800 text-white px-3 py-2 rounded-lg font-black text-[9px] uppercase shadow-md transition-all">Tq Vacio</a>
                      )}
                      {reg.foto_visor_final && (
                        <a href={reg.foto_visor_final} target="_blank" className="bg-blue-600 hover:bg-blue-800 text-white px-3 py-2 rounded-lg font-black text-[9px] uppercase shadow-md transition-all">Visor con Peso</a>
                      )}
                    </div>
                  </td>

                  <td className="p-4 text-right">
                    <p className="text-xl font-black text-red-700">{reg.peso_final_digitado} <span className="text-xs">kg</span></p>
                  </td>

                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] text-gray-500 italic max-w-[150px]">{reg.observaciones || '-'}</p>
                      {reg.foto_observacion && (
                        <a href={reg.foto_observacion} target="_blank" className="text-orange-600 font-black text-[9px] underline uppercase">Justificación Novedad</a>
                      )}
                    </div>
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