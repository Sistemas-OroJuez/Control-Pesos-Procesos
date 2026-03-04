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
    // Consulta a la tabla empleados usando el campo 'celular' que enviaste en el SQL
    const { data } = await supabase
      .from('empleados')
      .select('nombre, email, celular')
      .not('celular', 'is', null); 
    if (data) setEmpleados(data);
  }

  async function consultar() {
    setLoading(true);
    // Traemos todos los campos (*) para asegurar las URLs de las fotos
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
        // Tiempo de proceso del batch actual
        const tBatch = calcularDiferencia(curr.fecha_hora_inicio, curr.fecha_hora_fin);
        // Tiempo de espera desde que terminó el anterior hasta que empezó este
        const idleTime = i > 0 ? calcularDiferencia(data[i-1].fecha_hora_fin, curr.fecha_hora_inicio) : "0:00";
        return { ...curr, tBatch, idleTime };
      });
      // Invertimos para mostrar lo más reciente arriba
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
    const totalKilos = datos.reduce((acc, c) => acc + Number(c.peso_final_digitado || 0), 0);
    const mensaje = `*📊 INFORME GERENCIAL DE PRODUCCIÓN*\n\n` +
      `📅 *Periodo:* ${filtros.desde} / ${filtros.hasta}\n` +
      `⚖️ *Total Pesado:* ${totalKilos.toLocaleString()} kg\n` +
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
          
          <div className="flex gap-2">
            <button onClick={() => setShowModal(true)} className="bg-green-600 hover:bg-green-500 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2">📲 WhatsApp</button>
            <button onClick={exportarExcel} className="bg-emerald-700 hover:bg-emerald-600 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">📈 Excel</button>
            <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">📄 PDF</button>
          </div>
        </div>

        {/* TABLA DE AUDITORÍA COMPLETA */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] text-left">
              <thead className="bg-slate-100 text-slate-600 font-black uppercase border-b">
                <tr>
                  <th className="p-4">Batch / Turno</th>
                  <th className="p-4">Variedad / Proveedor</th>
                  <th className="p-4 text-center bg-blue-50 text-blue-700">⏱ Tiempo Batch</th>
                  <th className="p-4 text-center bg-orange-50 text-orange-700">⌛ Idle Time</th>
                  <th className="p-4 text-center">Fotos Auditoría</th>
                  <th className="p-4 text-right">Peso Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datos.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <p className="font-black text-red-700 text-sm">#{reg.batch_id}</p>
                      <p className="text-gray-400 font-bold uppercase text-[8px]">{reg.turno}</p>
                    </td>
                    <td className="p-4 uppercase">
                      <p className="font-black text-slate-800">{reg.variedad}</p>
                      <p className="text-gray-500 font-bold">{reg.proveedor}</p>
                    </td>
                    <td className="p-4 text-center font-black text-blue-600 bg-blue-50/30 border-x border-blue-100">
                      {reg.tBatch} <span className="text-[8px] opacity-60">min</span>
                    </td>
                    <td className="p-4 text-center font-black text-orange-600 bg-orange-50/30 border-r border-orange-100">
                      {reg.idleTime} <span className="text-[8px] opacity-60">min</span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 justify-center">
                        {reg.foto_visor_cero_url && (
                          <a href={reg.foto_visor_cero_url} target="_blank" className="bg-slate-800 text-white p-1.5 rounded text-[7px] font-black uppercase hover:bg-red-600">V0</a>
                        )}
                        {reg.foto_tanque_vacio_url && (
                          <a href={reg.foto_tanque_vacio_url} target="_blank" className="bg-slate-800 text-white p-1.5 rounded text-[7px] font-black uppercase hover:bg-red-600">Tq</a>
                        )}
                        {reg.foto_visor_lleno_url && (
                          <a href={reg.foto_visor_lleno_url} target="_blank" className="bg-slate-800 text-white p-1.5 rounded text-[7px] font-black uppercase hover:bg-red-600">Peso</a>
                        )}
                        {reg.foto_justificacion_url && (
                          <a href={reg.foto_justificacion_url} target="_blank" className="bg-orange-600 text-white p-1.5 rounded text-[7px] font-black uppercase hover:bg-orange-700">Nov</a>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-black text-red-700 text-lg leading-none">{reg.peso_final_digitado}</p>
                      <p className="text-[8px] font-bold text-gray-400">KILOGRAMOS</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && <div className="p-20 text-center font-black text-red-500 animate-pulse">CARGANDO DATOS...</div>}
          {!loading && datos.length === 0 && <div className="p-20 text-center font-black text-gray-300">NO HAY REGISTROS EN ESTE RANGO</div>}
        </div>
      </div>

      {/* MODAL DE EMPLEADOS PARA WHATSAPP */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-red-700 p-6 text-white text-center">
              <h3 className="font-black uppercase italic tracking-tighter text-xl">Enviar Reporte</h3>
              <p className="text-[9px] opacity-80 font-bold uppercase mt-1">Selecciona al responsable</p>
            </div>
            
            <div className="p-3 max-h-72 overflow-y-auto">
              {empleados.map(emp => (
                <button 
                  key={emp.email} 
                  onClick={() => enviarWhatsApp(emp.celular)}
                  className="w-full text-left p-4 hover:bg-red-50 border-b border-gray-100 flex justify-between items-center group transition-colors"
                >
                  <div>
                    <p className="font-black text-[11px] uppercase text-slate-800 group-hover:text-red-700">{emp.nombre}</p>
                    <p className="text-[9px] text-gray-400 font-medium">{emp.email}</p>
                  </div>
                  <div className="bg-green-100 text-green-600 px-2 py-1 rounded-lg font-black text-[8px]">ENVIAR</div>
                </button>
              ))}
              {empleados.length === 0 && (
                <p className="p-6 text-center text-[10px] font-bold text-gray-400 uppercase">Debes registrar números en la tabla empleados (columna 'celular')</p>
              )}
            </div>
            
            <button onClick={() => setShowModal(false)} className="w-full p-4 bg-slate-50 text-[10px] font-black uppercase text-gray-400 hover:text-red-700 transition-colors">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}