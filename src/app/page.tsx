export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
      {/* Contenedor Principal */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-red-700">
        <div className="p-8">
          {/* Logo o Título Ejecutivo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">OROJUEZ <span className="text-red-700">SA</span></h1>
            <div className="h-1 w-20 bg-red-700 mx-auto mt-2"></div>
            <p className="text-gray-500 mt-4 text-sm font-semibold uppercase tracking-widest">Control de Pesos y Procesos</p>
          </div>

          <form className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Correo Corporativo</label>
              <input 
                type="email" 
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all text-gray-700"
                placeholder="usuario@orojuez.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Contraseña de Acceso</label>
              <input 
                type="password" 
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all text-gray-700"
                placeholder="••••••••"
              />
            </div>

            <button className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform active:scale-95 transition-all uppercase tracking-wider text-sm">
              Ingresar al Sistema
            </button>
          </form>

          <div className="mt-8 text-center">
            <a href="#" className="text-xs text-gray-400 hover:text-red-600 transition-colors">¿Olvidó sus credenciales de acceso?</a>
          </div>
        </div>
        
        <div className="bg-gray-50 py-4 text-center border-t border-gray-100">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            Desarrollado por el Área de Sistemas - 2026
          </p>
        </div>
      </div>
    </div>
  );
}