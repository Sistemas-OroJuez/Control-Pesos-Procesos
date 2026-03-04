'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getProfile() {
      // 1. Obtenemos el usuario de la sesión
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // 2. Buscamos el rol en la tabla empleados
        const { data: empleado } = await supabase
          .from('empleados')
          .select('rol')
          .eq('email', user.email)
          .single();
        
        if (empleado) {
          setUserRole(empleado.rol.toLowerCase());
        }
      }
      // 3. Importante: Terminamos de cargar aunque no haya empleado
      // para que no se quede pegado o te bote
      setLoading(false);
    }
    getProfile();
  }, []);

  // Definición de módulos
  const allModules = [
    { id: 3, name: 'Proceso de Pesado', icon: '⚖️', color: 'bg-red-700 text-white', route: '/proceso', adminOnly: false },
    { id: 4, name: 'Reportes Generales', icon: '📋', color: 'bg-white text-gray-800', route: '/reportes', adminOnly: false },
    { id: 2, name: 'Parámetros del Sistema', icon: '⚙️', color: 'bg-white text-gray-800', route: '/parametros', adminOnly: true },
    { id: 5, name: 'Reportes Gerenciales', icon: '📊', color: 'bg-white text-gray-800', route: '/gerencia', adminOnly: true },
    { id: 7, name: 'Estadísticas y Tiempos', icon: '⏱️', color: 'bg-white text-gray-800', route: '/estadisticas', adminOnly: true },
    { id: 1, name: 'Administración y Usuarios', icon: '👥', color: 'bg-white text-gray-800', route: '/admin', adminOnly: true },
  ];

  // FILTRADO DINÁMICO: Si el rol es 'operador', quitamos los módulos prohibidos
  const modules = allModules.filter(mod => {
    if (userRole === 'operador') {
      return !mod.adminOnly;
    }
    return true; // Si es admin o el rol no ha cargado, se mantienen (o puedes invertirlos)
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER CORPORATIVO */}
      <header className="bg-white shadow-md border-b-4 border-red-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-700 p-2 rounded-lg">
              <span className="text-white font-black italic text-xl">ORJ</span>
            </div>
            <div>
              <h2 className="text-xs font-black text-gray-800 uppercase leading-none">Control de Pesos</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Panel de Control Principal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Indicador de perfil para depuración rápida */}
            {!loading && (
              <span className="text-[10px] font-black text-red-700 uppercase">
                Perfil: {userRole || 'Verificando...'}
              </span>
            )}
            <button 
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/');
              }}
              className="bg-gray-800 hover:bg-black text-white px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 shadow-lg"
            >
              <span>🚪</span> SALIR
            </button>
          </div>
        </div>
      </header>

      {/* CUADRÍCULA DE MÓDULOS */}
      <main className="max-w-6xl mx-auto p-6 md:p-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <p className="font-black text-gray-400 animate-pulse">CARGANDO MÓDULOS...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {modules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => router.push(mod.route)}
                className={mod.color + " p-10 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center group"}
              >
                <span className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                  {mod.icon}
                </span>
                <span className="font-black uppercase text-[11px] tracking-widest text-center px-2 leading-tight">
                  {mod.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 w-full p-4 text-center bg-gray-100/80 backdrop-blur-sm">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">© 2026 OROJUEZ - Sistema de Control Operativo</p>
      </footer>
    </div>
  );
}