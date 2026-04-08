'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SalidaAcidoGraso() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [valorManual, setValorManual] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');
  
  // Sincronización de estado de reproceso global
  const [esReproceso, setEsReproceso] = useState(false);

  useEffect(() => {
    const cargarEstadoGlobal = async () => {
      try {
        const { data } = await supabase
          .from('estado_proceso_refineria')
          .select('en_reproceso')
          .eq('id', 'GLOBAL_STATUS')
          .single();
        if (data) setEsReproceso(data.en_reproceso);
      } catch (e) {
        console.error("Error al cargar estado global");
      }
    };
    cargarEstadoGlobal();
  }, []);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileName = `${Date.now()}_acido_graso.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('refineria_assets')
        .upload(fileName, file);

      if (uploadError) throw new Error("Error al subir evidencia.");

      const { data: urlData } = supabase.storage
        .from('refineria_assets')
        .getPublicUrl(fileName);

      setFotoUrl(urlData.publicUrl);
    } catch (error: any) {
      alert("Error al subir foto: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardar = async () => {
    // Validamos que al menos el valor manual exista, la foto es opcional
    if (!valorManual || isNaN(Number(valorManual))) {
      alert("Por favor, ingrese el valor de la lectura manual.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('operaciones_refineria')
        .insert([{
          tipo_operacion: 'SALIDA_FATTY_ACID',
          valor_lectura: parseFloat(valorManual), 
          foto_url: fotoUrl || null, // Guardamos la URL o null si no se tomó foto
          observaciones: observaciones,
          es_reproceso: esReproceso,
          usuario_registro: 'Operador Ácido Graso',
          masa_kg_h: 0,
          temperatura_c: 0,
          densidad_kg_l: 0
        }]);

      if (error) throw error;
      
      alert("✅ Registro de Ácido Graso guardado exitosamente.");
      
      // Limpiamos el formulario
      setFotoUrl(null);
      setValorManual('');
      setObservaciones('');
    } catch (error: any) {
      alert("Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-md mx-auto bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-800">
        
        {/* HEADER PÚRPURA */}
        <div className={`p-6 text-white text-center border-b-4 transition-all ${esReproceso ? 'bg-orange-600 border-orange-900' : 'bg-purple-800 border-purple-950'}`}>
          <h2 className="text-[10px] font-bold uppercase tracking-widest opacity-70">Subproducto</h2>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">ÁCIDO GRASO</h1>
          <p className="text-[10px] font-bold mt-1 text-purple-200">LECTURA MANUAL / FOTO OPCIONAL</p>
        </div>

        <div className="p-5 space-y-6">
          
          {/* CAMPO DE LECTURA MANUAL (OBLIGATORIO) */}
          <div className="bg-gray-900 p-6 rounded-2xl border-2 border-purple-900/30">
            <label className="text-purple-400 text-[10px] font-black uppercase mb-2 block text-center tracking-widest">
              Valor de Lectura (kg)
            </label>
            <input 
              type="number" 
              inputMode="decimal"
              value={valorManual}
              onChange={(e) => setValorManual(e.target.value)}
              placeholder="0.00"
              className="bg-transparent text-5xl font-black text-white w-full text-center outline-none placeholder:text-gray-800"
            />
          </div>

          {/* BOTÓN DE FOTO (AHORA ES OPCIONAL) */}
          <div className="text-center">
            {fotoUrl ? (
              <div className="relative">
                <img src={fotoUrl} className="w-full h-40 object-cover rounded-xl border-2 border-purple-500" alt="Evidencia" />
                <button 
                  onClick={() => setFotoUrl(null)} 
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-8 h-8 font-bold border-2 border-[#1a1a1a]"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={loading}
                className="w-full py-6 border-2 border-dashed border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:text-purple-400 hover:border-purple-800 transition-all group"
              >
                <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">📸</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-purple-300">Evidencia Fotográfica</span>
                <span className="text-[9px] opacity-40 mt-1 italic">(Opcional hasta llegada de equipo)</span>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          <textarea 
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-gray-900 rounded-xl p-3 text-white text-[10px] border-none focus:ring-1 focus:ring-purple-600 h-20"
            placeholder="Comentarios adicionales (Nivel de tanque, operador, etc.)..."
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !valorManual}
            className={`w-full py-4 rounded-xl font-black text-white text-xs tracking-[0.2em] shadow-lg transition-all ${
              loading || !valorManual 
                ? 'bg-gray-700 cursor-not-allowed' 
                : 'bg-purple-700 hover:bg-purple-600 shadow-purple-900/30 active:scale-95'
            }`}
          >
            {loading ? 'PROCESANDO...' : 'REGISTRAR ÁCIDO GRASO'}
          </button>
        </div>
      </div>
    </div>
  );
}