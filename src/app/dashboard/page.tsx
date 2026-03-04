'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Consultamos el rol y nombre en la tabla empleados
          const { data: empleado } = await supabase
            .from('empleados')
            .select('rol, nombre')
            .eq('email', user.email)
            .single();
          
          if (empleado) {
            setUserRole(empleado.rol.toLowerCase());
            setUserName(empleado.nombre);
          }
        }
      } catch (error) {
        console.error("Error verificando permisos:", error);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, []);

  // Definición completa de módulos
  const allModules = [
    { id: 3, name: 'Proceso de Pesado', icon: '⚖️', color: 'bg-red-700 text-white', route: '/proceso', adminOnly: false },
    { id: 4, name: 'Reportes Generales', icon: '📋', color: 'bg-white text-gray-800', route: '/reportes', adminOnly: false },
    { id: 2, name: 'Parámetros del Sistema', icon: '⚙️', color: 'bg-white text-gray-800', route: '/parametros', adminOnly: true },
    { id: 5, name: 'Reportes Gerenciales', icon: '📊', color: 'bg-white text-gray-800', route: '/gerencia', adminOnly: true },
    { id: 7, name: 'Estadísticas y Tiempos', icon: '⏱️', color: 'bg-white text-gray-800', route: '/estadisticas', adminOnly: true },
    { id: 1, name: 'Administración y Usuarios', icon: '👥', color: 'bg-white text-gray-800', route: '/admin', adminOnly: true },
  ];

  // FILTRADO ESTRICTO: Solo devolvemos los módulos permitidos
  const modules = allModules.filter(mod => {
    if (userRole === 'operador') {
      return !mod.adminOnly; // Para operador, solo lo que NO es adminOnly
    }
    return true; // El administrador ve todo
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
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter italic">OroJuez S.A.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* PERFIL A LA DERECHA */}
            {!loading && (
              <div className="text-right mr-2 hidden md:block">
                <p className="text-[9px] font-black text-gray-400 uppercase leading-none">{userName}</p>
                <p className="text-[10px] font-bold text-red-700 uppercase">
                  {userRole === 'administrador' ? '🛡️ ADMIN' : '👷 OPERADOR'}
                </p>
              </div>
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

      {/* CUADRÍCULA DE MÓDULOS FILTRADA */}
      <main className="max-w-6xl mx-auto p-6 md:p-12">
        {loading ? (
          <div className="text-center py-20 font-black text-gray-300 animate-pulse uppercase tracking-widest">
            Sincronizando Accesos...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {modules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => router.push(mod.route)}
                className={`${mod.color} p-12 rounded-[2.5rem] shadow-sm border border-gray-200 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center group`}
              >
                <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">
                  {mod.icon}
                </span>
                <span className="font-black uppercase text-xs tracking-widest text-center px-2">
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