'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Tesseract from 'tesseract.js';

interface DatosFlujometro {
  valorPrincipal: number;
  tagDetectado: string;
  nombreEquipo: string;
  metadatosAdicionales: {
    masa_kg_h: number;
    temperatura_c: number;
    densidad_kg_l: number;
  };
}

export default function IngresoACP() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [datosConfirmados, setDatosConfirmados] = useState<DatosFlujometro | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [esReproceso, setEsReproceso] = useState(false);

  useEffect(() => {
    const cargarEstadoGlobal = async () => {
      const { data } = await supabase.from('estado_proceso_refineria').select('en_reproceso').eq('id', 'GLOBAL_STATUS').single();
      if (data) setEsReproceso(data.en_reproceso);
    };
    cargarEstadoGlobal();
  }, []);

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

      // --- CONFIGURACIÓN DE PLANO CARTESIANO DE ALTA PRECISIÓN ---
      // Reducimos el área de búsqueda para ignorar el bisel metálico del equipo
      const cropW = img.width * 0.70;  // Enfocamos el 70% central
      const cropH = img.height * 0.40; // Enfocamos el 40% central
      const offsetX = (img.width - cropW) / 2;
      const offsetY = (img.height - cropH) / 2;

      canvas.width = cropW;
      canvas.height = cropH;

      // 1. LIMPIEZA ÓPTICA (Eliminamos reflejos de luz y ruido)
      ctx.filter = 'grayscale(100%) contrast(400%) brightness(110%)';
      ctx.drawImage(img, offsetX, offsetY, cropW, cropH, 0, 0, cropW, cropH);

      // 2. BINARIZACIÓN INVERSA POR MATRIZ (Lógica Pixel-a-Pixel)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Obtenemos el promedio de luminosidad
        const brightness = (data[i] * 0.34 + data[i + 1] * 0.5 + data[i + 2] * 0.16);
        // Si el pixel es claro (letras blancas), lo forzamos a negro puro (0)
        // Si es oscuro (fondo negro), lo forzamos a blanco puro (255)
        const tone = brightness > 160 ? 0 : 255; 
        data[i] = data[i+1] = data[i+2] = tone;
      }
      ctx.putImageData(imageData, 0, 0);

      try {
        const processedImage = canvas.toDataURL('image/jpeg', 1.0);
        
        // 3. OCR CON PARÁMETROS DE SEGMENTACIÓN DE PÁGINA
        const result = await Tesseract.recognize(processedImage, 'eng', {
          // psm: 6 asume un bloque de texto uniforme, ideal para este panel
          // @ts-ignore
          tessedit_pageseg_mode: '6' 
        });

        const textOCR = result.data.text.toUpperCase();
        const cleanOCR = textOCR.replace(/[^A-Z0-9_]/g, '');

        // 4. VALIDACIÓN DE EQUIPO
        const { data: equipos } = await supabase.from('cat_equipos').select('*');
        const equipoVinculado = equipos?.find(eq => 
          cleanOCR.includes(eq.tag_id.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
        );

        if (!equipoVinculado) {
          alert("⚠️ ERROR DE LECTURA: El ID no se detectó claramente. Evite el flash directo sobre el cristal.");
          setLoading(false);
          return;
        }

        // 5. EXTRACCIÓN NUMÉRICA REFORMULADA
        const numbers = result.data.lines
          .map(line => line.text.replace(/[^0-9.]/g, ''))
          .filter(n => n.length > 2);

        setDatosConfirmados({
          valorPrincipal: parseInt(numbers.find(n => n.length >= 7) || "0"),
          tagDetectado: equipoVinculado.tag_id,
          nombreEquipo: equipoVinculado.nombre,
          metadatosAdicionales: {
            masa_kg_h: parseFloat(numbers.find(n => n.includes('.') && n.length > 5) || "0"),
            temperatura_c: parseFloat(numbers.find(n => n.length < 6 && n.includes('.')) || "0"),
            densidad_kg_l: parseFloat(numbers.reverse().find(n => n.includes('.') && n.length < 7) || "0")
          }
        });

        setFotoUrl(processedImage);
      } catch (error) {
        alert("Fallo en el motor de análisis");
      } finally {
        setLoading(false);
      }
    };
  };

  const handleGuardar = async () => {
    if (!fotoUrl || !datosConfirmados) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('operaciones_refineria').insert([{
        tipo_operacion: 'INGRESO_ACP',
        valor_lectura: datosConfirmados.valorPrincipal,
        foto_url: fotoUrl,
        masa_kg_h: datosConfirmados.metadatosAdicionales.masa_kg_h,
        temperatura_c: datosConfirmados.metadatosAdicionales.temperatura_c,
        densidad_kg_l: datosConfirmados.metadatosAdicionales.densidad_kg_l,
        es_reproceso: esReproceso,
        observaciones: `LECTURA PRECISIÓN: ${datosConfirmados.tagDetectado}`
      }]);
      if (error) throw error;
      alert("Registro exitoso");
      setFotoUrl(null);
      setDatosConfirmados(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] p-4 flex flex-col items-center">
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="w-full max-w-md bg-[#121212] rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl">
        <header className={`p-8 text-center ${esReproceso ? 'bg-red-800/40' : 'bg-blue-800/40'} border-b border-white/5`}>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">Ingreso ACP</h1>
          <p className="text-[10px] font-bold text-white/30 tracking-[0.2em] mt-1">SISTEMA DE LECTURA ÓPTICA</p>
        </header>

        <div className="p-6 space-y-6">
          <div className="relative text-center">
            {fotoUrl ? (
              <div className="animate-in fade-in duration-300">
                <img src={fotoUrl} className="w-full rounded-[2.5rem] border-2 border-blue-500/30" alt="Segmentado" />
                <button onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }} className="absolute -top-3 -right-3 bg-red-600 text-white w-10 h-10 rounded-full font-bold border-4 border-[#121212] shadow-xl">✕</button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={loading}
                className="w-full h-56 border-2 border-dashed border-white/10 rounded-[2.5rem] bg-white/5 flex flex-col items-center justify-center group active:scale-95 transition-all"
              >
                <div className="bg-blue-500/10 p-5 rounded-full mb-3 group-hover:bg-blue-500/20 transition-colors">
                  <span className="text-4xl">{loading ? '⌛' : '📸'}</span>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Capturar Lector Masico</p>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          {datosConfirmados && (
            <div className="bg-black p-6 rounded-[2.5rem] border border-white/5 space-y-6 font-mono shadow-inner">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-blue-400 font-bold text-[11px] tracking-widest">{datosConfirmados.tagDetectado}</span>
                <span className="text-white/20 text-[9px] uppercase font-bold">{datosConfirmados.nombreEquipo}</span>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-gray-600 font-black uppercase mb-2">Lectura Σ1</p>
                <p className="text-6xl font-black text-green-400 tracking-tighter">
                  {datosConfirmados.valorPrincipal.toLocaleString()}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-blue-500 font-bold mb-1 uppercase text-[7px]">Masa</p>
                  <p className="text-white font-bold">{datosConfirmados.metadatosAdicionales.masa_kg_h}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-orange-500 font-bold mb-1 uppercase text-[7px]">Temp</p>
                  <p className="text-white font-bold">{datosConfirmados.metadatosAdicionales.temperatura_c}°</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-purple-500 font-bold mb-1 uppercase text-[7px]">Dens</p>
                  <p className="text-white font-bold">{datosConfirmados.metadatosAdicionales.densidad_kg_l}</p>
                </div>
              </div>
            </div>
          )}

          <button 
            onClick={handleGuardar} 
            disabled={loading || !datosConfirmados}
            className={`w-full py-5 rounded-2xl font-black text-white text-[11px] tracking-[0.2em] transition-all shadow-xl ${esReproceso ? 'bg-red-600' : 'bg-blue-600 shadow-blue-500/20'}`}
          >
            {loading ? 'ANALIZANDO PÍXELES...' : 'CONFIRMAR CARGA'}
          </button>
        </div>
      </div>
    </div>
  );
}