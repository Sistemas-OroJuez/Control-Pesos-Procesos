'use client';
import { useState, useEffect } from 'react';
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
        const idleTime = i > 0 ? calcularDiferencia(data[i-1].fecha_hora_fin, curr.fecha_hora_inicio) : "0:00";
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

  // LÓGICA DE AGRUPACIÓN Y TOTALES
  const variedadesUnicas = Array.from(new Set(datos.map(d => d.variedad)));
  const granTotalPeso = datos.reduce((acc, c) => acc + Number(c.peso_final_digitado || 0), 0);

  const formatHora = (fechaStr: string | null) => {
    if (!fechaStr) return "--:--";
    const d = new Date(fechaStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(datos.map(r => ({
      Batch: r.batch_id,
      Fecha: new Date(r.created_at).toLocaleString(),
      Proveedor: r.proveedor,
      Variedad: r.variedad,
      Peso_Kg: r.peso_final_digitado,
      Duracion_Batch: r.tBatch,
      Tiempo_Espera: r.idleTime,
      Observaciones: r.observaciones
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Gerencial");
    XLSX.writeFile(wb, `Produccion_${filtros.desde}_al_${filtros.hasta}.xlsx`);
  };

  const enviarWhatsApp = (celular: string) => {
    const mensaje = `*📊 INFORME GERENCIAL DE PRODUCCIÓN*\n\n` +
      `📅 *Periodo:* ${filtros.desde} / ${filtros.hasta}\n` +
      `⚖️ *Total Pesado:* ${granTotalPeso.toLocaleString()} kg\n` +
      `🔢 *Total Batches:* ${datos.length}\n` +
      `🔗 *Link Auditoría:* ${window.location.href}`;
    const telLimpio = celular.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`, '_blank');
    setShowModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* HEADER GERENCIAL */}
        <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl border-b-8 border-red-700 flex flex-wrap justify-between items-center print:hidden">
          <div className="space-y-2">
            <h1 className="text-2xl font-black italic text-red-500 uppercase tracking-tighter">Panel de Control Gerencial</h1>
            <div className="flex gap-2 items-center">
              <input type="date" className="bg-slate-800 text-white text-[10px] p-2 rounded-lg border-none font-bold" value={filtros.desde} onChange={e => setFiltros({...filtros, desde: e.target.value})} />
              <span className="text-slate-500 font-bold text-[10px]">AL</span>
              <input type="date" className="bg-slate-800 text-white text-[10px] p-2 rounded-lg border-none font-bold" value={filtros.hasta} onChange={e => setFiltros({...filtros, hasta: e.target.value})} />
              <button onClick={consultar} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-[10px] font-black transition-all">FILTRAR DATA</button>
            </div>
          </div>
          <div className="flex gap-2 text-right">
             <div className="mr-4">
                <p className="text-[9px] text-slate-400 font-bold uppercase">Gran Total Pesado</p>
                <p className="text-xl font-black text-red-500">{granTotalPeso.toLocaleString()} <span className="text-[10px]">KG</span></p>
             </div>
             <button onClick={() => setShowModal(true)} className="bg-green-600 hover:bg-green-500 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">📲 WhatsApp</button>
             <button onClick={exportarExcel} className="bg-emerald-700 hover:bg-emerald-600 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">📈 Excel</button>
          </div>
        </div>

        {/* TABLA AGRUPADA */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] text-left">
              <thead className="bg-slate-100 text-slate-600 font-black uppercase border-b">
                <tr>
                  <th className="p-4">Batch / Turno</th>
                  <th className="p-4">Proveedor / Datos</th>
                  <th className="p-4 text-center bg-blue-50 text-blue-700">⏱ Tiempo Batch</th>
                  <th className="p-4 text-center bg-orange-50 text-orange-700">⌛ Idle Time</th>
                  <th className="p-4 text-center">Auditoría Visual (Fotos)</th>
                  <th className="p-4 text-right">Peso Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variedadesUnicas.map(variedad => {
                  const items = datos.filter(d => d.variedad === variedad);
                  const subtotal = items.reduce((acc, c) => acc + Number(c.peso_final_digitado || 0), 0);

                  return (
                    <>
                      <tr className="bg-slate-800 text-white">
                        <td colSpan={6} className="p-3 font-black uppercase tracking-widest text-xs italic">
                          Variedad: {variedad} <span className="text-red-400 ml-4">({items.length} Batches)</span>
                        </td>
                      </tr>
                      {items.map((reg) => (
                        <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <p className="font-black text-red-700 text-sm">#{reg.batch_id}</p>
                            <p className="text-gray-400 font-bold uppercase text-[8px]">{reg.turno}</p>
                          </td>
                          <td className="p-4 uppercase">
                            <p className="font-black text-slate-800">{reg.proveedor}</p>
                            <p className="text-gray-400 text-[8px]">{new Date(reg.created_at).toLocaleDateString()}</p>
                          </td>
                          <td className="p-4 text-center font-black text-blue-600 bg-blue-50/30 border-x border-blue-100">
                            {reg.tBatch} <span className="text-[8px] opacity-60">min</span>
                          </td>
                          <td className="p-4 text-center font-black text-orange-600 bg-orange-50/30 border-r border-orange-100">
                            {reg.idleTime} <span className="text-[8px] opacity-60">min</span>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2 justify-center">
                              {[
                                { url: reg.foto_visor_cero_url, label: 'V0', hora: reg.fecha_hora_inicio },
                                { url: reg.foto_tanque_vacio_url, label: 'Tq', hora: reg.fecha_hora_foto_2 },
                                { url: reg.foto_visor_lleno_url, label: 'Peso', hora: reg.fecha_hora_fin },
                                { url: reg.foto_justificacion_url, label: 'Nov', hora: reg.created_at }
                              ].map((foto, idx) => foto.url && (
                                <div key={idx} className="flex flex-col items-center">
                                  <a href={foto.url} target="_blank" className="bg-slate-800 text-white p-1.5 rounded text-[7px] font-black uppercase hover:bg-red-600 transition-colors w-8 text-center">{foto.label}</a>
                                  <span className="text-[7px] font-bold text-gray-400 mt-1">{formatHora(foto.hora)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <p className="font-black text-red-700 text-lg leading-none">{reg.peso_final_digitado.toLocaleString()}</p>
                            <p className="text-[8px] font-bold text-gray-400 uppercase">KG</p>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-red-50 border-b-2 border-red-100">
                        <td colSpan={5} className="p-3 text-right font-black text-red-700 uppercase text-[9px]">Subtotal {variedad}:</td>
                        <td className="p-3 text-right font-black text-red-700 text-sm">{subtotal.toLocaleString()} KG</td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white">
                <tr>
                  <td colSpan={5} className="p-6 text-right font-black uppercase tracking-widest text-lg italic">Gran Total de Producción:</td>
                  <td className="p-6 text-right font-black text-red-500 text-3xl">
                    {granTotalPeso.toLocaleString()} <span className="text-xs text-white">KG</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
      {/* ... (MODAL WHATSAPP SE MANTIENE IGUAL) ... */}
    </div>
  );
}