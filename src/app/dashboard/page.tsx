'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    async function checkAccess() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const email = session.user.email?.toLowerCase().trim();
        setDebugInfo(email || '');

        // LISTA MAESTRA (Fuerza Bruta)
        const esAdmin = [
          'sistemas.orj@gmail.com',
          'operaciones.industria@gmail.com',
          'produccion.epacem@gmail.com'
        ].includes(email || '');

        if (esAdmin) {
          setUserRole('administrador');
        } else {
          // Si no está en la lista, preguntar a la tabla
          const { data } = await supabase
            .from('empleados')
            .select('rol')
            .eq('email', email)
            .maybeSingle();
          setUserRole(data?.rol?.toLowerCase().trim() || 'operador');
        }
      }
      setLoading(false);
    }
    checkAccess();
  }, []);

  const allModules = [
    { id: 3, name: 'Proceso de Pesado', route: '/proceso', admin: false, icon: '⚖️', color: 'bg-red-700 text-white' },
    { id: 4, name: 'Reportes Generales', route: '/reportes', admin: false, icon: '📋', color: 'bg-white text-gray-800' },
    { id: 2, name: 'Parámetros', route: '/parametros', admin: true, icon: '⚙️', color: 'bg-white text-gray-800' },
    { id: 5, name: 'Gerencia', route: '/gerencia', admin: true, icon: '📊', color: 'bg-white text-gray-800' },
    { id: 7, name: 'Estadísticas', route: '/estadisticas', admin: true, icon: '⏱️', color: 'bg-white text-gray-800' },
    { id: 1, name: 'Usuarios', route: '/admin', admin: true, icon: '👥', color: 'bg-white text-gray-800' },
  ];

  // Si es administrador muestra 6 botones, si no, solo 2.
  const modulesToShow = allModules.filter(m => userRole === 'administrador' ? true : !m.admin);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 flex justify-between items-center border-b-4 border-red-700">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase">Usuario: {debugInfo}</p>
            <p className="text-lg font-black text-red-700 uppercase">
              PERFIL: {loading ? 'Cargando...' : userRole}
            </p>
          </div>
          <button onClick={() => { supabase.auth.signOut(); window.location.href='/'; }} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold">SALIR</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {modulesToShow.map(mod => (
            <button key={mod.id} onClick={() => router.push(mod.route)} className={`${mod.color} p-10 rounded-3xl shadow-sm flex flex-col items-center border border-gray-200`}>
              <span className="text-4xl mb-2">{mod.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-widest">{mod.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}