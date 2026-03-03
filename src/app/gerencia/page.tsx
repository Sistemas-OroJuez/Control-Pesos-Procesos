'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ReporteGerencial() {
  const router = useRouter();
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { consultar(); }, []);

  async function consultar() {
    setLoading(true);
    const { data } = await supabase
      .from('procesos_batch')
      .select(`*, operadores (nombre, sitios (nombre))`)
      .order('created_at', { ascending: true });

    if (data) {
      const conLapsos = data.map((curr, i) => {
        // Tiempo del Batch: desde que inició (o el anterior terminó) hasta que pesó
        const tBatch = i > 0 ? calcularMinutos(data[i-1].created_at, curr.created_at) : "0:00";
        // Tiempo entre Batch: (Asumiendo lógica de flujo continuo)
        const tEntre = i > 0 ? calcularMinutos(data[i-1].created_at, curr.created_at) : "N/A";
        return { ...curr, tBatch, tEntre };
      });
      setDatos(conLapsos.reverse());
    }
    setLoading(false);
  }

  function calcularMinutos(inicio: string, fin: string) {
    const diff = new Date(fin).getTime() - new Date(inicio).getTime();
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-2xl border-b-8 border-red-700 mb-6 flex justify-between items-center">
          <h1 className="text-xl font-black uppercase italic tracking-tighter text-red-500">Eficiencia Gerencial</h1>
          <button className="bg-green-500 text-white px-6 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg">📲 Enviar por WhatsApp</button>
        </div>

        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden">
          <table className="w-full text-[10px]">
            <thead className="bg-slate-200 text-slate-600 font-black uppercase">
              <tr>
                <th className="p-4">Batch</th>
                <th className="p-4">Sitio / Op</th>
                <th className="p-4 text-center bg-blue-50 text-blue-800 tracking-widest">⏱ Lapso Batch</th>
                <th className="p-4 text-center bg-orange-50 text-orange-800 tracking-widest">⌛ Entre Batches</th>
                <th className="p-4 text-right">Peso</th>
                <th className="p-4 text-center">Auditoría Fotos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datos.map((reg) => (
                <tr key={reg.id} className="hover:bg-slate-50">
                  <td className="p-4 font-black">#{reg.batch_id}</td>
                  <td className="p-4 font-bold uppercase">{reg.operadores?.sitios?.nombre}</td>
                  <td className="p-4 text-center font-black text-blue-600 bg-blue-50/20">{reg.tBatch} min</td>
                  <td className="p-4 text-center font-black text-orange-600 bg-orange-50/20">{reg.tEntre} min</td>
                  <td className="p-4 text-right font-black text-red-700 text-base">{reg.peso_final_digitado}</td>
                  <td className="p-4">
                    <div className="flex gap-1 justify-center">
                       <a href={reg.foto_visor_inicio} target="_blank" className="bg-blue-600 text-white p-1 px-2 rounded font-black text-[8px] uppercase">Visor 0</a>
                       <a href={reg.foto_visor_final} target="_blank" className="bg-blue-600 text-white p-1 px-2 rounded font-black text-[8px] uppercase">Con Peso</a>
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