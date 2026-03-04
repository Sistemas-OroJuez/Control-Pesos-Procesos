'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Verificamos el rol apenas carga la página
  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: empleado } = await supabase
            .from('empleados')
            .select('rol')
            .eq('email', user.email)
            .single();
          
          if (empleado) setUserRole(empleado.rol.toLowerCase());
        }
      } catch (error) {
        console.error("Error de perfil:", error);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, []);

  const allModules = [
    { id: 3, name: 'Proceso de Pesado', icon: '⚖️', color: 'bg-red-700 text-white', route: '/proceso', adminOnly: false },
    { id: 2, name: 'Parámetros del Sistema', icon: '⚙️', color: 'bg-white text-gray-800', route: '/parametros', adminOnly: true },
    { id: 4, name: 'Reportes Generales', icon: '📋', color: 'bg-white text-gray-800', route: '/reportes', adminOnly: false },
    { id: 5, name: 'Reportes Gerenciales', icon: '📊', color: 'bg-white text-gray-800', route: '/gerencia', adminOnly: true },
    { id: 7, name: 'Estadísticas y Tiempos', icon: '⏱️', color: 'bg-white text-gray-800', route: '/estadisticas', adminOnly: true },
    { id: 1, name: 'Administración y Usuarios', icon: '👥', color: 'bg-white text-gray-800', route: '/admin', adminOnly: true },
  ];

  // 2. Filtramos los módulos basados en el rol
  const modules = allModules.filter(mod => {
    // Si todavía está cargando el rol, mostramos solo los básicos por seguridad
    if (loading && mod.adminOnly) return false;
    // Si es operador, ocultamos los que son solo para admin
    if (userRole === 'operador' && mod.adminOnly) return false;
    return true;
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
            {/* Indicador de perfil visual */}
            {!loading && (
              <span className="text-[9px] font-black bg-gray-100 px-2 py-1 rounded border uppercase text-gray-500">
                {userRole === 'administrador' ? '🛡️ Admin' : '👷 Operador'}
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

      {/* CUADRÍCULA DE MÓDULOS REORGANIZADA */}
      <main className="max-w-6xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => router.push(mod.route)}
              className={mod.color + " p-10 rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center group"}
            >
              <span className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                {mod.icon}
              </span>
              <span className="font-bold uppercase text-[11px] tracking-widest text-center px-2 leading-tight">
                {mod.name}
              </span>
            </button>
          ))}
        </div>
      </main>

      <footer className="fixed bottom-0 w-full p-4 text-center bg-gray-100/80 backdrop-blur-sm">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">© 2026 OROJUEZ - Sistema de Control Operativo</p>
      </footer>
    </div>
  );
}