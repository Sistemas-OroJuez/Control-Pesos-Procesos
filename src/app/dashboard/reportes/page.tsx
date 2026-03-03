'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReporteAvanzado() {
  const [loading, setLoading] = useState(false);
  const [datos, setDatos] = useState<any[]>([]);
  
  // LÓGICA DE FECHAS: Mes en curso por defecto
  const getPrimerDiaMes = () => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  };
  const getHoy = () => new Date().toISOString().split('T')[0];

  const [filtros, setFiltros] = useState({
    localidad: '',
    fechaDesde: getPrimerDiaMes(), // 01 del mes actual
    fechaHasta: getHoy(),          // Hoy
    variedad: '',
    operador: '',
    proveedor: ''
  });

  const [catalogos, setCatalogos] = useState<any>({ localidades: [], variedades: [], operadores: [], proveedores: [] });

  useEffect(() => {
    cargarCatalogos();
    generarReporte(); // Carga automática al entrar
  }, []);

  async function cargarCatalogos() {
    const [resLoc, resVar, resOpe, resProv] = await Promise.all([
      supabase.from('localidades').select('*'),
      supabase.from('parametros').select('valor').eq('categoria', 'variedad'),
      supabase.from('operadores').select('id, nombre'),
      supabase.from('parametros').select('valor').eq('categoria', 'proveedor')
    ]);
    setCatalogos({
      localidades: resLoc.data || [],
      variedades: resVar.data || [],
      operadores: resOpe.data || [],
      proveedores: resProv.data || []
    });
  }

  async function generarReporte() {
    setLoading(true);
    let query = supabase
      .from('procesos_batch')
      .select(`
        *,
        operadores (
          nombre,
          sitios (
            nombre,
            localidad_id,
            localidades (nombre)
          )
        )
      `)
      .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
      .lte('created_at', `${filtros.fechaHasta}T23:59:59`);

    if (filtros.variedad) query = query.eq('variedad', filtros.variedad);
    if (filtros.operador) query = query.eq('operador_id', filtros.operador);
    if (filtros.proveedor) query = query.eq('proveedor', filtros.proveedor);

    const { data } = await query.order('created_at', { ascending: false });

    if (data) {
      const dataFiltrada = filtros.localidad 
        ? data.filter(item => item.operadores?.sitios?.localidad_id === filtros.localidad)
        : data;
      setDatos(dataFiltrada);
    }
    setLoading(false);
  }

  // Cálculos de Totales y Subtotales por Sitio
  const totalKilos = datos.reduce((acc, curr) => acc + (Number(curr.peso_final_digitado) || 0), 0);
  
  const subtotalesPorSitio = datos.reduce((acc: any, curr) => {
    const sitio = curr.operadores?.sitios?.nombre || 'Desconocido';
    acc[sitio] = (acc[sitio] || 0) + (Number(curr.peso_final_digitado) || 0);
    return acc;
  }, {});

  // ... (Funciones exportarExcel y exportarPDF se mantienen igual al código anterior) ...

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* FILTROS */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border-b-4 border-red-700">
          <p className="text-[10px] font-black text-red-700 mb-4 uppercase tracking-widest">Filtros de Auditoría (Mes en curso por defecto)</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label className="text-[9px] font-bold text-gray-400 ml-2">FECHA INICIO</label>
              <input type="date" className="p-3 border-2 rounded-xl font-bold text-sm" value={filtros.fechaDesde} onChange={e => setFiltros({...filtros, fechaDesde: e.target.value})} />
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] font-bold text-gray-400 ml-2">FECHA FIN</label>
              <input type="date" className="p-3 border-2 rounded-xl font-bold text-sm" value={filtros.fechaHasta} onChange={e => setFiltros({...filtros, fechaHasta: e.target.value})} />
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] font-bold text-gray-400 ml-2">LOCALIDAD</label>
              <select className="p-3 border-2 rounded-xl font-bold text-sm" value={filtros.localidad} onChange={e => setFiltros({...filtros, localidad: e.target.value})}>
                <option value="">TODAS</option>
                {catalogos.localidades.map((l:any) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
            <button onClick={generarReporte} className="bg-red-700 text-white font-black p-3 rounded-xl uppercase text-xs self-end h-[50px]">Actualizar Reporte</button>
          </div>
        </div>

        {/* RESUMEN DE SUBTOTALES */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-red-700 p-5 rounded-3xl text-white shadow-lg">
            <p className="text-[9px] font-black uppercase opacity-70">Total General Kilos</p>
            <p className="text-3xl font-black">{totalKilos.toLocaleString()} kg</p>
          </div>
          {Object.keys(subtotalesPorSitio).map(sitio => (
            <div key={sitio} className="bg-white p-5 rounded-3xl border-2 border-red-50 shadow-sm">
              <p className="text-[9px] font-black text-gray-400 uppercase">{sitio}</p>
              <p className="text-xl font-black text-red-700">{subtotalesPorSitio[sitio].toLocaleString()} kg</p>
            </div>
          ))}
        </div>

        {/* TABLA PRINCIPAL CON LINKS DE FOTOS */}
        <div className="bg-white rounded-3xl shadow-sm overflow-x-auto border">
          <table className="w-full text-[10px] border-collapse">
            <thead className="bg-gray-100 font-black uppercase text-gray-500">
              <tr>
                <th className="p-3 text-left">Batch/Fecha</th>
                <th className="p-3 text-left">Sitio/Operador</th>
                <th className="p-3 text-center">Auditoría Visual</th>
                <th className="p-3 text-left">Variedad/Prov</th>
                <th className="p-3 text-right">Peso</th>
                <th className="p-3 text-left">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {datos.map(reg => (
                <tr key={reg.id} className="hover:bg-red-50 transition-colors">
                  <td className="p-3 font-bold">
                    <span className="text-red-700 font-black">#{reg.batch_id}</span><br/>
                    {new Date(reg.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <p className="font-black uppercase">{reg.operadores?.sitios?.nombre}</p>
                    <p className="text-gray-400 font-bold">{reg.operadores?.nombre} - {reg.turno}</p>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-center">
                      <a href={reg.foto_visor_inicio} target="_blank" className="bg-gray-100 hover:bg-red-700 hover:text-white p-1 px-2 rounded font-black transition-all">INICIO</a>
                      <a href={reg.foto_tanque_vacio} target="_blank" className="bg-gray-100 hover:bg-red-700 hover:text-white p-1 px-2 rounded font-black transition-all">VACÍO</a>
                      <a href={reg.foto_visor_final} target="_blank" className="bg-gray-100 hover:bg-red-700 hover:text-white p-1 px-2 rounded font-black transition-all">PESO</a>
                      {reg.foto_observacion && <a href={reg.foto_observacion} target="_blank" className="bg-orange-100 text-orange-700 p-1 px-2 rounded font-black">OBS</a>}
                    </div>
                  </td>
                  <td className="p-3">
                    <p className="font-bold">{reg.variedad}</p>
                    <p className="text-gray-400">{reg.proveedor}</p>
                  </td>
                  <td className="p-3 text-right font-black text-red-700 text-sm">{reg.peso_final_digitado} kg</td>
                  <td className="p-3 text-gray-500 max-w-[150px] truncate">{reg.observaciones || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos.length === 0 && <p className="text-center p-10 font-bold text-gray-300">No hay registros en este rango de fechas.</p>}
        </div>
      </div>
    </div>
  );
}