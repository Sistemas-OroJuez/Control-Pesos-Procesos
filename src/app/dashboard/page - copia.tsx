'use client';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();

  const modules = [
    { id: 3, name: 'Proceso de Pesado', icon: '⚖️', color: 'bg-red-700 text-white', route: '/proceso' },
    { id: 2, name: 'Parámetros del Sistema', icon: '⚙️', color: 'bg-white text-gray-800', route: '/parametros' },
    { id: 4, name: 'Reportes Generales', icon: '📋', color: 'bg-white text-gray-800', route: '/reportes' },
    { id: 5, name: 'Reportes Gerenciales', icon: '📊', color: 'bg-white text-gray-800', route: '/gerencia' },
    { id: 7, name: 'Estadísticas y Tiempos', icon: '⏱️', color: 'bg-white text-gray-800', route: '/estadisticas' },
    { id: 1, name: 'Administración y Usuarios', icon: '👥', color: 'bg-white text-gray-800', route: '/admin' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER CORPORATIVO */}
      <header className="bg-white shadow-md border-b-4 border-red-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img 
              src="/logo-orojuez.jpg" 
              alt="OroJuez Logo" 
              className="h-16 w-auto object-contain"
            />
            <div className="h-10 w-[2px] bg-gray-200 hidden md:block"></div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tighter leading-none">OROJUEZ <span className="text-red-700">SA</span></h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Control de Producción</p>
            </div>
          </div>
          
          <button 
            onClick={() => router.push('/')}
            className="bg-gray-800 hover:bg-black text-white px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 shadow-lg"
          >
            <span>🚪</span> SALIR
          </button>
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
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.3em]">
          OroJuez S.A. - Infraestructura Crítica de Datos
        </p>
      </footer>
    </div>
  );
}
