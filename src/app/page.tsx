export default function LoginPage() {
  return (
    <div className="min-h-screen bg-red-700 flex flex-col items-center justify-center p-4">
      {/* Tarjeta Blanca Central */}
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
        
        {/* Encabezado */}
        <h1 className="text-4xl font-extrabold text-red-700 mb-2">OroJuez SA</h1>
        <p className="text-gray-500 mb-8 font-medium uppercase tracking-wider">
          Control de Pesos y Procesos
        </p>
        
        {/* Formulario */}
        <form className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Usuario / Email
            </label>
            <input 
              type="email" 
              placeholder="ejemplo@orojuez.com" 
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Contraseña
            </label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 transition-all"
            />
          </div>

          <button 
            type="button"
            className="w-full bg-red-700 text-white font-bold py-3 rounded-lg hover:bg-red-800 transition-colors shadow-lg mt-4"
          >
            ENTRAR AL SISTEMA
          </button>
        </form>
        
        {/* Pie de página de la tarjeta */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 font-semibold italic">
            SISTEMA DE CONTROL INTERNO V1.0<br/>
            © 2026 ÁREA DE SISTEMAS OROJUEZ SA
          </p>
        </div>
      </div>
    </div>
  );
}