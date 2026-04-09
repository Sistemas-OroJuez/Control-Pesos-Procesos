'use client';
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Tesseract from 'tesseract.js';

export default function IngresoACP() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [datosConfirmados, setDatosConfirmados] = useState<any>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // --- PASO 1: UBICAR EL PANEL EN LA FOTO TOTAL ---
      // pW y pH definen el tamaño del cuadro negro central
      const pW = img.width * 0.85;  
      const pH = img.height * 0.50; 
      // pX y pY son las coordenadas de la esquina superior izquierda del cuadro negro
      const pX = (img.width - pW) / 2;
      const pY = (img.height - pH) / 2;

      // --- PASO 2: RECORTE QUIRÚRGICO DE LA FILA 1 (ID) ---
      // Trazamos desde pX y pY, pero solo un pedacito
      const idW = pW * 0.40; // 40% del ancho del cuadro
      const idH = pH * 0.18; // 18% de la altura (SOLO LA PRIMERA FILA)
      
      canvas.width = idW; 
      canvas.height = idH;
      ctx.filter = 'grayscale(100%) contrast(450%) invert(100%)';
      
      // drawImage(imagen, origenX, origenY, anchoOrigen, altoOrigen, destinoX, destinoY, anchoDest, altoDest)
      ctx.drawImage(img, pX, pY, idW, idH, 0, 0, idW, idH);
      const roiID = canvas.toDataURL('image/jpeg');

      // --- PASO 3: RECORTE DE LAS 4 FILAS DE DATOS (DERECHA) ---
      // El origen X se desplaza a la derecha (pX + ancho del ID)
      // El origen Y se desplaza hacia abajo (pY + altura del ID)
      const dW = pW * 0.60; 
      const dH = pH * 0.82; // El resto de la altura (82%)
      const dX = pX + (pW * 0.40); 
      const dY = pY + (pH * 0.18); 

      canvas.width = dW; 
      canvas.height = dH;
      ctx.filter = 'grayscale(100%) contrast(300%) invert(100%)';
      ctx.drawImage(img, dX, dY, dW, dH, 0, 0, dW, dH);
      const roiDatos = canvas.toDataURL('image/jpeg');

      try {
        // Ejecutamos OCR en los dos recortes pequeños
        const [resID, resDatos] = await Promise.all([
          Tesseract.recognize(roiID, 'eng'),
          Tesseract.recognize(roiDatos, 'eng')
        ]);

        // Verificamos que resDatos y sus líneas existan antes de usar .map()
        const lineasDeDatos = resDatos.data?.lines || [];
        
        if (lineasDeDatos.length === 0) {
          alert("No se ven números. Asegúrese de que el panel negro ocupe el centro de la foto.");
          setLoading(false);
          return;
        }

        const tagOCR = resID.data.text.replace(/[^A-Z0-9_-]/g, '').trim();
        
        // Aquí extraemos los números fila por fila de la zona derecha
        const nums = lineasDeDatos
          .map(l => l.text.replace(/[^0-9.]/g, ''))
          .filter(n => n.length > 1);

        setDatosConfirmados({
          tag: tagOCR || "ID NO LEÍDO",
          totalizador: parseInt(nums[0] || "0"), // Fila 2 de la pantalla
          masa: parseFloat(nums[1] || "0"),      // Fila 3
          temp: parseFloat(nums[2] || "0"),      // Fila 4
          dens: parseFloat(nums[3] || "0")       // Fila 5
        });

      } catch (err) {
        console.error("Error procesando:", err);
      } finally {
        setLoading(false);
      }
    };
  };

  return (
    <div className="min-h-screen bg-black p-4 text-white">
      <canvas ref={canvasRef} className="hidden" />
      <div className="max-w-md mx-auto bg-[#111] rounded-[2rem] border border-white/5 overflow-hidden">
        <header className="p-6 text-center bg-blue-600 font-black italic uppercase">
          Lector ROI 5 Filas
        </header>

        <div className="p-6 space-y-6">
          {!datosConfirmados ? (
            <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="w-full h-48 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center bg-white/5">
              <span className="text-4xl mb-2">{loading ? '⌛' : '📸'}</span>
              <p className="text-[10px] font-bold uppercase tracking-widest">Capturar Panel Central</p>
            </button>
          ) : (
            <div className="bg-[#1a1a1a] p-6 rounded-[2rem] border border-blue-500/20">
              <div className="flex justify-between border-b border-white/5 pb-2 mb-4">
                <span className="text-blue-400 font-bold text-xs">{datosConfirmados.tag}</span>
              </div>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-[8px] opacity-40 uppercase">Totalizador</p>
                  <p className="text-5xl font-black text-green-400">{datosConfirmados.totalizador.toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 p-2 rounded-xl text-center">
                    <p className="text-[7px] text-blue-400">MASA</p>
                    <p className="font-bold text-xs">{datosConfirmados.masa}</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl text-center">
                    <p className="text-[7px] text-orange-400">TEMP</p>
                    <p className="font-bold text-xs">{datosConfirmados.temp}°</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl text-center">
                    <p className="text-[7px] text-purple-400">DENS</p>
                    <p className="font-bold text-xs">{datosConfirmados.dens}</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setDatosConfirmados(null)} className="w-full mt-6 text-[10px] font-bold opacity-30">REINTENTAR</button>
            </div>
          )}
          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
        </div>
      </div>
    </div>
  );
}