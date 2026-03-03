'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function GestionUsuarios() {
  const router = useRouter();
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

  // Formulario Localidad
  const [nuevaLocalidad, setNuevaLocalidad] = useState('');

  useEffect(() => {
    cargarUsuarios();
    cargarLocalidades();
  }, []);

  async function cargarLocalidades() {
    const { data } = await supabase.from('localidades').select('*').order('nombre');
    if (data) setLocalidades(data);
  }

  async function cargarUsuarios() {
    const { data } = await supabase.from('perfiles').select('*').order('created_at');
    if (data) setUsuarios(data);
  }

  // --- GESTIÓN DE LOCALIDADES ---
  const handleAgregarLocalidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaLocalidad.trim()) return;
    
    setLoading(true);
    const { error } = await supabase.from('localidades').insert([{ nombre: nuevaLocalidad }]);
    
    if (error) {
      alert("Error: " + error.message);
    } else {
      setNuevaLocalidad('');
      await cargarLocalidades();
      alert("Localidad agregada correctamente");
    }
    setLoading(false);
  };

  // --- GESTIÓN DE USUARIOS (ELIMINAR) ---
  const handleEliminar = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;
    setLoading(true);
    const { error } = await supabase.from('perfiles').delete().eq('id', id);
    if (error) {
      alert("Error al eliminar: " + error.message);
    } else {
      setUsuarios(usuarios.filter(u => u.id !== id));
      alert("Usuario eliminado");
    }
    setLoading(false);
  };

  // --- GESTIÓN DE USUARIOS (GUARDAR EDICIÓN) ---
  const handleGuardarEdicion = async (id: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('perfiles')
      .update({ 
        nombre, 
        telefono, 
        rol, 
        localidad_id: localidadId 
      })
      .eq('id', id);

    if (error) {
      alert("Error al actualizar: " + error.message);
    } else {
      alert("Usuario actualizado correctamente");
      setEditandoId(null);
      limpiarFormulario();
      cargarUsuarios();
    }
    setLoading(false);
  };

  const limpiarFormulario = () => {
    setEmail('');
    setPassword('');
    setNombre('');
    setTelefono('');
    setLocalidadId('');
    setRol('operador');
  };

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    // 1. Crear en Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        data: { nombre, telefono, rol, localidad_id: localidadId } 
      }
    });

    if (authError) {
      alert("Error en Auth: " + authError.message);
    } else if (authData.user) {
      // 2. Upsert manual en perfiles para asegurar datos
      const { error: profileError } = await supabase.from('perfiles').upsert([{ 
        id: authData.user.id, 
        nombre, 
        telefono, 
        rol, 
        localidad_id: localidadId 
      }]);
      
      if (profileError) console.error("Error perfil:", profileError.message);
      
      alert("Usuario creado con éxito");
      limpiarFormulario();
      cargarUsuarios();
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-20">
      <header className="max-w-5xl mx-auto mb-6 flex justify-between items-center">
        <button onClick={() => router.push('/dashboard')} className="text-red-700 font-bold hover:underline">← PANEL PRINCIPAL</button>
        <h1 className="text-2xl font-black uppercase text-gray-800 tracking-tighter italic">ADMINISTRACIÓN DE PERSONAL</h1>
      </header>

      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* PANEL DE LOCALIDADES */}
        <section className="md:col-span-1">
          <div className="bg-white p-5 rounded-3xl shadow-xl border-t-4 border-gray-800 sticky top-4">
            <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">📍 Gestionar Localidades</h2>
            <form onSubmit={handleAgregarLocalidad} className="flex flex-col gap-2 mb-4">
              <input 
                type="text" 
                placeholder="Nombre de sede (ej: El Coca)" 
                className="p-3 bg-gray-50 rounded-xl border text-sm font-bold outline-none focus:border-gray-800"
                value={nuevaLocalidad}
                onChange={e => setNuevaLocalidad(e.target.value)}
              />
              <button disabled={loading} className="p-3 bg-gray-800 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-colors">
                + REGISTRAR SEDE
              </button>
            </form>
            
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {localidades.map(loc => (
                <div key={loc.id} className="text-[11px] font-bold bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-100">
                  <span className="text-gray-700 uppercase">📍 {loc.nombre}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PANEL DE USUARIOS */}
        <div className="md:col-span-2 space-y-6">
          <section className="bg-white p-6 rounded-3xl shadow-xl border-t-4 border-red-700">
            <h2 className="text-[11px] font-black text-gray-400 uppercase mb-4 tracking-widest">
              👤 {editandoId ? 'EDITAR DATOS DE USUARIO' : 'REGISTRAR NUEVO ACCESO'}
            </h2>
            <form onSubmit={editandoId ? (e) => {e.preventDefault(); handleGuardarEdicion(editandoId)} : crearUsuario} className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 ml-2">NOMBRE COMPLETO</label>
                    <input type="text" className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none focus:border-red-700" value={nombre} onChange={e => setNombre(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 ml-2">TELÉFONO / CELULAR</label>
                    <input type="tel" className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none focus:border-red-700" value={telefono} onChange={e => setTelefono(e.target.value)} />
                </div>
              </div>
              
              {!editandoId && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 ml-2">CORREO ELECTRÓNICO</label>
                    <input type="email" className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none focus:border-red-700" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 ml-2">CONTRASEÑA TEMPORAL</label>
                    <input type="password" className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none focus:border-red-700" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 ml-2">ROL ASIGNADO</label>
                    <select className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none focus:border-red-700" value={rol} onChange={e => setRol(e.target.value)}>
                        <option value="operador">OPERADOR (Ingreso de Datos)</option>
                        <option value="auditor">AUDITOR (Solo Lectura)</option>
                        <option value="administrador">ADMINISTRADOR (Acceso Total)</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 ml-2">SEDE / LOCALIDAD</label>
                    <select className="p-4 bg-gray-50 rounded-2xl border font-bold outline-none focus:border-red-700" value={localidadId} onChange={e => setLocalidadId(e.target.value)} required>
                        <option value="">-- SELECCIONAR --</option>
                        {localidades.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.nombre.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button disabled={loading} className="flex-1 p-4 bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-red-800 transition-all">
                    {loading ? 'PROCESANDO...' : editandoId ? 'GUARDAR CAMBIOS' : 'CREAR NUEVA CUENTA'}
                </button>
                {editandoId && (
                    <button type="button" onClick={() => {setEditandoId(null); limpiarFormulario();}} className="p-4 bg-gray-200 text-gray-600 rounded-2xl font-black uppercase tracking-widest">
                        CANCELAR
                    </button>
                )}
              </div>
            </form>
          </section>

          {/* LISTADO DE USUARIOS */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-gray-400 uppercase px-2 tracking-widest">Personal con Acceso al Sistema</h3>
            {usuarios.map(u => (
              <div key={u.id} className="bg-white p-5 rounded-3xl flex justify-between items-center shadow-sm border border-gray-200 hover:border-red-200 transition-colors">
                <div>
                  <p className="font-black text-gray-800 text-sm uppercase">{u.nombre}</p>
                  <div className="flex gap-2 items-center mt-1">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${
                      u.rol === 'administrador' ? 'bg-purple-100 text-purple-700' : 
                      u.rol === 'auditor' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>{u.rol}</span>
                    <span className="text-[9px] font-bold text-gray-400 italic">
                      🏠 {localidades.find(l => l.id === u.localidad_id)?.nombre || 'Sin Sede'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => {
                    setEditandoId(u.id);
                    setNombre(u.nombre);
                    setTelefono(u.telefono || '');
                    setRol(u.rol);
                    setLocalidadId(u.localidad_id || '');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }} className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-800 transition-all">⚙️</button>
                  <button onClick={() => handleEliminar(u.id)} className="p-3 bg-gray-50 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all">🗑️</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}