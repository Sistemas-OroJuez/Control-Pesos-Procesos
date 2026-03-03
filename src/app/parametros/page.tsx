'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ParametrosAdmin() {
  const router = useRouter();
  const [tab, setTab] = useState<'generales' | 'operadores' | 'sitios'>('generales');
  const [loading, setLoading] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null); // Para saber si estamos editando

  // Estados
  const [listaGeneral, setListaGeneral] = useState<any[]>([]);
  const [sitios, setSitios] = useState<any[]>([]);
  const [localidades, setLocalidades] = useState<any[]>([]);
  const [operadores, setOperadores] = useState<any[]>([]);

  // Formularios
  const [formSitio, setFormSitio] = useState({ nombre: '', localidad_id: '' });
  const [formOperador, setFormOperador] = useState({ nombre: '', telefono: '', sitio_id: '' });

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setLoading(true);
    const [resGen, resSit, resOpe, resLoc] = await Promise.all([
      supabase.from('parametros').select('*').order('categoria'),
      supabase.from('sitios').select('*, localidades(nombre)').order('nombre'),
      supabase.from('operadores').select('*, sitios(nombre)').order('nombre'),
      supabase.from('localidades').select('*').order('nombre')
    ]);
    if (resGen.data) setListaGeneral(resGen.data);
    if (resSit.data) setSitios(resSit.data);
    if (resOpe.data) setOperadores(resOpe.data);
    if (resLoc.data) setLocalidades(resLoc.data);
    setLoading(false);
  }

  // --- LÓGICA DE SITIOS (GUARDAR / EDITAR / ELIMINAR) ---
  async function guardarSitio() {
    if (!formSitio.nombre || !formSitio.localidad_id) return alert("Complete los campos");
    
    if (editandoId) {
      const { error } = await supabase.from('sitios').update({ 
        nombre: formSitio.nombre.toUpperCase(), 
        localidad_id: formSitio.localidad_id 
      }).eq('id', editandoId);
      if (error) alert(error.message);
      setEditandoId(null);
    } else {
      const { error } = await supabase.from('sitios').insert([{ 
        nombre: formSitio.nombre.toUpperCase(), 
        localidad_id: formSitio.localidad_id 
      }]);
      if (error) alert(error.message);
    }
    setFormSitio({ nombre: '', localidad_id: '' });
    cargarTodo();
  }

  function prepararEdicionSitio(sitio: any) {
    setEditandoId(sitio.id);
    setFormSitio({ nombre: sitio.nombre, localidad_id: sitio.localidad_id });
    window.scrollTo(0, 0);
  }

  // --- LÓGICA DE OPERADORES (GUARDAR / EDITAR / ELIMINAR) ---
  async function guardarOperador() {
    if (!formOperador.nombre || !formOperador.sitio_id) return alert("Nombre y Sitio obligatorios");

    if (editandoId) {
      const { error } = await supabase.from('operadores').update(formOperador).eq('id', editandoId);
      if (error) alert(error.message);
      setEditandoId(null);
    } else {
      const { error } = await supabase.from('operadores').insert([formOperador]);
      if (error) alert(error.message);
    }
    setFormOperador({ nombre: '', telefono: '', sitio_id: '' });
    cargarTodo();
  }

  function prepararEdicionOperador(ope: any) {
    setEditandoId(ope.id);
    setFormOperador({ nombre: ope.nombre, telefono: ope.telefono || '', sitio_id: ope.sitio_id });
    window.scrollTo(0, 0);
  }

  async function eliminarRegistro(tabla: string, id: string) {
    if (!confirm("¿Eliminar permanentemente?")) return;
    const { error } = await supabase.from(tabla).delete().eq('id', id);
    if (error) alert("Error: " + error.message + ". Revisa las políticas RLS en Supabase.");
    cargarTodo();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ... NAV IGUAL AL ANTERIOR ... */}
      <nav className="bg-white p-4 shadow-md border-b-4 border-red-700 sticky top-0 z-10">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-100 rounded-lg font-bold text-xs">← VOLVER</button>
          <h1 className="text-red-700 font-black uppercase text-xl">Parámetros</h1>
        </div>
        <div className="flex gap-1 mt-4 max-w-4xl mx-auto bg-gray-100 p-1 rounded-2xl">
          {['generales', 'sitios', 'operadores'].map((t: any) => (
            <button key={t} onClick={() => { setTab(t); setEditandoId(null); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${tab === t ? 'bg-red-700 text-white' : 'text-gray-500'}`}>{t}</button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-4xl mx-auto">
        {/* SECCIÓN SITIOS */}
        {tab === 'sitios' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-red-100 space-y-4">
              <p className="text-[10px] font-black text-red-700 uppercase">{editandoId ? '✏️ Editando Sitio' : '📍 Nuevo Sitio'}</p>
              <input type="text" placeholder="NOMBRE" className="w-full p-4 border-2 rounded-2xl font-bold" value={formSitio.nombre} onChange={(e) => setFormSitio({...formSitio, nombre: e.target.value})} />
              <select className="w-full p-4 border-2 rounded-2xl font-bold bg-gray-50" value={formSitio.localidad_id} onChange={(e) => setFormSitio({...formSitio, localidad_id: e.target.value})}>
                <option value="">SELECCIONE LOCALIDAD</option>
                {localidades.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={guardarSitio} className="flex-[2] bg-red-700 text-white p-4 rounded-2xl font-black uppercase text-xs">{editandoId ? 'Actualizar' : 'Guardar'}</button>
                {editandoId && <button onClick={() => {setEditandoId(null); setFormSitio({nombre:'', localidad_id:''})}} className="flex-1 bg-gray-200 p-4 rounded-2xl font-black text-xs uppercase">Cancelar</button>}
              </div>
            </div>

            <div className="space-y-2">
              {sitios.map((s) => (
                <div key={s.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border shadow-sm">
                  <div>
                    <p className="font-bold text-gray-800">📍 {s.nombre}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Zona: {s.localidades?.nombre || 'SIN ASIGNAR'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => prepararEdicionSitio(s)} className="p-2 text-blue-600 font-black text-[10px] uppercase">Editar</button>
                    <button onClick={() => eliminarRegistro('sitios', s.id)} className="p-2 text-red-300 hover:text-red-600 font-black text-[10px] uppercase">Borrar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECCIÓN OPERADORES */}
        {tab === 'operadores' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-red-100 space-y-4">
              <p className="text-[10px] font-black text-red-700 uppercase">{editandoId ? '✏️ Editando Operador' : '👤 Nuevo Operador'}</p>
              <input type="text" placeholder="NOMBRE" className="w-full p-4 border-2 rounded-2xl font-bold" value={formOperador.nombre} onChange={(e) => setFormOperador({...formOperador, nombre: e.target.value.toUpperCase()})} />
              <input type="tel" placeholder="TELÉFONO" className="w-full p-4 border-2 rounded-2xl font-bold" value={formOperador.telefono} onChange={(e) => setFormOperador({...formOperador, telefono: e.target.value})} />
              <select className="w-full p-4 border-2 rounded-2xl font-bold bg-gray-50" value={formOperador.sitio_id} onChange={(e) => setFormOperador({...formOperador, sitio_id: e.target.value})}>
                <option value="">ASIGNAR A SITIO</option>
                {sitios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={guardarOperador} className="flex-[2] bg-red-700 text-white p-4 rounded-2xl font-black uppercase text-xs">{editandoId ? 'Actualizar' : 'Registrar'}</button>
                {editandoId && <button onClick={() => {setEditandoId(null); setFormOperador({nombre:'', telefono:'', sitio_id:''})}} className="flex-1 bg-gray-200 p-4 rounded-2xl font-black text-xs uppercase">Cancelar</button>}
              </div>
            </div>

            <div className="space-y-2">
              {operadores.map((o) => (
                <div key={o.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border shadow-sm">
                  <div>
                    <p className="font-black text-gray-800 uppercase text-sm">{o.nombre}</p>
                    <p className="text-[10px] text-red-700 font-bold uppercase">📍 {o.sitios?.nombre || 'SIN SITIO'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => prepararEdicionOperador(o)} className="p-2 text-blue-600 font-black text-[10px] uppercase">Editar</button>
                    <button onClick={() => eliminarRegistro('operadores', o.id)} className="p-2 text-red-300 hover:text-red-600 font-black text-[10px] uppercase">Borrar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}