'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ParametrosAdmin() {
  const router = useRouter();
  const [tab, setTab] = useState<'proveedor' | 'variedad' | 'turno' | 'sitio' | 'operador'>('proveedor');
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState<any[]>([]);
  const [auxiliares, setAuxiliares] = useState<any[]>([]); // Para Localidades o Sitios dependiendo de la tab
  const [editandoId, setEditandoId] = useState<string | null>(null);
  
  // Estados de formulario
  const [nuevoValor, setNuevoValor] = useState('');
  const [vinculoId, setVinculoId] = useState(''); // localidad_id para sitios o sitio_id para operadores

  useEffect(() => {
    cargarDatos();
  }, [tab]);

  async function cargarDatos() {
    setLoading(true);
    setEditandoId(null);
    setNuevoValor('');
    setVinculoId('');

    if (tab === 'sitio') {
      const { data: dataSitios } = await supabase.from('sitios').select('*, localidades(nombre)').order('nombre');
      const { data: dataLoc } = await supabase.from('localidades').select('*').order('nombre');
      if (dataSitios) setLista(dataSitios);
      if (dataLoc) setAuxiliares(dataLoc);
    } 
    else if (tab === 'operador') {
      const { data: dataOps } = await supabase.from('operadores').select('*, sitios(nombre)').order('nombre');
      const { data: dataSit } = await supabase.from('sitios').select('*').order('nombre');
      if (dataOps) setLista(dataOps);
      if (dataSit) setAuxiliares(dataSit);
    }
    else {
      const { data } = await supabase.from('parametros').select('*').eq('categoria', tab).order('valor');
      if (data) setLista(data);
    }
    setLoading(false);
  }

  async function guardar() {
    if (!nuevoValor) return alert("Ingrese un nombre");
    setLoading(true);

    if (tab === 'sitio') {
      if (!vinculoId) return alert("Seleccione una localidad");
      const payload = { nombre: nuevoValor.toUpperCase(), localidad_id: vinculoId, activo: true };
      editandoId ? await supabase.from('sitios').update(payload).eq('id', editandoId) : await supabase.from('sitios').insert([payload]);
    } 
    else if (tab === 'operador') {
      if (!vinculoId) return alert("Seleccione un sitio");
      const payload = { nombre: nuevoValor.toUpperCase(), sitio_id: vinculoId, activo: true };
      editandoId ? await supabase.from('operadores').update(payload).eq('id', editandoId) : await supabase.from('operadores').insert([payload]);
    }
    else {
      const payload = { valor: nuevoValor.toUpperCase(), categoria: tab, activo: true };
      editandoId ? await supabase.from('parametros').update({ valor: nuevoValor.toUpperCase() }).eq('id', editandoId) : await supabase.from('parametros').insert([payload]);
    }
    
    cargarDatos();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar permanentemente?")) return;
    const tabla = tab === 'sitio' ? 'sitios' : tab === 'operador' ? 'operadores' : 'parametros';
    await supabase.from(tabla).delete().eq('id', id);
    cargarDatos();
  }

  function prepararEdicion(item: any) {
    setEditandoId(item.id);
    setNuevoValor(tab === 'sitio' || tab === 'operador' ? item.nombre : item.valor);
    setVinculoId(tab === 'sitio' ? item.localidad_id : tab === 'operador' ? item.sitio_id : '');
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <nav className="bg-slate-900 p-4 shadow-xl border-b-8 border-red-700 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-white font-black uppercase italic text-xl tracking-tighter">Configuración ORJ</h1>
          <button onClick={() => router.push('/dashboard')} className="text-[10px] font-black text-red-500 bg-white/10 px-4 py-2 rounded-xl">VOLVER</button>
        </div>
        <div className="flex gap-1 mt-6 max-w-4xl mx-auto bg-slate-800 p-1 rounded-2xl overflow-x-auto">
          {['proveedor', 'variedad', 'turno', 'sitio', 'operador'].map((t) => (
            <button key={t} onClick={() => setTab(t as any)} className={`flex-1 min-w-[85px] py-3 rounded-xl text-[10px] font-black uppercase transition-all ${tab === t ? 'bg-red-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
              {t}es
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-4xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-red-50 space-y-4">
          <p className="text-[10px] font-black text-red-700 uppercase">{editandoId ? `✏️ Editando ${tab}` : `➕ Nuevo ${tab}`}</p>
          <div className="flex flex-col md:flex-row gap-2">
            <input type="text" placeholder={`NOMBRE DEL ${tab.toUpperCase()}`} className="flex-1 p-4 border-2 rounded-2xl font-black uppercase text-sm outline-none focus:border-red-500" value={nuevoValor} onChange={(e) => setNuevoValor(e.target.value)} />
            
            {(tab === 'sitio' || tab === 'operador') && (
              <select className="flex-1 p-4 border-2 rounded-2xl font-black uppercase text-sm bg-gray-50 outline-none focus:border-red-500" value={vinculoId} onChange={(e) => setVinculoId(e.target.value)}>
                <option value="">{tab === 'sitio' ? 'SELECCIONAR LOCALIDAD' : 'SELECCIONAR SITIO'}</option>
                {auxiliares.map(aux => (
                  <option key={aux.id} value={aux.id}>{aux.nombre}</option>
                ))}
              </select>
            )}

            <button onClick={guardar} className="bg-red-700 text-white px-8 py-4 md:py-0 rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-red-800 transition-all">
              {editandoId ? 'Actualizar' : 'Guardar'}
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
                  <button onClick={() => eliminar(item.id)} className="text-red-300 hover:text-red-600 font-black text-[10px] uppercase">Borrar</button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}