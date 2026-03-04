'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile();
  }, []);

  async function getProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/'); 
        return;
      }

      // Buscamos el rol en la tabla empleados
      const { data: empleado } = await supabase
        .from('empleados')
        .select('rol')
        .eq('email', user.email)
        .single();

      if (empleado) {
        setUserRole(empleado.rol.toLowerCase());
      }
    } catch (error) {
      console.error("Error verificando rol:", error);
    } finally {
      setLoading(false);
    }
  }

  // Lista maestra de módulos con su nivel de acceso
  const allModules = [
    { id: 3, name: 'Proceso de Pesado', icon: '⚖️', color: 'bg-red-700 text-white', route: '/proceso', adminOnly: false },
    { id: 4, name: 'Reportes Generales', icon: '📋', color: 'bg-white text-gray-800', route: '/reportes', adminOnly: false },
    { id: 2, name: 'Parámetros del Sistema', icon: '⚙️', color: 'bg-white text-gray-800', route: '/parametros', adminOnly: true },
    { id: 5, name: 'Reportes Gerenciales', icon: '📊', color: 'bg-white text-gray-800', route: '/gerencia', adminOnly: true },
    { id: 7, name: 'Estadísticas y Tiempos', icon: '⏱️', color: 'bg-white text-gray-800', route: '/estadisticas', adminOnly: true },
    { id: 1, name: 'Administración y Usuarios', icon: '👥', color: 'bg-white text-gray-800', route: '/admin', adminOnly: true },
  ];

  // FILTRO: Si el usuario es operador, quitamos los módulos que son 'adminOnly'
  const allowedModules = allModules.filter(mod => {
    if (userRole === 'operador') {
      return !mod.adminOnly; // Solo devuelve los que NO son exclusivos de admin
    }
    return true; // El administrador ve todo
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="font-black text-gray-400 animate-pulse uppercase">Verificando Acceso...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md border-b-4 border-red-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-700 p-2 rounded-lg">
              <span className="text-white font-black italic text-xl">ORJ</span>
            </div>
            <h2 className="text-xs font-black text-gray-800 uppercase leading-none md:block hidden">
              Control de Pesos <br/> <span className="text-gray-400">Dashboard</span>
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-black bg-slate-100 px-3 py-1 rounded-full text-slate-600 uppercase border border-slate-200">
                {userRole === 'administrador' ? '🛡️ Admin' : '👷 Operador'}
             </span>
             <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/');
                }}
                className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase shadow-lg"
              >
                Salir
              </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {allowedModules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => router.push(mod.route)}
              className={mod.color + " p-12 rounded-[2.5rem] shadow-sm border border-gray-200 hover:shadow-2xl hover:-translate-y-1 transition-all flex flex-col items-center justify-center group"}
            >
              <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">{mod.icon}</span>
              <span className="font-black uppercase text-xs tracking-widest text-center">{mod.name}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}