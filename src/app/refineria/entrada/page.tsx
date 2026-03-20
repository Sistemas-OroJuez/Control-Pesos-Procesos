'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase'; // Usando tu archivo de la carpeta lib

export default function IngresoACP() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [lectura, setLectura] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');

  // 1. Función para capturar la foto (Activa cámara en móviles)
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileName = `acp_${Date.now()}.jpg`;
      
      // Subida al nuevo bucket exclusivo
      const { data, error } = await supabase.storage
        .from('refineria_assets')
        .upload(fileName, file);

      if (error) throw error;

      // Obtener URL pública para el link de la base de datos
      const { data: urlData } = supabase.storage
        .from('refineria_assets')
        .getPublicUrl(fileName);

      setFotoUrl(urlData.publicUrl);
      
      // Simulación de OCR (Aquí podrías integrar un servicio de lectura real)
      // Por ahora, dejamos que el usuario confirme o digite el valor de la foto
      alert("Foto cargada con éxito. Por favor verifique el valor del flujómetro.");
      
    } catch (error: any) {
      alert("Error al subir foto: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Guardar el registro final
  const handleGuardar = async () => {
    if (!fotoUrl || !lectura) {
      alert("La foto y la lectura son obligatorias.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('operaciones_refineria')
        .insert([{
          tipo_operacion: 'INGRESO_ACP',
          valor_lectura: parseFloat(lectura),
          foto_url: fotoUrl,
          observaciones: observaciones,
          usuario_registro: 'Operador Refinería' // Esto puede venir de un estado global después
        }]);

      if (error) throw error;

      alert("Ingreso registrado correctamente.");
      router.push('/dashboard'); // Ajusta según tu ruta de inicio
    } catch (error: any) {
      alert("Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-blue-600 p-8 text-white text-center">
          <span className="text-6xl mb-2 block">🔵</span>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Ingreso ACP</h1>
          <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Registro de Flujómetro</p>
        </div>

        <div className="p-6 space-y-6">
          {/* SECCIÓN DE FOTO */}
          <div className="text-center">
            {fotoUrl ? (
              <div className="relative inline-block">
                <img src={fotoUrl} alt="Preview" className="w-full h-48 object-cover rounded-2xl border-4 border-blue-50" />
                <button 
                  onClick={() => setFotoUrl(null)}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-2 text-xs font-bold shadow-lg"
                >
                  CAMBIAR
                </button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full h-48 border-4 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all"
              >
                <span className="text-5xl mb-2">📸</span>
                <span className="font-bold uppercase text-xs tracking-widest">{loading ? 'Subiendo...' : 'Tomar Foto del Flujómetro'}</span>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          {/* VALOR DEL FLUJÓMETRO */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Lectura del Contador (kg)</label>
            <input 
              type="number" 
              value={lectura}
              onChange={(e) => setLectura(e.target.value)}
              className="w-full text-4xl font-mono text-blue-700 border-b-2 border-gray-100 focus:border-blue-600 outline-none pb-2 transition-colors"
              placeholder="0.00"
            />
          </div>

          {/* OBSERVACIONES */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Observaciones</label>
            <textarea 
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-100 h-24 border border-gray-100"
              placeholder="Notas adicionales sobre el ingreso..."
            />
          </div>

          {/* BOTÓN GUARDAR */}
          <button 
            onClick={handleGuardar}
            disabled={loading || !fotoUrl}
            className={`w-full py-5 rounded-2xl font-black text-white shadow-2xl transition-all ${loading || !fotoUrl ? 'bg-gray-300' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
          >
            {loading ? 'PROCESANDO...' : 'CONFIRMAR REGISTRO'}
          </button>
          
          <button onClick={() => router.back()} className="w-full text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
            Cancelar y Volver
          </button>
        </div>
      </div>
    </div>
  );
}