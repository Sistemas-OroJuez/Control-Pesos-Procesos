'use client';
import { useState, useRef } from 'react';

export default function LectorIA() {
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
      const response = await fetch("https://orojuezsa-lector-ocr-industrial.hf.space/ocr", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("Respuesta servidor:", data);

      // VALIDACIÓN CRÍTICA: Evita el error "Cannot read properties of undefined"
      const listaValores = data.valores && Array.isArray(data.valores) 
        ? data.valores 
        : ["0", "0", "0", "0"];

      setDatos({
        tag: data.tag_id || "No detectado",
        totalizador: listaValores[0] || "0",
        masa: listaValores[1] || "0",
        temp: listaValores[2] || "0",
        dens: listaValores[3] || "0"
      });

    } catch (err) {
      console.error("Error en captura:", err);
      alert("Error al conectar con la IA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-black text-white min-h-screen">
      <h1 className="text-xl font-bold mb-6 text-center">LECTOR INDUSTRIAL IA</h1>
      
      {!datos ? (
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-48 border-2 border-dashed border-gray-700 rounded-3xl flex flex-col items-center justify-center"
        >
          {loading ? "Procesando..." : "📷 Tomar Foto del Panel"}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
            <p className="text-xs text-blue-400 font-bold">TAG DETECTADO</p>
            <p className="text-xl font-mono">{datos.tag}</p>
          </div>

          <div className="bg-green-900/30 p-6 rounded-3xl border border-green-500/30 text-center">
            <p className="text-xs text-green-400 font-bold mb-1">TOTALIZADOR (Σ1)</p>
            <p className="text-4xl font-black text-green-400">{datos.totalizador}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-900 p-3 rounded-xl text-center">
              <p className="text-[10px] text-gray-500">MASA</p>
              <p className="font-bold">{datos.masa}</p>
            </div>
            <div className="bg-gray-900 p-3 rounded-xl text-center">
              <p className="text-[10px] text-gray-500">TEMP</p>
              <p className="font-bold">{datos.temp}°C</p>
            </div>
            <div className="bg-gray-900 p-3 rounded-xl text-center">
              <p className="text-[10px] text-gray-500">DENS</p>
              <p className="font-bold">{datos.dens}</p>
            </div>
          </div>

          <button 
            onClick={() => setDatos(null)}
            className="w-full py-3 text-sm text-gray-500 font-bold"
          >
            Nueva Captura
          </button>
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
  );
}