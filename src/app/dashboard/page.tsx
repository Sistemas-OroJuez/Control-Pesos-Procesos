'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  // Por defecto, asumimos que es administrador para que NO se bloqueen los botones
  const [userRole, setUserRole] = useState<string>('administrador');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const email = session.user.email?.toLowerCase().trim();
        
        // BLOQUEO EXPLÍCITO: Solo si el email es el del operador, cambiamos el rol
        if (email === 'extractora.industria@gmail.com') {
          setUserRole('operador');
        } else {
          // Para cualquier otro correo (incluyendo los tuyos), se queda como administrador
          setUserRole('administrador');
        }
      }
      setLoading(false);
    }
    checkUser();
  }, []);

  // Tu lista de módulos original tal cual estaba
  const modules = [
    { id: 3, name: 'Proceso de Pesado', icon: '⚖️', color: 'bg-red-700 text-white', route: '/proceso', adminOnly: false },
    { id: 2, name: 'Parámetros del Sistema', icon: '⚙️', color: 'bg-white text-gray-800', route: '/parametros', adminOnly: true },
    { id: 4, name: 'Reportes Generales', icon: '📋', color: 'bg-white text-gray-800', route: '/reportes', adminOnly: false },
    { id: 5, name: 'Reportes Gerenciales', icon: '📊', color: 'bg-white text-gray-800', route: '/gerencia', adminOnly: true },
    { id: 7, name: 'Estadísticas y Tiempos', icon: '⏱️', color: 'bg-white text-gray-800', route: '/estadisticas', adminOnly: true },
    { id: 1, name: 'Administración y Usuarios', icon: '👥', color: 'bg-white text-gray-800', route: '/admin', adminOnly: true },
  ];

  // Filtro simple: Si NO eres operador, ves todo. Si eres operador, ocultamos los adminOnly.
  const visibleModules = modules.filter(mod => {
    if (userRole === 'operador') {
      return !mod.adminOnly;
    }
    return true; // Administrador ve TODO
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md border-b-4 border-red-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
             {/* Tu logo y textos originales */}
             <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tighter leading-none">OROJUEZ <span className="text-red-700">SA</span></h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                {loading ? 'CARGANDO...' : `SISTEMA - ACCESO: ${userRole.toUpperCase()}`}
              </p>
            </div>
          </div>
          
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
            className="bg-gray-800 hover:bg-black text-white px-5 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg"
          >
            <span>🚪</span> SALIR
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleModules.map((mod) => (
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
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.3em]">
          OroJuez S.A. - Control Operativo
        </p>
      </footer>
    </div>
  );
}