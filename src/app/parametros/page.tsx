'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ParametrosAdmin() {
  const router = useRouter();
  const [tab, setTab] = useState<'proveedor' | 'variedad' | 'turno' | 'sitio' | 'operador'>('proveedor');
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState<any[]>([]);
  const [auxiliares, setAuxiliares] = useState<any[]>([]); 
  const [editandoId, setEditandoId] = useState<string | null>(null);
  
  const [nuevoValor, setNuevoValor] = useState('');
  const [vinculoId, setVinculoId] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [tab]);

  async function cargarDatos() {
    setLoading(true);
    setEditandoId(null);
    setNuevoValor('');
    setVinculoId('');

    try {
      if (tab === 'sitio') {
        const { data: dataSitios } = await supabase.from('sitios').select('*, localidades(nombre)').order('nombre');
        const { data: dataLoc } = await supabase.from('localidades').select('*').order('nombre');
        if (dataSitios) setLista(dataSitios);
        if (dataLoc) setAuxiliares(dataLoc);
      } 
      else if (tab === 'operador') {
        const { data: dataOpe } = await supabase.from('operadores').select('*, sitios(nombre)').order('nombre');
        const { data: dataSit } = await supabase.from('sitios').select('*').order('nombre');
        if (dataOpe) setLista(dataOpe);
        if (dataSit) setAuxiliares(dataSit);
      }
      else {
        // Consulta exacta a la tabla parametros por categoría
        const { data, error } = await supabase
          .from('parametros')
          .select('*')
          .eq('categoria', tab)
          .order('valor');
        if (data) setLista(data);
        if (error) console.error("Error cargando parámetros:", error);
      }
    } catch (err) {
      console.error("Error en cargarDatos:", err);
    }
    setLoading(false);
  }

  async function guardar() {
    if (!nuevoValor) return alert("Ingrese un nombre");
    setLoading(true);

    try {
      let error;
      if (tab === 'sitio') {
        if (!vinculoId) { setLoading(false); return alert("Seleccione una localidad"); }
        const payload = { nombre: nuevoValor.toUpperCase(), localidad_id: vinculoId, activo: true };
        const res = editandoId 
          ? await supabase.from('sitios').update(payload).eq('id', editandoId) 
          : await supabase.from('sitios').insert([payload]);
        error = res.error;
      } 
      else if (tab === 'operador') {
        if (!vinculoId) { setLoading(false); return alert("Seleccione un sitio"); }
        const payload = { nombre: nuevoValor.toUpperCase(), sitio_id: vinculoId, activo: true };
        const res = editandoId 
          ? await supabase.from('operadores').update(payload).eq('id', editandoId) 
          : await supabase.from('operadores').insert([payload]);
        error = res.error;
      }
      else {
        // LOGICA PARA PARAMETROS (Proveedor, Variedad, Turno)
        if (editandoId) {
          const res = await supabase
            .from('parametros')
            .update({ valor: nuevoValor.toUpperCase() })
            .eq('id', editandoId);
          error = res.error;
        } else {
          const res = await supabase
            .from('parametros')
            .insert([{ 
              valor: nuevoValor.toUpperCase(), 
              categoria: tab, // Esto guarda 'proveedor', 'variedad' o 'turno'
              activo: true 
            }]);
          error = res.error;
        }
      }
      
      if (error) {
        alert("Error de base de datos: " + error.message);
      } else {
        alert("✅ Registro guardado con éxito");
        await cargarDatos(); // Recarga la lista inmediatamente
      }
    } catch (err: any) {
      alert("Error crítico: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function eliminar(id: string) {
    if (!confirm("¿Está seguro de eliminar este registro?")) return;
    const tabla = (tab === 'sitio') ? 'sitios' : (tab === 'operador' ? 'operadores' : 'parametros');
    const { error } = await supabase.from(tabla).delete().eq('id', id);
    if (error) alert("Error al eliminar");
    else cargarDatos();
  }

  function prepararEdicion(item: any) {
    setEditandoId(item.id);
    setNuevoValor(tab === 'sitio' || tab === 'operador' ? item.nombre : item.valor);
    if (tab === 'sitio') setVinculoId(item.localidad_id);
    if (tab === 'operador') setVinculoId(item.sitio_id);
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <div className="bg-slate-900 p-6 rounded-b-[3rem] shadow-xl border-b-4 border-red-700">
        <button onClick={() => router.back()} className="text-white/50 text-[10px] font-black uppercase mb-4 flex items-center gap-2">
          ← Volver
        </button>
        <h1 className="text-white text-2xl font-black italic uppercase tracking-tighter">Configuración</h1>
        <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">Parámetros del Sistema</p>
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-4 -mt-4">
        <div className="bg-white p-2 rounded-2xl shadow-lg flex justify-between overflow-x-auto gap-2">
          {(['proveedor', 'variedad', 'turno', 'sitio', 'operador'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${tab === t ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              {t}s
            </button>
          ))}
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-4">
          <div className="space-y-4">
            {(tab === 'sitio' || tab === 'operador') && (
              <select 
                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none ring-2 ring-transparent focus:ring-red-700 transition-all"
                value={vinculoId}
                onChange={(e) => setVinculoId(e.target.value)}
              >
                <option value="">{tab === 'sitio' ? '-- SELECCIONE LOCALIDAD --' : '-- SELECCIONE SITIO --'}</option>
                {auxiliares.map(aux => (
                  <option key={aux.id} value={aux.id}>{aux.nombre}</option>
                ))}
              </select>
            )}

            <input
              type="text"
              placeholder={`NOMBRE DEL ${tab.toUpperCase()}`}
              className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none ring-2 ring-transparent focus:ring-red-700 transition-all"
              value={nuevoValor}
              onChange={(e) => setNuevoValor(e.target.value)}
            />
            
            <button 
              onClick={guardar}
              disabled={loading}
              className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black text-xs uppercase hover:bg-red-700 transition-all"
            >
              {loading ? 'Procesando...' : (editandoId ? 'Actualizar' : 'Guardar')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {loading ? (
            <p className="text-center font-black text-slate-300 py-10 animate-pulse uppercase">Sincronizando...</p>
          ) : (
            lista.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div>
                  <span className="font-black text-slate-700 uppercase text-xs">{tab === 'sitio' || tab === 'operador' ? item.nombre : item.valor}</span>
                  {tab === 'sitio' && <p className="text-[9px] font-bold text-red-600 uppercase">Sede: {item.localidades?.nombre || 'Sin vincular'}</p>}
                  {tab === 'operador' && <p className="text-[9px] font-bold text-blue-600 uppercase">Sitio: {item.sitios?.nombre || 'Sin sitio'}</p>}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => prepararEdicion(item)} className="text-blue-600 font-black text-[10px] uppercase hover:underline">Editar</button>
                  <button onClick={() => eliminar(item.id)} className="text-red-300 hover:text-red-600 font-black text-[10px] uppercase transition-colors">Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}