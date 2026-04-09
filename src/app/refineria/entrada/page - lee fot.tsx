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
      console.log("Enviando imagen a la IA...");
      
      // USANDO TU URL DIRECTA CONFIRMADA
      const res = await fetch("https://orojuezsa-lector-ocr-industrial.hf.space/ocr", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Error en la respuesta del servidor");

      const data = await res.json();
      console.log("RESPUESTA IA:", data); // Verifica esto en F12

      setDatos({
        tag: data.tag_id || "No detectado",
        totalizador: data.valores?.[0] || "0",
        masa: data.valores?.[1] || "0",
        temp: data.valores?.[2] || "0",
        dens: data.valores?.[3] || "0"
      });

    } catch (err) {
      console.error("ERROR:", err);
      alert("Error de conexión con la IA. Verifica que el Space esté en 'Running'.");
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
      alert("✅ Datos guardados en Supabase");
      setDatos(null);
    } catch (e: any) {
      alert("Error al guardar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="text-center py-4 border-b border-white/10">
          <h1 className="text-blue-500 font-bold tracking-widest text-xs uppercase">Refinería OroJuez - Lector v2</h1>
        </header>

        {!datos ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[40px] p-16 bg-zinc-900/30">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className={`w-28 h-28 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-900/40 active:scale-95 transition-transform ${loading ? 'animate-pulse' : ''}`}
            >
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <p className="mt-6 text-zinc-500 text-[10px] tracking-[0.2em] uppercase font-bold">
              {loading ? "Analizando..." : "Escanear Medidor"}
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-[32px] p-6 border border-white/5 space-y-6">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Tag</span>
              <span className="text-blue-400 font-mono text-xs font-bold">{datos.tag}</span>
            </div>

            <div className="text-center space-y-1">
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Totalizador Principal</p>
              <p className="text-6xl font-black text-green-500 tracking-tighter">{datos.totalizador}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Masa', val: datos.masa },
                { label: 'Temp', val: datos.temp },
                { label: 'Dens', val: datos.dens }
              ].map((item, i) => (
                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-[9px] text-zinc-500 uppercase mb-1">{item.label}</p>
                  <p className="text-sm font-bold text-white">{item.val}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 space-y-3">
              <button 
                onClick={guardarEnDB}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-sm tracking-widest transition-all shadow-lg shadow-blue-900/20"
              >
                CONFIRMAR Y GUARDAR
              </button>
              <button 
                onClick={() => setDatos(null)}
                className="w-full py-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest"
              >
                Volver a intentar
              </button>
            </div>
          </div>
        )}

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