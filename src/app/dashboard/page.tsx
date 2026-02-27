'use client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Dashboard() {
  const router = useRouter();

  const menuButtons = [
    { id: 1, name: 'Administración y Usuarios', icon: '👥', color: 'bg-white', text: 'text-gray-700', route: '/admin' },
    { id: 2, name: 'Parámetros del Sistema', icon: '⚙️', color: 'bg-white', text: 'text-gray-700', route: '/parametros' },
    { id: 3, name: 'Proceso de Pesado', icon: '⚖️', color: 'bg-red-700', text: 'text-white', route: '/proceso' },
    { id: 4, name: 'Reportes Generales', icon: '📋', color: 'bg-white', text: 'text-gray-700', route: '/reportes' },
    { id: 5, name: 'Reportes Gerenciales', icon: '📊', color: 'bg-white', text: 'text-gray-700', route: '/gerencia' },
    { id: 7, name: 'Estadísticas (Tiempos)', icon: '⏱️', color: 'bg-white', text: 'text-gray-700', route: '/estadisticas' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header con Logo */}
      <header className="bg-white shadow-sm border-b-4 border-red-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Si aún no copias el jpg, se verá el texto */}
            <div className="w-16 h-16 relative bg-gray-200 rounded flex items-center justify-center overflow-hidden">
               <img src="/logo-orojuez.jpg" alt="Logo" onerror="this.style.display='none'" className="object-contain" />
               <span className="text-[10px] font-bold text-gray-400 absolute">LOGO</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-800 tracking-tighter">OROJUEZ <span className="text-red-700">SA</span></h1>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sistema de Control de Procesos</p>
            </div>
          </div>
          
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 bg-gray-800 hover:bg-black text-white px-6 py-2 rounded-full font-bold text-sm transition-all shadow-lg"
          >
            <span>🚪</span> SALIR DEL SISTEMA
          </button>
        </div>
      </header>

      {/* Cuerpo del Dashboard */}
      <main className="max-w-6xl mx-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {menuButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => btn.route !== '#' && router.push(btn.route)}
              className={\ \ p-8 rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center border border-gray-100 group}
            >
              <span className="text-4xl mb-4 group-hover:scale-110 transition-transform text-red-700">{btn.icon}</span>
              <span className="font-bold uppercase tracking-tight text-center leading-tight">
                {btn.name}
              </span>
            </button>
          ))}

        </div>

        {/* Footer Informativo */}
        <footer className="mt-12 text-center">
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em]">
            Panel de Control Centralizado v1.0 - 2026
          </p>
        </footer>
      </main>
    </div>
  );
}
