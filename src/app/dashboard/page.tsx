'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar cambios en la sesión de Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const email = session.user.email?.toLowerCase().trim() || '';
        setUserEmail(email);
        fetchRole(email);
      } else if (event === 'SIGNED_OUT') {
        router.push('/');
      }
    });

    // Carga inicial
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const email = session.user.email?.toLowerCase().trim() || '';
        setUserEmail(email);
        await fetchRole(email);
      } else {
        // Si después de 2 segundos no hay sesión, algo anda mal
        setTimeout(() => setLoading(false), 2000);
      }
    }

    async function fetchRole(email: string) {
      try {
        const { data: empleado } = await supabase
          .from('empleados')
          .select('rol')
          .eq('email', email)
          .maybeSingle();
        
        if (empleado) {
          setUserRole(empleado.rol.toLowerCase().trim());
        } else {
          setUserRole('operador');
        }
      } catch (e) {
        setUserRole('operador');
      } finally {
        setLoading(false);
      }
    }

    init();
    return () => subscription.unsubscribe();
  }, [router]);

  const allModules = [
    { id: 3, name: 'Proceso de Pesado', route: '/proceso', admin: false, icon: '⚖️', color: 'bg-red-700 text-white' },
    { id: 4, name: 'Reportes Generales', route: '/reportes', admin: false, icon: 'bg-white text-gray-800' },
    { id: 2, name: 'Parámetros del Sistema', route: '/parametros', admin: true, icon: '⚙️', color: 'bg-white text-gray-800' },
    { id: 5, name: 'Reportes Gerenciales', route: '/gerencia', admin: true, icon: '📊', color: 'bg-white text-gray-800' },
    { id: 7, name: 'Estadísticas y Tiempos', route: '/estadisticas', admin: true, icon: '⏱️', color: 'bg-white text-gray-800' },
    { id: 1, name: 'Administración y Usuarios', route: '/admin', admin: true, icon: '👥', color: 'bg-white text-gray-800' },
  ];

  // FILTRO: Solo admin ve los protegidos. 
  // IMPORTANTE: Si es null (cargando), mostramos los básicos.
  const modules = allModules.filter(m => userRole === 'administrador' ? true : !m.admin);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md border-b-4 border-red-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-700 p-2 rounded-lg">
              <span className="text-white font-black italic text-xl">ORJ</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase leading-none">
                {userEmail || 'Buscando usuario...'}
              </p>
              <h2 className="text-sm font-black text-gray-800 uppercase leading-none mt-1">
                PERFIL: {loading ? 'Sincronizando...' : (userRole || 'Operador')}
              </h2>
            </div>
          </div>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 mt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => router.push(mod.route)}
              className={`${mod.color} p-12 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center hover:shadow-xl transition-all`}
            >
              <span className="text-5xl mb-4">{mod.icon}</span>
              <span className="font-black uppercase text-xs tracking-widest text-center px-2">{mod.name}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}