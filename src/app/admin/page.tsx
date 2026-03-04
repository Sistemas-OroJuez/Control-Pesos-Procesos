'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function GestionUsuarios() {
  const router = useRouter();
  
  const [isClient, setIsClient] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [localidades, setLocalidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Formulario Usuario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rol, setRol] = useState('operador');
  const [localidadId, setLocalidadId] = useState('');

  const [nuevaLocalidad, setNuevaLocalidad] = useState('');

  useEffect(() => {
    setIsClient(true);
    cargarUsuarios();
    cargarLocalidades();
  }, []);

  async function cargarLocalidades() {
    try {
      const { data } = await supabase.from('localidades').select('*').order('nombre');
      if (data) setLocalidades(data);
    } catch (e) {
      console.error("Error al cargar localidades");
    }
  }

  async function cargarUsuarios() {
    try {
      // Se utiliza la tabla empleados según la estructura proporcionada
      const { data } = await supabase.from('empleados').select('*').order('created_at');
      if (data) setUsuarios(data);
    } catch (e) {
      console.error("Error al cargar usuarios");
    }
  }

  const handleAgregarLocalidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaLocalidad.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('localidades').insert([{ nombre: nuevaLocalidad }]);
    if (error) alert("Error: " + error.message);
    else {
      setNuevaLocalidad('');
      await cargarLocalidades();
    }
    setLoading(false);
  };

  const handleEliminar = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;
    setLoading(true);
    const { error } = await supabase.from('empleados').delete().eq('id', id);
    if (error) alert(error.message);
    else setUsuarios(usuarios.filter(u => u.id !== id));
    setLoading(false);
  };

  const handleGuardarEdicion = async (id: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('empleados')
      .update({ nombre, celular: telefono, rol, localidad_id: localidadId, email, password })
      .eq('id', id);
    if (error) alert(error.message);
    else {
      setEditandoId(null);
      limpiarFormulario();
      cargarUsuarios();
    }
    setLoading(false);
  };

  const limpiarFormulario = () => {
    setEmail(''); setPassword(''); setNombre(''); setTelefono(''); setLocalidadId(''); setRol('operador');
  };

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Registro en la tabla empleados con los campos requeridos
    const { error } = await supabase.from('empleados').insert([{ 
      nombre, email, password, celular: telefono, rol, localidad_id: localidadId 
    }]);
    
    if (error) alert(error.message);
    else {
      alert("Usuario creado");
      limpiarFormulario();
      cargarUsuarios();
    }
    setLoading(false);
  }

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
        <p className="font-black text-gray-400 animate-pulse">CARGANDO MÓDULO DE ADMINISTRACIÓN...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="max-w-5xl mx-auto mb-6 flex justify-between items-center">
        <button onClick={() => router.push('/dashboard')} className="text-red-700 font-bold">← VOLVER</button>
        <h1 className="text-xl font-black uppercase text-gray-800 tracking-tighter italic">Admin Personal</h1>
      </header>

      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PANEL LOCALIDADES */}
        <section className="md:col-span-1">
          <div className="bg-white p-5 rounded-3xl shadow-xl border-t-4 border-gray-800">
            <h2 className="text-[10px] font-black text-gray-400 uppercase mb-4">📍 Sedes</h2>
            <form onSubmit={handleAgregarLocalidad} className="flex flex-col gap-2 mb-4">
              <input type="text" placeholder="Nueva Sede" className="p-3 bg-gray-50 rounded-xl border text-sm font-bold outline-none" value={nuevaLocalidad} onChange={e => setNuevaLocalidad(e.target.value)} />
              <button disabled={loading} className="p-3 bg-gray-800 text-white rounded-xl text-[10px] font-black uppercase">+ REGISTRAR</button>
            </form>
            <div className="space-y-2">
              {localidades.map(loc => (
                <div key={loc.id} className="text-[11px] font-bold bg-gray-100 p-2 rounded-lg border border-gray-100 flex justify-between">
                  <span>📍 {loc.nombre.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PANEL USUARIOS */}
        <div className="md:col-span-2 space-y-6">
          <section className="bg-white p-6 rounded-3xl shadow-xl border-t-4 border-red-700">
            <h2 className="text-[10px] font-black text-gray-400 uppercase mb-4">👤 {editandoId ? 'Editar' : 'Nuevo'} Usuario</h2>
            <form onSubmit={editandoId ? (e) => {e.preventDefault(); handleGuardarEdicion(editandoId)} : crearUsuario} className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input type="text" placeholder="Nombre" className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none" value={nombre} onChange={e => setNombre(e.target.value)} required />
                <input type="tel" placeholder="Celular" className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none" value={telefono} onChange={e => setTelefono(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input type="email" placeholder="Email" className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none" value={email} onChange={e => setEmail(e.target.value)} required />
                <input type="text" placeholder="Contraseña" className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <select className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none" value={rol} onChange={e => setRol(e.target.value)}>
                  <option value="operador">OPERADOR</option>
                  <option value="auditor">AUDITOR</option>
                  <option value="administrador">ADMINISTRADOR</option>
                </select>
                <select className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none" value={localidadId} onChange={e => setLocalidadId(e.target.value)} required>
                  <option value="">-- SELECCIONAR SEDE --</option>
                  {localidades.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.nombre.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <button disabled={loading} className="p-4 bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg">
                {loading ? 'Cargando...' : editandoId ? 'Guardar Cambios' : 'Crear Acceso'}
              </button>
            </form>
          </section>

          <section className="space-y-3">
            {usuarios.map(u => (
              <div key={u.id} className="bg-white p-4 rounded-3xl flex justify-between items-center shadow-sm border border-gray-200">
                <div className="flex-1">
                  <p className="font-black text-gray-800 text-sm uppercase">{u.nombre}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 mt-1">
                    <span className="text-[10px] text-blue-600 font-bold">📧 {u.email}</span>
                    <span className="text-[10px] text-green-600 font-bold">🔑 {u.password}</span>
                    <span className="text-[10px] text-gray-500 font-bold">📞 {u.celular || 'S/N'}</span>
                    <span className="text-[9px] font-bold text-gray-400">🏠 {localidades.find(l => l.id === u.localidad_id)?.nombre || 'Sin Sede'}</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-md bg-red-50 text-red-700 uppercase">{u.rol}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => {
                    setEditandoId(u.id); setNombre(u.nombre); setTelefono(u.celular || ''); setRol(u.rol); setLocalidadId(u.localidad_id || '');
                    setEmail(u.email); setPassword(u.password);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }} className="p-3 text-gray-400">⚙️</button>
                  <button onClick={() => handleEliminar(u.id)} className="p-3 text-gray-400">🗑️</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}