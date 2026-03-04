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
    // 1. Consultamos en orden ASCENDENTE para calcular tiempos secuencialmente
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
        // Tiempo del Batch actual (Fin - Inicio)
        const tBatch = calcularDiferencia(curr.fecha_hora_inicio, curr.fecha_hora_fin);
        
        // 2. LÓGICA DE TIEMPO DE ESPERA (IDLE TIME)
        let idleTime = "0:00";
        if (i > 0) {
          const anterior = data[i - 1];
          
          // REGLA: Solo calcular si es el MISMO TURNO. 
          // No importa si cambia el día (para turnos nocturnos).
          if (curr.turno === anterior.turno) {
            const diffMs = Math.abs(new Date(curr.fecha_hora_inicio).getTime() - new Date(anterior.fecha_hora_fin).getTime());
            
            // Si la diferencia es mayor a 12 horas, probablemente no es el mismo bloque operativo
            if (diffMs > 43200000) { 
              idleTime = "INICIO TURNO";
            } else {
              idleTime = milisegundosAMinutos(diffMs);
            }
          } else {
            idleTime = "INICIO TURNO";
          }
        } else {
          idleTime = "INICIO TURNO";
        }

        return { ...curr, tBatch, idleTime };
      });
      // Invertimos para mostrar lo más reciente arriba en la tabla
      setDatos(calculados.reverse());
    }
    setLoading(false);
  }

  function calcularDiferencia(inicio: string, fin: string) {
    if(!inicio || !fin) return "0:00";
    const diff = Math.abs(new Date(fin).getTime() - new Date(inicio).getTime());
    return milisegundosAMinutos(diff);
  }

  function milisegundosAMinutos(ms: number) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // 3. AGRUPACIÓN POR VARIEDAD Y TOTALES
  const variedadesUnicas = Array.from(new Set(datos.map(d => d.variedad)));
  const granTotalPeso = datos.reduce((acc, c) => acc + Number(c.peso_final_digitado || 0), 0);

  const formatHora = (fechaStr: string | null) => {
    if (!fechaStr) return "--:--";
    const d = new Date(fechaStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* HEADER GERENCIAL */}
        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl border-b-8 border-red-700 flex flex-wrap justify-between items-center print:hidden">
          <div className="space-y-2">
            <h1 className="text-2xl font-black italic text-red-500 uppercase tracking-tighter">Eficiencia Operativa OroJuez</h1>
            <div className="flex gap-2 items-center">
              <input type="date" className="bg-slate-800 text-white text-[10px] p-2 rounded-lg border-none font-bold" value={filtros.desde} onChange={e => setFiltros({...filtros, desde: e.target.value})} />
              <input type="date" className="bg-slate-800 text-white text-[10px] p-2 rounded-lg border-none font-bold" value={filtros.hasta} onChange={e => setFiltros({...filtros, hasta: e.target.value})} />
              <button onClick={consultar} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg">CONSULTAR</button>
            </div>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peso Total del Periodo</p>
             <p className="text-4xl font-black text-red-500">{granTotalPeso.toLocaleString()} <span className="text-xs text-white">KG</span></p>
          </div>
        </div>

        {/* TABLA AGRUPADA */}
        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] text-left">
              <thead className="bg-slate-50 text-slate-400 font-black uppercase border-b text-[9px]">
                <tr>
                  <th className="p-5">Batch / Turno</th>
                  <th className="p-5">Proveedor / Fecha</th>
                  <th className="p-4 text-center bg-blue-50/50 text-blue-600">Duración Batch</th>
                  <th className="p-4 text-center bg-orange-50/50 text-orange-600 italic">Espera (Idle)</th>
                  <th className="p-5 text-center">Auditoría Visual (Hora)</th>
                  <th className="p-5 text-right">Peso Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variedadesUnicas.map(variedad => {
                  const items = datos.filter(d => d.variedad === variedad);
                  const subtotal = items.reduce((acc, c) => acc + Number(c.peso_final_digitado || 0), 0);

                  return (
                    <React.Fragment key={variedad}>
                      <tr className="bg-slate-800 text-white">
                        <td colSpan={6} className="p-4 font-black uppercase text-xs tracking-widest italic shadow-inner">
                          Variedad: {variedad} <span className="text-red-500 ml-4">({items.length} Lotes)</span>
                        </td>
                      </tr>
                      {items.map((reg) => (
                        <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-5 border-r border-slate-50">
                            <p className="font-black text-red-700 text-sm">#{reg.batch_id}</p>
                            <p className="text-slate-400 font-black text-[8px] uppercase">{reg.turno}</p>
                          </td>
                          <td className="p-5">
                            <p className="font-black text-slate-800 uppercase">{reg.proveedor}</p>
                            <p className="text-slate-400 font-bold text-[8px]">{new Date(reg.created_at).toLocaleDateString()}</p>
                          </td>
                          <td className="p-4 text-center font-black text-blue-600 bg-blue-50/20 border-x border-blue-50">
                            {reg.tBatch} <span className="text-[7px] opacity-60">min</span>
                          </td>
                          <td className="p-4 text-center font-black text-orange-600 bg-orange-50/20 border-r border-orange-50">
                            {reg.idleTime === "INICIO TURNO" ? (
                              <span className="text-[8px] bg-orange-100 px-2 py-1 rounded-full text-orange-800 font-black uppercase">Reinicio</span>
                            ) : (
                              <>{reg.idleTime} <span className="text-[7px] opacity-60">min</span></>
                            )}
                          </td>
                          <td className="p-5">
                            <div className="flex gap-3 justify-center">
                              {[
                                { url: reg.foto_visor_cero_url, label: 'V0', hora: reg.fecha_hora_inicio },
                                { url: reg.foto_tanque_vacio_url, label: 'TQ', hora: reg.fecha_hora_foto_2 },
                                { url: reg.foto_visor_lleno_url, label: 'PESO', hora: reg.fecha_hora_fin }
                              ].map((foto, idx) => foto.url && (
                                <div key={idx} className="flex flex-col items-center">
                                  <a href={foto.url} target="_blank" className="bg-slate-800 text-white p-1.5 rounded text-[7px] font-black uppercase hover:bg-red-600 transition-colors w-8 text-center">{foto.label}</a>
                                  <span className="text-[7px] font-bold text-gray-400 mt-1">{formatHora(foto.hora)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-5 text-right bg-slate-50/30">
                            <p className="font-black text-red-700 text-xl leading-none">{reg.peso_final_digitado.toLocaleString()}</p>
                            <p className="text-[8px] font-bold text-gray-400">KG</p>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-red-50 border-b-2 border-red-100">
                        <td colSpan={5} className="p-4 text-right font-black text-red-700 uppercase text-[9px] tracking-widest">Subtotal {variedad}:</td>
                        <td className="p-4 text-right font-black text-red-700 text-base">{subtotal.toLocaleString()} KG</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white">
                <tr>
                  <td colSpan={5} className="p-8 text-right font-black uppercase tracking-widest text-xl italic text-red-500">Total Producción Consultada:</td>
                  <td className="p-8 text-right font-black text-red-500 text-4xl">
                    {granTotalPeso.toLocaleString()} <span className="text-xs text-white">KG</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}