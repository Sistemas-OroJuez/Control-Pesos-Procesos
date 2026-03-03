'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function GestionUsuarios() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rol, setRol] = useState('operador');

  useEffect(() => {
    cargarUsuarios();
  }, []);

  async function cargarUsuarios() {
    const { data } = await supabase.from('perfiles').select('*').order('created_at');
    if (data) setUsuarios(data);
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // 1. Crear el usuario en Auth (Esto requiere que el usuario actual tenga permisos o usar una Edge Function)
    // Para simplificar en esta etapa, usaremos el registro estándar:
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre, telefono, rol }
      }
    });

    if (authError) {
      alert("Error al crear cuenta: " + authError.message);
    } else if (authData.user) {
      // 2. Insertar en nuestra tabla de perfiles
      const { error: profileError } = await supabase.from('perfiles').insert([
        { id: authData.user.id, nombre, telefono, rol }
      ]);
      
      if (profileError) alert("Error en perfil: " + profileError.message);
      else {
        alert("Usuario creado con éxito");
        setEmail(''); setPassword(''); setNombre(''); setTelefono('');
        cargarUsuarios();
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-20">
      <header className="max-w-4xl mx-auto mb-6 flex justify-between items-center">
        <button onClick={() => router.push('/dashboard')} className="text-red-700 font-bold">← VOLVER</button>
        <h1 className="text-xl font-black uppercase text-gray-800 tracking-tighter">Control de Acceso</h1>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        {/* FORMULARIO DE REGISTRO */}
        <section className="bg-white p-6 rounded-3xl shadow-xl border-t-4 border-red-700">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Registrar Nuevo Personal</h2>
          <form onSubmit={crearUsuario} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Nombre Completo" className="p-4 bg-gray-50 rounded-2xl border outline-none focus:border-red-700 font-bold" value={nombre} onChange={e => setNombre(e.target.value)} required />
            <input type="email" placeholder="Correo Electrónico" className="p-4 bg-gray-50 rounded-2xl border outline-none focus:border-red-700 font-bold" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Contraseña (mín. 6 caracteres)" className="p-4 bg-gray-50 rounded-2xl border outline-none focus:border-red-700 font-bold" value={password} onChange={e => setPassword(e.target.value)} required />
            <input type="tel" placeholder="Número Celular" className="p-4 bg-gray-50 rounded-2xl border outline-none focus:border-red-700 font-bold" value={telefono} onChange={e => setTelefono(e.target.value)} />
            
            <select className="p-4 bg-gray-50 rounded-2xl border outline-none focus:border-red-700 font-bold col-span-1 md:col-span-2" value={rol} onChange={e => setRol(e.target.value)}>
              <option value="operador">OPERADOR (Ingreso de datos)</option>
              <option value="auditor">AUDITOR (Solo lectura / Reportes)</option>
              <option value="administrador">ADMINISTRADOR (Acceso Total)</option>
            </select>

            <button disabled={loading} className="p-4 bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-red-800 transition-all col-span-1 md:col-span-2">
              {loading ? 'Procesando...' : 'Crear Usuario'}
            </button>
          </form>
        </section>

        {/* LISTADO DE USUARIOS */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase px-2">Usuarios Activos</h3>
          {usuarios.map(u => (
            <div key={u.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-gray-200">
              <div>
                <p className="font-black text-gray-800">{u.nombre}</p>
                <div className="flex gap-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                    u.rol === 'administrador' ? 'bg-purple-100 text-purple-700' : 
                    u.rol === 'auditor' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>{u.rol}</span>
                  <span className="text-[9px] text-gray-400 font-bold italic">{u.telefono}</span>
                </div>
              </div>
              <button className="text-gray-300 hover:text-red-600 transition-colors">⚙️</button>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}