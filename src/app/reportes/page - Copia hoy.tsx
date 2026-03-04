'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ReporteGeneralCompleto() {
  const router = useRouter();
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Catálogos para los Selects
  const [listas, setListas] = useState({
    localidades: [],
    operadores: [],
    variedades: ['GUINENSIS', 'HIBRIDO', 'OTRA'],
    proveedores: []
  });

  // Estado Maestro de Filtros
  const [filtros, setFiltros] = useState({
    desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    hasta: new Date().toISOString().split('T')[0],
    localidadId: '',
    operadorId: '',
    variedad: '',
    proveedor: ''
  });

  useEffect(() => {
    cargarCatalogos();
    consultar();
  }, []);

  // CÁLCULO DE SUBTOTALES
  const totalPeso = datos.reduce((acc, reg) => acc + (Number(reg.peso_final_digitado) || 0), 0);

  async function cargarCatalogos() {
    const { data: loc } = await supabase.from('localidades').select('*').order('nombre');
    const { data: ope } = await supabase.from('operadores').select('*').order('nombre');
    const { data: prov } = await supabase.from('procesos_batch').select('proveedor');
    const proveedoresUnicos = Array.from(new Set(prov?.map(p => p.proveedor).filter(Boolean)));

    setListas(prev => ({ 
      ...prev, 
      localidades: loc || [], 
      operadores: ope || [],
      proveedores: proveedoresUnicos as any
    }));
  }

  async function consultar() {
    setLoading(true);
    let query = supabase
      .from('procesos_batch')
      .select(`
        *,
        operadores!inner (
          id, nombre, 
          sitios!inner (id, nombre, localidad_id)
        )
      `)
      .gte('created_at', `${filtros.desde}T00:00:00`)
      .lte('created_at', `${filtros.hasta}T23:59:59`);

    if (filtros.localidadId) query = query.eq('operadores.sitios.localidad_id', filtros.localidadId);
    if (filtros.operadorId) query = query.eq('operador_id', filtros.operadorId);
    if (filtros.variedad) query = query.eq('variedad', filtros.variedad);
    if (filtros.proveedor) query = query.eq('proveedor', filtros.proveedor);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (data) setDatos(data);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-[1600px] mx-auto space-y-4">
        
        {/* BARRA DE FILTROS AVANZADA */}
        <div className="bg-white p-6 rounded-3xl shadow-lg border-b-4 border-red-700">
          <h2 className="text-red-700 font-black uppercase text-xs mb-4 italic tracking-widest">Filtros de Auditoría</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-gray-400">FECHA INICIO</label>
              <input type="date" className="p-2 border rounded-xl text-xs font-bold" value={filtros.desde} onChange={e => setFiltros({...filtros, desde: e.target.value})} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-gray-400">FECHA FIN</label>
              <input type="date" className="p-2 border rounded-xl text-xs font-bold" value={filtros.hasta} onChange={e => setFiltros({...filtros, hasta: e.target.value})} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-gray-400">LOCALIDAD</label>
              <select className="p-2 border rounded-xl text-xs font-bold" value={filtros.localidadId} onChange={e => setFiltros({...filtros, localidadId: e.target.value})}>
                <option value="">TODAS</option>
                {listas.localidades.map((l:any) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-gray-400">OPERADOR</label>
              <select className="p-2 border rounded-xl text-xs font-bold" value={filtros.operadorId} onChange={e => setFiltros({...filtros, operadorId: e.target.value})}>
                <option value="">TODOS</option>
                {listas.operadores.map((o:any) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-gray-400">VARIEDAD</label>
              <select className="p-2 border rounded-xl text-xs font-bold" value={filtros.variedad} onChange={e => setFiltros({...filtros, variedad: e.target.value})}>
                <option value="">TODAS</option>
                {listas.variedades.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <button onClick={consultar} className="bg-red-700 text-white rounded-xl font-black text-[10px] uppercase h-[38px] self-end hover:bg-red-800 transition-all shadow-md">
              {loading ? 'Consultando...' : 'Aplicar Filtros'}
            </button>
          </div>
        </div>

        {/* TABLA DE RESULTADOS */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] text-left">
              <thead className="bg-slate-900 text-white uppercase font-black">
                <tr>
                  <th className="p-4 border-r border-slate-700">Batch / Info</th>
                  <th className="p-4 border-r border-slate-700">Sitio / Operador</th>
                  <th className="p-4 border-r border-slate-700">Variedad / Proveedor</th>
                  <th className="p-4 text-center border-r border-slate-700">Fotos de Auditoría</th>
                  <th className="p-4 text-right border-r border-slate-700">Peso Kg</th>
                  <th className="p-4">Novedades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datos.map((reg) => (
                  <tr key={reg.id} className="hover:bg-red-50/50 transition-colors">
                    <td className="p-4">
                      <p className="font-black text-red-700 text-sm">#{reg.batch_id}</p>
                      <p className="text-gray-400 font-bold">{new Date(reg.created_at).toLocaleString()}</p>
                      <p className="bg-gray-100 text-[8px] px-1 rounded inline-block">{reg.turno}</p>
                    </td>
                    <td className="p-4 uppercase font-bold">
                      <p className="text-slate-800">{reg.operadores?.sitios?.nombre}</p>
                      <p className="text-gray-400 text-[9px]">{reg.operadores?.nombre}</p>
                    </td>
                    <td className="p-4 uppercase">
                      <p className="font-black text-slate-700">{reg.variedad}</p>
                      <p className="text-gray-500 font-bold text-[9px]">{reg.proveedor}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 justify-center">
                        {reg.foto_visor_cero_url && <a href={reg.foto_visor_cero_url} target="_blank" className="bg-blue-600 text-white px-2 py-1.5 rounded-lg font-black text-[8px] uppercase shadow-sm">Visor 0</a>}
                        {reg.foto_tanque_vacio_url && <a href={reg.foto_tanque_vacio_url} target="_blank" className="bg-blue-600 text-white px-2 py-1.5 rounded-lg font-black text-[8px] uppercase shadow-sm">Tq Vacio</a>}
                        {reg.foto_visor_lleno_url && <a href={reg.foto_visor_lleno_url} target="_blank" className="bg-blue-600 text-white px-2 py-1.5 rounded-lg font-black text-[8px] uppercase shadow-sm">Visor Peso</a>}
                      </div>
                    </td>
                    <td className="p-4 text-right font-black text-red-700 text-base border-l">
                      {reg.peso_final_digitado.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <p className="italic text-gray-500 line-clamp-2 mb-1">{reg.observaciones || '-'}</p>
                      {reg.foto_justificacion_url && (
                        <a href={reg.foto_justificacion_url} target="_blank" className="text-orange-600 font-black underline uppercase text-[8px]">Ver Justificación</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* FILA DE SUBTOTALES */}
              <tfoot className="bg-slate-100 border-t-2 border-slate-900">
                <tr className="font-black">
                  <td colSpan={4} className="p-4 text-right text-slate-900 uppercase tracking-widest text-xs">
                    Subtotal del Periodo:
                  </td>
                  <td className="p-4 text-right text-red-700 text-xl border-l border-slate-300">
                    {totalPeso.toLocaleString()} <span className="text-[10px]">KG</span>
                  </td>
                  <td className="p-4 bg-slate-100"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {datos.length === 0 && <div className="p-20 text-center font-black text-gray-300 uppercase tracking-widest bg-gray-50">No hay registros con estos filtros</div>}
        </div>
      </div>
    </div>
  );
}