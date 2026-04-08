'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  
  const [isAdmin, setIsAdmin] = useState(false);
  // Nuevo estado para controlar qué vista de botones mostrar
  const [activeView, setActiveView] = useState<'principal' | 'extractora' | 'refineria'>('principal');

  useEffect(() => {
    const savedAdminStatus = localStorage.getItem('orj_admin_access');
    if (savedAdminStatus === 'true') {
      setIsAdmin(true);
    }
  }, []);

  const handleLogoClick = () => {
    if (isAdmin) {
      const confirmLock = confirm("¿Desea cerrar el modo administrador?");
      if (confirmLock) {
        setIsAdmin(false);
        localStorage.removeItem('orj_admin_access');
      }
      return;
    }

    const password = prompt("Ingrese clave de administrador para desbloquear funciones:");
    if (password === 'orj2026') { 
      setIsAdmin(true);
      localStorage.setItem('orj_admin_access', 'true');
      alert("Funciones de administrador desbloqueadas.");
    } else if (password !== null) {
      alert("Clave incorrecta.");
    }
  };

  // Definición de módulos de la aplicación (Lista actualizada con Reportes Refinería)
  const allModules = [
    // EXTRACTORA
    { id: 3, category: 'extractora', name: 'Proceso de Pesado', icon: '⚖️', color: 'bg-red-700 text-white', route: '/proceso', adminOnly: false },
    { id: 4, category: 'extractora', name: 'Reportes Generales', icon: '📋', color: 'bg-white text-gray-800', route: '/reportes', adminOnly: false },
    { id: 5, category: 'extractora', name: 'Reportes Gerenciales', icon: '📊', color: 'bg-white text-gray-800', route: '/gerencia', adminOnly: true },
    { id: 7, category: 'extractora', name: 'Estadísticas y Tiempos', icon: '⏱️', color: 'bg-white text-gray-800', route: '/estadisticas', adminOnly: true },
    
    // REFINERÍA
    { id: 10, category: 'refineria', name: 'Ingreso ACP', icon: '🔵', color: 'bg-blue-600 text-white', route: '/refineria/entrada', adminOnly: false },
    { id: 11, category: 'refineria', name: 'Salida RBD', icon: '🟢', color: 'bg-emerald-600 text-white', route: '/refineria/salida', adminOnly: false },
    { id: 13, category: 'refineria', name: 'Salida Ácido Graso', icon: '🟡', color: 'bg-amber-500 text-white', route: '/refineria/acido', adminOnly: false },
    { id: 14, category: 'refineria', name: 'Inventario DS3 / Proceso', icon: '📦', color: 'bg-slate-500 text-white', route: '/refineria/inventario', adminOnly: false },
    
    // BOTÓN DE REPORTES REFINERÍA AGREGADO
    { id: 15, category: 'refineria', name: 'Auditoría y Reportes', icon: '📈', color: 'bg-white text-gray-800 border-2 border-gray-200', route: '/refineria/reportes', adminOnly: false },
    
    { id: 12, category: 'refineria', name: 'Cierre de Balance', icon: '🏭', color: 'bg-slate-900 text-white', route: '/refineria/gestion', adminOnly: true },

    // GENERALES (Se muestran en el "Home" si es admin)
    { id: 2, category: 'general', name: 'Parámetros del Sistema', icon: '⚙️', color: 'bg-white text-gray-800', route: '/parametros', adminOnly: true },
    { id: 1, category: 'general', name: 'Administración y Usuarios', icon: '👥', color: 'bg-white text-gray-800', route: '/admin', adminOnly: true },
  ];

  // Filtrar según categoría activa y permisos
  const filteredModules = allModules.filter(mod => {
    const hasPermission = isAdmin ? true : !mod.adminOnly;
    return hasPermission && mod.category === activeView;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md border-b-4 border-red-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img 
              src="/logo-orojuez.jpg" 
              alt="OroJuez Logo" 
              className={`h-16 w-auto object-contain cursor-help transition-opacity ${isAdmin ? 'opacity-100' : 'opacity-80'}`}
              onClick={handleLogoClick}
            />
            <div className="h-10 w-[2px] bg-gray-200 hidden md:block"></div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tighter leading-none">
                OROJUEZ <span className="text-red-700">SA</span>
              </h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">
                {isAdmin ? '🛡️ MODO ADMINISTRADOR' : 'Control de Producción'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => {
              localStorage.removeItem('orj_admin_access');
              router.push('/');
            }}
            className="bg-gray-800 hover:bg-black text-white px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 shadow-lg"
          >
            <span>🚪</span> SALIR
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-12">
        
        {/* VISTA PRINCIPAL: SELECCIÓN DE ÁREA */}
        {activeView === 'principal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-10">
            <button
              onClick={() => setActiveView('extractora')}
              className="bg-red-700 text-white p-16 rounded-3xl shadow-xl hover:-translate-y-2 transition-all flex flex-col items-center group"
            >
              <span className="text-7xl mb-6 group-hover:scale-110 transition-transform">🏗️</span>
              <span className="text-2xl font-black tracking-tighter uppercase">Área Extractora</span>
            </button>

            <button
              onClick={() => setActiveView('refineria')}
              className="bg-slate-800 text-white p-16 rounded-3xl shadow-xl hover:-translate-y-2 transition-all flex flex-col items-center group"
            >
              <span className="text-7xl mb-6 group-hover:scale-110 transition-transform">🏭</span>
              <span className="text-2xl font-black tracking-tighter uppercase">Área Refinería</span>
            </button>
          </div>
        )}

        {/* VISTA DE SUB-MÓDULOS */}
        {activeView !== 'principal' && (
          <div>
            <button 
              onClick={() => setActiveView('principal')}
              className="mb-8 flex items-center gap-2 text-red-700 font-bold hover:underline transition-all"
            >
              ⬅️ VOLVER AL MENÚ PRINCIPAL
            </button>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredModules.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => router.push(mod.route)}
                  className={mod.color + " p-10 rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center group"}
                >
                  <span className="text-4xl mb-4 group-hover:scale-110 transition-transform">{mod.icon}</span>
                  <span className="font-bold uppercase text-[11px] tracking-widest text-center px-2 leading-tight">{mod.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BOTONES GENERALES DE ADMIN (Solo aparecen en el principal si es admin) */}
        {isAdmin && activeView === 'principal' && (
          <div className="mt-12 border-t border-gray-200 pt-10">
            <p className="text-center text-gray-400 font-bold text-[10px] tracking-[0.4em] uppercase mb-8">Configuración Global</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {allModules.filter(m => m.category === 'general').map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => router.push(mod.route)}
                  className={mod.color + " p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all flex items-center justify-center gap-4"}
                >
                  <span className="text-2xl">{mod.icon}</span>
                  <span className="font-bold uppercase text-[10px] tracking-widest">{mod.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 w-full p-4 text-center bg-gray-100/80 backdrop-blur-sm">
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.3em]">
          OroJuez S.A. - Infraestructura Crítica de Datos
        </p>
      </footer>
    </div>
  );
}