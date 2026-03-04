'use client';
// Importamos React para evitar el error de "React is not defined" en Vercel
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function ReporteGerencialDefinitivo() {
  const router = useRouter();
  const [datos, setDatos] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [filtros, setFiltros] = useState({
    desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    hasta: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    consultar();
    cargarEmpleados();
  }, []);

  async function cargarEmpleados() {
    const { data } = await supabase
      .from('empleados')
      .select('nombre, email, celular')
      .not('celular', 'is', null); 
    if (data) setEmpleados(data);
  }

  async function consultar() {
    setLoading(true);
    const { data } = await supabase
      .from('procesos_batch')
      .select(`
        *,
        operadores!inner (nombre, sitios!inner (nombre, localidad_id))
      `)
      .gte('created_at', `${filtros.desde}T00:00:00`)
      .lte('created_at', `${filtros.hasta}T23:59:59`)
      .order('created_at', { ascending: true });

    if (data) {
      const calculados = data.map((curr, i) => {
        const tBatch = calcularDiferencia(curr.fecha_hora_inicio, curr.fecha_hora_fin);
        
        let idleTime = "0:00";
        if (i > 0) {
          const anterior = data[i - 1];
          // Lógica de turno: Reinicia si cambia el nombre del turno
          if (curr.turno === anterior.turno) {
            idleTime = calcularDiferencia(anterior.fecha_hora_fin, curr.fecha_hora_inicio);
          } else {
            idleTime = "INICIO TURNO";
          }
        } else {
          idleTime = "INICIO TURNO";
        }
        return { ...curr, tBatch, idleTime };
      });
      setDatos(calculados.reverse());
    }
    setLoading(false);
  }

  function calcularDiferencia(inicio: string, fin: string) {
    if(!inicio || !fin) return "0:00";
    const diff = Math.abs(new Date(fin).getTime() - new Date(inicio).getTime());
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(datos.map(r => ({
      Batch: r.batch_id,
      Fecha: new Date(r.created_at).toLocaleDateString(),
      Turno: r.turno,
      Proveedor: r.proveedor,
      Variedad: r.variedad,
      Peso_Kg: r.peso_final_digitado,
      // Columnas solicitadas para cálculo manual en Excel
      Hora_Inicio_V0: r.fecha_hora_inicio ? new Date(r.fecha_hora_inicio).toLocaleTimeString() : '',
      Hora_Foto2_TQ: r.fecha_hora_foto_2 ? new Date(r.fecha_hora_foto_2).toLocaleTimeString() : '',
      Hora_Fin_PESO: r.fecha_hora_fin ? new Date(r.fecha_hora_fin).toLocaleTimeString() : '',
      Duracion_Sist: r.tBatch,
      Espera_Sist: r.idleTime
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Gerencial");
    XLSX.writeFile(wb, `Produccion_Detallada_${filtros.desde}.xlsx`);
  };

  const formatHora = (fechaStr: string | null) => {
    if (!fechaStr) return "--:--";
    return new Date(fechaStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const variedadesUnicas = Array.from(new Set(datos.map(d => d.variedad)));
  const granTotalPeso = datos.reduce((acc, c) => acc + Number(c.peso_final_digitado || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* HEADER GERENCIAL CON GRAN TOTAL */}
        <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl border-b-8 border-red-700 flex flex-wrap justify-between items-center print:hidden">
          <div className="space-y-2">
            <h1 className="text-2xl font-black italic text-red-500 uppercase">Eficiencia OroJuez</h1>
            <div className="flex gap-2 items-center">
              <input type="date" className="bg-slate-800 text-white text-[10px] p-2 rounded-lg border-none font-bold" value={filtros.desde} onChange={e => setFiltros({...filtros, desde: e.target.value})} />
              <input type="date" className="bg-slate-800 text-white text-[10px] p-2 rounded-lg border-none font-bold" value={filtros.hasta} onChange={e => setFiltros({...filtros, hasta: e.target.value})} />
              <button onClick={consultar} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-[10px] font-black uppercase">Consultar</button>
            </div>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-bold text-slate-400 uppercase">Gran Total Pesado</p>
             <p className="text-3xl font-black text-red-500">{granTotalPeso.toLocaleString()} <span className="text-sm">KG</span></p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowModal(true)} className="bg-green-600 hover:bg-green-500 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">📲 WhatsApp</button>
            <button onClick={exportarExcel} className="bg-emerald-700 hover:bg-emerald-600 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">📈 Excel</button>
          </div>
        </div>

        {/* TABLA AGRUPADA POR VARIEDAD */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] text-left">
              <thead className="bg-slate-100 text-slate-600 font-black uppercase border-b">
                <tr>
                  <th className="p-4">Batch / Turno</th>
                  <th className="p-4">Proveedor</th>
                  <th className="p-4 text-center bg-blue-50 text-blue-700">⏱ Tiempo Batch</th>
                  <th className="p-4 text-center bg-orange-50 text-orange-700">⌛ Idle Time</th>
                  <th className="p-4 text-center">Fotos (Hora)</th>
                  <th className="p-4 text-right">Peso Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variedadesUnicas.map(variedad => {
                  const items = datos.filter(d => d.variedad === variedad);
                  const subtotal = items.reduce((acc, c) => acc + Number(c.peso_final_digitado || 0), 0);

                  return (
                    <React.Fragment key={variedad}>
                      <tr className="bg-slate-800 text-white">
                        <td colSpan={6} className="p-3 font-black uppercase text-xs italic tracking-widest">
                          Variedad: {variedad} <span className="text-red-400 ml-4">({items.length} Batches)</span>
                        </td>
                      </tr>
                      {items.map((reg) => (
                        <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <p className="font-black text-red-700 text-sm">#{reg.batch_id}</p>
                            <p className="text-gray-400 font-bold uppercase text-[8px]">{reg.turno}</p>
                          </td>
                          <td className="p-4 uppercase font-bold text-slate-700">{reg.proveedor}</td>
                          <td className="p-4 text-center font-black text-blue-600 bg-blue-50/30 border-x border-blue-100">{reg.tBatch} <span className="text-[8px] opacity-60">min</span></td>
                          <td className="p-4 text-center font-black text-orange-600 bg-orange-50/30 border-r border-orange-100">
                            {reg.idleTime === "INICIO TURNO" ? <span className="text-[7px] bg-orange-100 px-2 py-0.5 rounded text-orange-800">REINICIO</span> : <>{reg.idleTime} <span className="text-[8px] opacity-60">min</span></>}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2 justify-center">
                              {[
                                { url: reg.foto_visor_cero_url, label: 'V0', hora: reg.fecha_hora_inicio },
                                { url: reg.foto_tanque_vacio_url, label: 'TQ', hora: reg.fecha_hora_foto_2 },
                                { url: reg.foto_visor_lleno_url, label: 'PESO', hora: reg.fecha_hora_fin }
                              ].map((foto, idx) => (
                                <div key={idx} className="flex flex-col items-center">
                                  {foto.url ? (
                                    <a href={foto.url} target="_blank" className="bg-slate-800 text-white p-1 rounded text-[7px] font-black uppercase hover:bg-red-600">{foto.label}</a>
                                  ) : <span className="text-gray-200">-</span>}
                                  <span className="text-[7px] font-bold text-gray-400 mt-1">{formatHora(foto.hora)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-right font-black text-red-700 text-lg">
                            {Number(reg.peso_final_digitado).toLocaleString()} <span className="text-[8px] text-gray-400">KG</span>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-red-50 font-black text-red-700">
                        <td colSpan={5} className="p-3 text-right uppercase text-[9px]">Subtotal {variedad}:</td>
                        <td className="p-3 text-right text-sm">{subtotal.toLocaleString()} KG</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white">
                <tr>
                  <td colSpan={5} className="p-6 text-right font-black uppercase text-xl italic text-red-500">Gran Total Producción:</td>
                  <td className="p-6 text-right font-black text-red-500 text-3xl">{granTotalPeso.toLocaleString()} <span className="text-xs text-white">KG</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
      {/* MODAL DE WHATSAPP SE MANTIENE IGUAL... */}
    </div>
  );
}