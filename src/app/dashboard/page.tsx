'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const emailActual = session.user.email?.toLowerCase().trim() || '';
          setUserEmail(emailActual);
          console.log("Email detectado en sesión:", emailActual);

          // 1. HARDCODE DE SEGURIDAD (Lista maestra de administradores)
          // Si tu correo está aquí, entrarás como admin sí o sí
          const adminsMaestros = [
            'sistemas.orj@gmail.com',
            'operaciones.industria@gmail.com',
            'produccion.epacem@gmail.com'
          ];

          if (adminsMaestros.includes(emailActual)) {
            console.log("Acceso concedido por Lista Maestra");
            setUserRole('administrador');
            setLoading(false);
            return;
          }

          // 2. CONSULTA A BASE DE DATOS (Para el resto de usuarios)
          const { data: empleado } = await supabase
            .from('empleados')
            .select('rol')
            .eq('email', emailActual)
            .maybeSingle();
          
          if (empleado) {
            console.log("Rol encontrado en DB:", empleado.rol);
            setUserRole(empleado.rol.toLowerCase().trim());
          } else {
            setUserRole('operador');
          }
        }
      } catch (error) {
        console.error("Error crítico:", error);
        setUserRole('operador');
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, []);

  const allModules = [
    { id: 3, name: 'Proceso de Pesado', icon: '⚖️', color: 'bg-red-700 text-white', route: '/proceso', adminOnly: false },
    { id: 4, name: 'Reportes Generales', icon: '📋', color: 'bg-white text-gray-800', route: '/reportes', adminOnly: false },
    { id: 2, name: 'Parámetros del Sistema', icon: '⚙️', color: 'bg-white text-gray-800', route: '/parametros', adminOnly: true },
    { id: 5, name: 'Reportes Gerenciales', icon: '📊', color: 'bg-white text-gray-800', route: '/gerencia', adminOnly: true },
    { id: 7, name: 'Estadísticas y Tiempos', icon: '⏱️', color: 'bg-white text-gray-800', route: '/estadisticas', adminOnly: true },
    { id: 1, name: 'Administración y Usuarios', icon: '👥', color: 'bg-white text-gray-800', route: '/admin', adminOnly: true },
  ];

  // FILTRADO
  const modules = allModules.filter(mod => {
    if (userRole === 'administrador') return true;
    return !mod.adminOnly;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md border-b-4 border-red-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-700 p-2 rounded-lg">
              <span className="text-white font-black italic text-xl">ORJ</span>
            </div>
            <div>
              <h2 className="text-xs font-black text-gray-800 uppercase leading-none">OroJuez S.A.</h2>
              <p className="text-[9px] text-gray-400 font-bold uppercase">{userEmail}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${userRole === 'administrador' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {loading ? '...' : userRole?.toUpperCase()}
              </span>
            </div>
            <button 
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = '/'; 
              }}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-[10px] uppercase"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto mt-10">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => router.push(mod.route)}
              className={`${mod.color} p-12 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all flex flex-col items-center group`}
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