'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ParametrosAdmin() {
  const router = useRouter();
  const [tab, setTab] = useState<'generales' | 'operadores' | 'sitios'>('generales');
  const [loading, setLoading] = useState(false);

  // Estados para Parámetros Generales
  const [categoria, setCategoria] = useState('variedad');
  const [valor, setValor] = useState('');
  const [listaGeneral, setListaGeneral] = useState<any[]>([]);

  // Estados para Sitios y Localidades
  const [sitios, setSitios] = useState<any[]>([]);
  const [localidades, setLocalidades] = useState<any[]>([]); // NUEVO
  const [formSitio, setFormSitio] = useState({ nombre: '', localidad_id: '' }); // ACTUALIZADO

  // Estados para Operadores
  const [operadores, setOperadores] = useState<any[]>([]);
  const [formOperador, setFormOperador] = useState({ nombre: '', telefono: '', sitio_id: '' });

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setLoading(true);
    // Carga paralela incluyendo la tabla localidades
    const [resGen, resSit, resOpe, resLoc] = await Promise.all([
      supabase.from('parametros').select('*').order('categoria'),
      supabase.from('sitios').select('*, localidades(nombre)').order('nombre'), // Incluye nombre de localidad
      supabase.from('operadores').select('*, sitios(nombre)').order('nombre'),
      supabase.from('localidades').select('*').order('nombre') // Nueva carga
    ]);
    
    if (resGen.data) setListaGeneral(resGen.data);
    if (resSit.data) setSitios(resSit.data);
    if (resOpe.data) setOperadores(resOpe.data);
    if (resLoc.data) setLocalidades(resLoc.data);
    setLoading(false);
  }

  async function guardarGeneral() {
    if (!valor) return;
    const { error } = await supabase.from('parametros').insert([{ categoria, valor: valor.toUpperCase() }]);
    if (error) alert(error.message);
    setValor('');
    cargarTodo();
  }

  async function guardarSitio() {
    // Validación de ambos campos
    if (!formSitio.nombre || !formSitio.localidad_id) {
      alert("Nombre del sitio y Localidad son obligatorios");
      return;
    }
    const { error } = await supabase.from('sitios').insert([{ 
      nombre: formSitio.nombre.toUpperCase(),
      localidad_id: formSitio.localidad_id 
    }]);
    if (error) alert(error.message);
    setFormSitio({ nombre: '', localidad_id: '' });
    cargarTodo();
  }

  async function guardarOperador() {
    if (!formOperador.nombre || !formOperador.sitio_id) {
      alert("Nombre y Sitio son obligatorios");
      return;
    }
    const { error } = await supabase.from('operadores').insert([formOperador]);
    if (error) alert(error.message);
    setFormOperador({ nombre: '', telefono: '', sitio_id: '' });
    cargarTodo();
  }

  async function eliminarRegistro(tabla: string, id: string) {
    if (!confirm("¿Está seguro de eliminar este registro?")) return;
    await supabase.from(tabla).delete().eq('id', id);
    cargarTodo();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <nav className="bg-white p-4 shadow-md border-b-4 border-red-700 sticky top-0 z-10">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-100 rounded-lg font-bold text-xs hover:bg-gray-200 transition-all">← VOLVER</button>
          <h1 className="text-red-700 font-black uppercase text-xl tracking-tighter">Panel de Parámetros</h1>
        </div>
        <div className="flex gap-1 mt-4 max-w-4xl mx-auto bg-gray-100 p-1 rounded-2xl">
          <button onClick={() => setTab('generales')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'generales' ? 'bg-red-700 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>General</button>
          <button onClick={() => setTab('sitios')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'sitios' ? 'bg-red-700 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>Sitios</button>
          <button onClick={() => setTab('operadores')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'operadores' ? 'bg-red-700 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>Operadores</button>
        </div>
      </nav>

      <main className="p-4 max-w-4xl mx-auto">
        {tab === 'generales' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-4">
              <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">Añadir Variedad / Proveedor / Turno</p>
              <select className="w-full p-4 border-2 rounded-2xl font-bold bg-gray-50 outline-none focus:border-red-700" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="variedad">Variedad de Palma</option>
                <option value="proveedor">Proveedor MP</option>
                <option value="turno">Turno (T1, T2, T3)</option>
              </select>
              <input type="text" placeholder="Escriba el valor aquí..." className="w-full p-4 border-2 rounded-2xl font-bold outline-none focus:border-red-700" value={valor} onChange={(e) => setValor(e.target.value)} />
              <button onClick={guardarGeneral} className="w-full bg-red-700 text-white p-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-red-800 active:scale-95 transition-all">Registrar Parámetro</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {listaGeneral.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border shadow-sm group">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-full uppercase w-fit mb-1">{item.categoria}</span>
                    <span className="font-bold text-gray-800">{item.valor}</span>
                  </div>
                  <button onClick={() => eliminarRegistro('parametros', item.id)} className="p-2 bg-gray-50 text-red-200 group-hover:text-red-600 transition-colors rounded-lg">🗑️</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA SITIOS ACTUALIZADA */}
        {tab === 'sitios' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-4">
              <p className="text-[10px] font-black text-red-700 uppercase tracking-widest text-center">Crear Nueva Ubicación / Sitio</p>
              
              <input 
                type="text" 
                placeholder="Ej: REFINERIA ORJ STO DGO" 
                className="w-full p-4 border-2 rounded-2xl font-bold outline-none focus:border-red-700" 
                value={formSitio.nombre} 
                onChange={(e) => setFormSitio({...formSitio, nombre: e.target.value})} 
              />

              {/* Selector de Localidad Añadido */}
              <select 
                className="w-full p-4 border-2 rounded-2xl font-bold bg-gray-50 outline-none focus:border-red-700 text-sm"
                value={formSitio.localidad_id}
                onChange={(e) => setFormSitio({...formSitio, localidad_id: e.target.value})}
              >
                <option value="">¿A QUÉ LOCALIDAD PERTENECE?</option>
                {localidades.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.nombre}</option>
                ))}
              </select>

              <button onClick={guardarSitio} className="w-full bg-red-700 text-white p-4 rounded-2xl font-black text-xs shadow-xl uppercase transition-all active:scale-95">Guardar Sitio</button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {sitios.map((s) => (
                <div key={s.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border shadow-sm">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 tracking-tight flex items-center gap-2">📍 {s.nombre}</span>
                    {/* Muestra la localidad vinculada */}
                    <span className="text-[10px] text-gray-400 font-bold uppercase ml-6">Zona: {s.localidades?.nombre || 'Sin asignar'}</span>
                  </div>
                  <button onClick={() => eliminarRegistro('sitios', s.id)} className="text-red-200 hover:text-red-600 text-xs font-bold p-2">ELIMINAR</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'operadores' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-4">
              <p className="text-[10px] font-black text-red-700 uppercase tracking-widest text-center">Registro de Operador</p>
              <input type="text" placeholder="NOMBRE COMPLETO" className="w-full p-4 border-2 rounded-2xl font-bold outline-none focus:border-red-700" value={formOperador.nombre} onChange={(e) => setFormOperador({...formOperador, nombre: e.target.value.toUpperCase()})} />
              <input type="tel" placeholder="TELÉFONO DE CONTACTO" className="w-full p-4 border-2 rounded-2xl font-bold outline-none focus:border-red-700" value={formOperador.telefono} onChange={(e) => setFormOperador({...formOperador, telefono: e.target.value})} />
              <select className="w-full p-4 border-2 rounded-2xl font-bold bg-gray-50 outline-none focus:border-red-700" value={formOperador.sitio_id} onChange={(e) => setFormOperador({...formOperador, sitio_id: e.target.value})}>
                <option value="">ASIGNAR A SITIO...</option>
                {sitios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <button onClick={guardarOperador} className="w-full bg-red-700 text-white p-4 rounded-2xl font-black text-xs shadow-xl uppercase">Registrar en Nómina</button>
            </div>
            <div className="space-y-2">
              {operadores.map((o) => (
                <div key={o.id} className="bg-white p-5 rounded-2xl flex justify-between items-center border shadow-sm">
                  <div>
                    <p className="font-black text-gray-800 text-base">{o.nombre}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] text-gray-400 font-bold">📞 {o.telefono || 'SIN TEL'}</span>
                      <span className="text-[10px] text-red-700 font-black uppercase">📍 {o.sitios?.nombre || 'SIN SITIO'}</span>
                    </div>
                  </div>
                  <button onClick={() => eliminarRegistro('operadores', o.id)} className="bg-red-50 p-2 rounded-xl text-red-300 hover:text-red-700">🗑️</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}