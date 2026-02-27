'use client';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra Superior */}
      <nav className="bg-red-700 text-white p-4 shadow-md flex justify-between items-center">
        <h2 className="font-bold tracking-tighter text-xl">OROJUEZ SA - PANEL DE CONTROL</h2>
        <button 
          onClick={() => router.push('/')}
          className="bg-red-800 hover:bg-red-900 px-4 py-2 rounded text-xs font-bold transition-all"
        >
          CERRAR SESIÓN
        </button>
      </nav>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Formulario de Registro */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h3 className="text-gray-800 font-bold mb-4 border-b pb-2">REGISTRO DE PESO</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Placa del Vehículo</label>
                <input type="text" className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-red-200 outline-none" placeholder="PBA-1234" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Producto</label>
                <select className="w-full p-2 border rounded mt-1">
                  <option>Seleccione producto...</option>
                  <option>Maíz</option>
                  <option>Soya</option>
                  <option>Trigo</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase">Peso Entrada (Kg)</label>
                  <input type="number" className="w-full p-2 border rounded mt-1" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase">Peso Salida (Kg)</label>
                  <input type="number" className="w-full p-2 border rounded mt-1" placeholder="0.00" />
                </div>
              </div>
              <button type="button" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow transition-all">
                GUARDAR REGISTRO
              </button>
            </form>
          </div>

          {/* Resumen Rápido */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h3 className="text-gray-800 font-bold mb-4 border-b pb-2">RESUMEN DEL DÍA</h3>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-600 text-xs font-bold">TOTAL MOVILIZADO</p>
                <p className="text-2xl font-black text-blue-900">0 Kg</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600 text-xs font-bold">CAMIONES REGISTRADOS</p>
                <p className="text-2xl font-black text-gray-900">0</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
