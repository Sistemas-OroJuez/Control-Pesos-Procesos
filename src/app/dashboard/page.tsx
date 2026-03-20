'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  
  // Estado para controlar si las funciones de administrador están desbloqueadas
  const [isAdmin, setIsAdmin] = useState(false);

  // Al cargar la página, verificar si el usuario ya se había autenticado como admin
  useEffect(() => {
    const savedAdminStatus = localStorage.getItem('orj_admin_access');
    if (savedAdminStatus === 'true') {
      setIsAdmin(true);
    }
  }, []);

  const handleLogoClick = () => {
    // Si ya es admin, dar opción de bloquear
    if (isAdmin) {
      const confirmLock = confirm("¿Desea cerrar el modo administrador?");
      if (confirmLock) {
        setIsAdmin(false);
        localStorage.removeItem('orj_admin_access');
      }
      return;
    }

    // Si no es admin, pedir clave
    const password = prompt("Ingrese clave de administrador para desbloquear funciones:");
    if (password === 'orj2026') { 
      setIsAdmin(true);
      localStorage.setItem('orj_admin_access', 'true');
      alert("Funciones de administrador desbloqueadas.");
    } else if (password !== null) {
      alert("Clave incorrecta.");
    }
  };

  // Definición de módulos de la aplicación
  const modules = [
    // --- MÓDULOS EXISTENTES (OPERATIVOS) ---
    { id: 3, name: 'EXTRACTORA-Proceso de Pesado', icon: '⚖️', color: 'bg-red-700 text-white', route: '/proceso', adminOnly: false },
    { id: 4, name: 'EXTRACTORA-Reportes Generales Extractora', icon: '📋', color: 'bg-white text-gray-800', route: '/reportes', adminOnly: false },
    
    // --- NUEVOS MÓDULOS DE REFINERÍA (OPERATIVOS - ABIERTOS) ---
    { id: 10, name: 'REFINERIA-Ingreso ACP', icon: '🔵', color: 'bg-blue-600 text-white', route: '/refineria/entrada', adminOnly: false },
    { id: 11, name: 'REFINERIA-Salida RBD', icon: '🟢', color: 'bg-emerald-600 text-white', route: '/refineria/salida', adminOnly: false },
    { id: 13, name: 'REFINERIA-Salida Ácido Graso', icon: '🟡', color: 'bg-amber-500 text-white', route: '/refineria/acido', adminOnly: false },
    { id: 14, name: 'REFINERIA-Inventario DS3 / Proceso', icon: '📦', color: 'bg-slate-500 text-white', route: '/refineria/inventario', adminOnly: false },
    
    // --- NUEVO MÓDULO DE GESTIÓN REFINERÍA (PROTEGIDO) ---
    { id: 12, name: 'REFINERIA-Cierre de Balance', icon: '🏭', color: 'bg-slate-900 text-white', route: '/refineria/gestion', adminOnly: true },

    // --- MÓDULOS EXISTENTES (ADMINISTRACIÓN) ---
    { id: 5, name: 'EXTRACTORA-Reportes Gerenciales', icon: '📊', color: 'bg-white text-gray-800', route: '/gerencia', adminOnly: true },
    { id: 7, name: 'EXTRACTORA-Estadísticas y Tiempos', icon: '⏱️', color: 'bg-white text-gray-800', route: '/estadisticas', adminOnly: true },
    { id: 2, name: 'Parámetros del Sistema', icon: '⚙️', color: 'bg-white text-gray-800', route: '/parametros', adminOnly: true },
    { id: 1, name: 'Administración y Usuarios', icon: '👥', color: 'bg-white text-gray-800', route: '/admin', adminOnly: true },
  ];

  // Filtrar módulos basándose en el estado isAdmin
  const filteredModules = modules.filter(mod => isAdmin ? true : !mod.adminOnly);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header Principal */}
      <header className="bg-white shadow-md border-b-4 border-red-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Logo con interacción de admin */}
            <img 
              src="/logo-orojuez.jpg" 
              alt="OroJuez Logo" 
              className={`h-16 w-auto object-contain cursor-help transition-opacity ${isAdmin ? 'opacity-100' : 'opacity-80'}`}
              onClick={handleLogoClick}
              title={isAdmin ? "Click para bloquear funciones de administrador" : "Click para funciones especiales"}
            />
            
            {/* Divisor Vertical */}
            <div className="h-10 w-[2px] bg-gray-200 hidden md:block"></div>
            
            {/* Título de la App */}
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tighter leading-none">
                OROJUEZ <span className="text-red-700">SA</span>
              </h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">
                {isAdmin ? '🛡️ MODO ADMINISTRADOR' : 'Control de Producción'}
              </p>
            </div>
          </div>
          
          {/* Botón Salir */}
          <button 
            onClick={() => {
              // Limpiar estado admin al salir si se desea (opcional)
              localStorage.removeItem('orj_admin_access');
              router.push('/');
            }}
            className="bg-gray-800 hover:bg-black text-white px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 shadow-lg"
          >
            <span>🚪</span> SALIR
          </button>
        </div>
      </header>

      {/* Grid de Módulos */}
      <main className="max-w-6xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((mod) => (
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

      {/* Footer Fijo */}
      <footer className="fixed bottom-0 w-full p-4 text-center bg-gray-100/80 backdrop-blur-sm">
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.3em]">
          OroJuez S.A. - Infraestructura Crítica de Datos
        </p>
      </footer>
    </div>
  );
}