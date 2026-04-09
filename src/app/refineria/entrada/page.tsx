'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Tesseract from 'tesseract.js';

export default function IngresoACP() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
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

      // --- GEOMETRÍA CARTESIANA ---
      const pW = img.width * 0.85;  
      const pH = img.height * 0.50; 
      const pX = (img.width - pW) / 2;
      const pY = (img.height - pH) / 2;

      // 1. ESCANEO DEL ID (Fila 1: Superior Izquierda - Altura 18%)
      // Aumentamos el tamaño del canvas (Super-sampling) para que el OCR lea mejor letras pequeñas
      const idW = pW * 0.42; 
      const idH = pH * 0.18; 
      canvas.width = idW * 2; // Duplicamos densidad de píxeles
      canvas.height = idH * 2;
      ctx.scale(2, 2);
      ctx.filter = 'grayscale(100%) contrast(500%) brightness(110%)';
      ctx.drawImage(img, pX, pY, idW, idH, 0, 0, idW, idH);
      
      // Inversión manual de píxeles para el ID
      const idData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < idData.data.length; i += 4) {
        const avg = (idData.data[i] + idData.data[i+1] + idData.data[i+2]) / 3;
        const color = avg > 130 ? 0 : 255; // Blanco a Negro
        idData.data[i] = idData.data[i+1] = idData.data[i+2] = color;
      }
      ctx.putImageData(idData, 0, 0);
      const roiID = canvas.toDataURL('image/jpeg', 1.0);

      // 2. ESCANEO DE DATOS (Filas 2-5: Derecha - Altura 82%)
      const dW = pW * 0.58; 
      const dH = pH * 0.82; 
      const dX = pX + (pW * 0.42);
      const dY = pY + (pH * 0.18);
      canvas.width = dW;
      canvas.height = dH;
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset scale
      ctx.filter = 'grayscale(100%) contrast(300%) invert(100%)';
      ctx.drawImage(img, dX, dY, dW, dH, 0, 0, dW, dH);
      const roiDatos = canvas.toDataURL('image/jpeg', 1.0);

      try {
        const [resID, resDatos] = await Promise.all([
          Tesseract.recognize(roiID, 'eng', { tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' }),
          Tesseract.recognize(roiDatos, 'eng', { tessedit_char_whitelist: '0123456789.' })
        ]);

        const tagOCR = resID.data.text.trim();
        const { data: equipos } = await supabase.from('cat_equipos').select('*');
        
        // Búsqueda flexible (Fuzzy Match)
        const equipo = equipos?.find(eq => 
          tagOCR.includes(eq.tag_id.replace(/[^A-Z0-9]/g, '')) || 
          eq.tag_id.includes(tagOCR.replace(/[^A-Z0-9]/g, ''))
        );

        if (!equipo && tagOCR.length < 3) {
          throw new Error("No se detectaron caracteres en la zona del ID.");
        }

        const lineas = resDatos.data.lines
          .map(l => l.text.replace(/[^0-9.]/g, ''))
          .filter(n => n.length > 1);

        setDatosConfirmados({
          tag: equipo ? equipo.tag_id : `DUDOSO: ${tagOCR}`,
          nombre: equipo ? equipo.nombre : "Desconocido",
          totalizador: parseInt(lineas[0] || "0"),
          masa: parseFloat(lineas[1] || "0"),
          temp: parseFloat(lineas[2] || "0"),
          dens: parseFloat(lineas[3] || "0")
        });

        setFotoUrl(roiID); // Mostramos el recorte del ID para ver qué está viendo el OCR
      } catch (err: any) {
        alert("❌ ERROR: " + err.message + " Intente alejar un poco la cámara.");
      } finally {
        setLoading(false);
      }
    };
  };

  return (
    <div className="min-h-screen bg-[#050505] p-4 text-white">
      <canvas ref={canvasRef} className="hidden" />
      <div className="max-w-md mx-auto bg-[#111] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
        <header className="p-8 text-center bg-gradient-to-b from-blue-900/20 to-transparent border-b border-white/5">
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">Lector Industrial</h1>
          <p className="text-[9px] font-bold opacity-30 tracking-[0.3em] uppercase">Segmentación de 5 Filas</p>
        </header>

        <div className="p-6 space-y-6">
          {!datosConfirmados ? (
            <button onClick={() => fileInputRef.current?.click()} className="w-full h-56 border-2 border-dashed border-white/10 rounded-[2.5rem] bg-white/5 flex flex-col items-center justify-center transition-all active:scale-95">
              <span className="text-5xl mb-3">{loading ? '⌛' : '📸'}</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {loading ? 'Calculando Coordenadas...' : 'Capturar Panel'}
              </p>
            </button>
          ) : (
            <div className="bg-[#1a1a1a] p-6 rounded-[2rem] border border-blue-500/20 animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
                <div className="flex flex-col">
                  <span className="text-[8px] text-blue-400 font-black uppercase">Equipo Detectado</span>
                  <span className="text-sm font-bold font-mono">{datosConfirmados.tag}</span>
                </div>
                <span className="text-[9px] text-white/20 uppercase font-black">{datosConfirmados.nombre}</span>
              </div>

              <div className="text-center py-4">
                <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.2em] mb-1">Totalizador Σ</p>
                <p className="text-6xl font-black text-green-400 tracking-tighter">{datosConfirmados.totalizador.toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                  <p className="text-[7px] text-blue-400 font-bold uppercase mb-1">Masa</p>
                  <p className="font-bold text-xs">{datosConfirmados.masa}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                  <p className="text-[7px] text-orange-400 font-bold uppercase mb-1">Temp</p>
                  <p className="font-bold text-xs">{datosConfirmados.temp}°</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                  <p className="text-[7px] text-purple-400 font-bold uppercase mb-1">Dens</p>
                  <p className="font-bold text-xs">{datosConfirmados.dens}</p>
                </div>
              </div>

              <button onClick={() => setDatosConfirmados(null)} className="w-full mt-6 py-2 text-[8px] font-black text-gray-600 uppercase tracking-widest">Descartar y repetir</button>
            </div>
          )}

          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          
          <button className={`w-full py-5 rounded-2xl font-black text-[11px] tracking-[0.2em] transition-all shadow-xl ${datosConfirmados ? 'bg-blue-600' : 'bg-gray-800 opacity-50'}`}>
            GUARDAR REGISTRO
          </button>
        </div>
      </div>
    </div>
  );
}