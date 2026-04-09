'use client';
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function LectorIndustrial() {
  const [loading, setLoading] = useState(false);
  const [datos, setDatos] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log("--- INICIANDO CAPTURA ---");
      // Asegúrate de que esta URL sea la de tu Space actual
      const res = await fetch("https://tu-usuario-lector-ocr.hf.space/ocr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      
      // ==========================================
      // DEBUG LOG: Aquí verás qué responde la IA
      console.log("RESPUESTA CRUDA DEL SERVIDOR:", data);
      // ==========================================

      if (data.error) {
        console.error("Error reportado por el servidor IA:", data.error);
        alert("La IA respondió con un error técnico.");
      }

      // Mapeamos los datos recibidos al estado
      setDatos({
        tag: data.tag_id || "No detectado",
        totalizador: data.valores?.[0] || "0",
        masa: data.valores?.[1] || "0",
        temp: data.valores?.[2] || "0",
        dens: data.valores?.[3] || "0",
        original: data // Guardamos todo por si acaso
      });

    } catch (err) {
      console.error("ERROR DE CONEXIÓN:", err);
      alert("No se pudo conectar con el servidor de IA.");
    } finally {
      setLoading(false);
    }
  };

  const guardarEnDB = async () => {
    if (!datos) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('operaciones_refineria').insert([{
        valor_lectura: parseFloat(datos.totalizador),
        masa_kg_h: parseFloat(datos.masa),
        temperatura_c: parseFloat(datos.temp),
        densidad_kg_l: parseFloat(datos.dens),
        observaciones: `Registro IA - Tag: ${datos.tag}`
      }]);
      
      if (error) throw error;
      alert("✅ Datos guardados correctamente");
      setDatos(null);
    } catch (e: any) {
      console.error("Error al guardar en Supabase:", e);
      alert("Error de base de datos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="text-center py-4">
          <h1 className="text-blue-500 font-bold tracking-widest text-sm uppercase">Sistema de Lectura Coriolis</h1>
        </header>

        {!datos ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-3xl p-12 bg-zinc-900/50">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className={`w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20 active:scale-95 transition-all ${loading ? 'animate-pulse opacity-50' : ''}`}
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <p className="mt-4 text-gray-500 text-xs font-medium uppercase tracking-tighter">
              {loading ? "Analizando pantalla..." : "Tocar para escanear panel"}
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-[10px] text-gray-500 uppercase">Equipo Detectado</span>
              <span className="text-blue-400 font-bold text-sm">{datos.tag}</span>
            </div>

            <div className="text-center py-4">
              <p className="text-[10px] text-gray-500 uppercase">Totalizador</p>
              <p className="text-5xl font-black text-green-500 tracking-tighter">
                {datos.totalizador !== "0" ? datos.totalizador : "---"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/5 p-3 rounded-2xl text-center">
                <p className="text-[8px] text-gray-500 uppercase">Masa</p>
                <p className="font-bold text-sm">{datos.masa}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl text-center">
                <p className="text-[8px] text-gray-500 uppercase">Temp</p>
                <p className="font-bold text-sm">{datos.temp}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl text-center">
                <p className="text-[8px] text-gray-500 uppercase">Dens</p>
                <p className="font-bold text-sm">{datos.dens}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <button 
                onClick={guardarEnDB}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-sm transition-colors"
              >
                CONFIRMAR REGISTRO
              </button>
              <button 
                onClick={() => setDatos(null)}
                className="w-full py-2 text-xs text-gray-500 font-medium"
              >
                CANCELAR Y REPETIR
              </button>
            </div>
          </div>
        )}

        {/* Input oculto para activar la cámara */}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          onChange={handleCapture} 
          className="hidden" 
        />
      </div>
    </div>
  );
}