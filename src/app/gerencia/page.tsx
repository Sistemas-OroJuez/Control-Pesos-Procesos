'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function ReporteGerencialDefinitivo() {
  const router = useRouter();
  const [datos, setDatos] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
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
      .order('created_at', { ascending: false });

    if (data) setDatos(data);
    setLoading(false);
  }

  const exportarExcel = () => {
    const dataExcel = datos.map(reg => ({
      Fecha: new Date(reg.created_at).toLocaleDateString(),
      BatchID: reg.batch_id,
      Operador: reg.operadores?.nombre,
      Proveedor: reg.proveedor,
      Variedad: reg.variedad,
      Turno: reg.turno,
      Peso_KG: reg.peso_final_digitado,
      Observaciones: reg.observaciones || ''
    }));
    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_Produccion_${filtros.desde}_${filtros.hasta}.xlsx`);
  };

  const formatHora = (isoStr: string | null) => {
    if (!isoStr) return '--:--';
    return new Date(isoStr).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const registrosPorVariedad = datos.reduce((acc: any, curr) => {
    const v = curr.variedad || 'SIN VARIEDAD';
    if (!acc[v]) acc[v] = [];
    acc[v].push(curr);
    return acc;
  }, {});

  const granTotalPeso = datos.reduce((acc, curr) => acc + (Number(curr.peso_final_digitado) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-3xl shadow-sm gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Reporte Gerencial de Producción</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Control de Pesos y Procesos</p>
          </div>
          <div className="flex gap-2">
            <button onClick={consultar} className="bg-red-700 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase hover:bg-red-800 transition-all">Actualizar</button>
            <button onClick={exportarExcel} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase hover:bg-emerald-700 transition-all">Excel</button>
          </div>
        </header>

        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-200">
          <div className="p-6 bg-slate-50 border-b flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Desde</label>
              <input type="date" className="block w-full p-3 rounded-xl border-2 border-slate-200 font-bold text-sm" value={filtros.desde} onChange={e => setFiltros({...filtros, desde: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Hasta</label>
              <input type="date" className="block w-full p-3 rounded-xl border-2 border-slate-200 font-bold text-sm" value={filtros.hasta} onChange={e => setFiltros({...filtros, hasta: e.target.value})} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-widest">
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Batch / Turno</th>
                  <th className="p-4">Operador / Proveedor</th>
                  <th className="p-4">Evidencias Fotos</th>
                  <th className="p-4">Justificación</th>
                  <th className="p-4">Observaciones</th>
                  <th className="p-4 text-right">Peso Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(registrosPorVariedad).map(variedad => {
                  const registros = registrosPorVariedad[variedad];
                  const subtotal = registros.reduce((acc: number, curr: any) => acc + (Number(curr.peso_final_digitado) || 0), 0);
                  
                  return (
                    <React.Fragment key={variedad}>
                      <tr className="bg-slate-200">
                        <td colSpan={7} className="p-3 font-black text-slate-700 text-xs uppercase tracking-widest">
                          Variedad: {variedad} <span className="ml-2 text-slate-500 font-normal">({registros.length} BATCHES)</span>
                        </td>
                      </tr>
                      {registros.map((reg: any) => (
                        <tr key={reg.id} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <span className="text-xs font-bold text-slate-600">
                              {new Date(reg.created_at).toLocaleDateString('es-EC')}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-black text-slate-800 text-sm">#{reg.batch_id}</div>
                            <div className="text-[10px] font-bold text-red-600 uppercase">{reg.turno}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-700 text-xs uppercase">{reg.operadores?.nombre}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{reg.proveedor}</div>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              {[ 
                                { url: reg.foto_visor_cero_url, label: 'VO', hora: reg.hora_foto_visor_cero },
                                { url: reg.foto_tanque_vacio_url, label: 'TQ', hora: reg.hora_foto_tanque_vacio },
                                { url: reg.foto_visor_lleno_url, label: 'VL', hora: reg.hora_foto_visor_lleno }
                              ].map((foto, i) => (
                                <div key={i} className="flex flex-col items-center">
                                  <div className="text-[8px] font-black text-slate-400 mb-1">{foto.label}</div>
                                  {foto.url ? (
                                    <a href={foto.url} target="_blank" rel="noreferrer">
                                      <img src={foto.url} className="w-10 h-10 object-cover rounded-lg border-2 border-white shadow-sm hover:scale-110 transition-transform" />
                                    </a>
                                  ) : <div className="w-10 h-10 bg-slate-100 rounded-lg border-2 border-dashed border-slate-200" />}
                                  <span className="text-[7px] font-bold text-gray-400 mt-1">{formatHora(foto.hora)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            {reg.foto_justificacion_url ? (
                              <a href={reg.foto_justificacion_url} target="_blank" rel="noreferrer">
                                <img src={reg.foto_justificacion_url} className="w-10 h-10 object-cover rounded-lg border-2 border-amber-200 shadow-sm mx-auto hover:scale-110 transition-transform" />
                              </a>
                            ) : (
                              <span className="text-[8px] text-slate-300 font-bold uppercase">Sin Foto</span>
                            )}
                          </td>
                          <td className="p-4">
                            <p className="text-[10px] text-slate-600 font-medium max-w-[150px] italic leading-tight">
                              {reg.observaciones || '---'}
                            </p>
                          </td>
                          <td className="p-4 text-right font-black text-red-700 text-lg">
                            {Number(reg.peso_final_digitado).toLocaleString()} <span className="text-[8px] text-gray-400">KG</span>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-red-50 font-black text-red-700">
                        <td colSpan={6} className="p-3 text-right uppercase text-[9px]">Subtotal {variedad}:</td>
                        <td className="p-3 text-right text-sm">{subtotal.toLocaleString()} KG</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white">
                <tr>
                  <td colSpan={6} className="p-6 text-right font-black uppercase text-xl italic text-red-500">Gran Total Producción:</td>
                  <td className="p-6 text-right font-black text-red-500 text-3xl">{granTotalPeso.toLocaleString()} <span className="text-xs text-white">KG</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}