'use client';
import { useState, useRef, useEffect } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [datosConfirmados, setDatosConfirmados] = useState<DatosFlujometro | null>(null);
  const [esReproceso, setEsReproceso] = useState(false);

  useEffect(() => {
    const cargarEstadoGlobal = async () => {
      const { data } = await supabase.from('estado_proceso_refineria').select('en_reproceso').eq('id', 'GLOBAL_STATUS').single();
      if (data) setEsReproceso(data.en_reproceso);
    };
    cargarEstadoGlobal();
  }, []);

  const preProcesarImagen = (ctx: CanvasRenderingContext2D, width: number, height: number, esID: boolean) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Umbral (Threshold) dinámico según si es ID (más pequeño) o números
    const umbral = esID ? 140 : 160;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const grayscale = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      
      // Binarización inversa: El texto del panel es claro, lo pasamos a negro puro (0)
      // El fondo es oscuro, lo pasamos a blanco puro (255)
      const v = grayscale > umbral ? 0 : 255;
      data[i] = data[i+1] = data[i+2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
  };

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

      // --- GEOMETRÍA DEL PANEL (PLANO CARTESIANO AJUSTADO) ---
      const pW = img.width * 0.90;   // Panel completo
      const pH = img.height * 0.55; 
      const pX = (img.width - pW) / 2;
      const pY = (img.height - pH) / 2;

      // 1. RECORTE QUIRÚRGICO DEL ID (Zona Superior Izquierda: 15% Alto, 35% Ancho)
      const idW = pW * 0.35;
      const idH = pH * 0.15; 
      canvas.width = idW;
      canvas.height = idH;
      ctx.filter = 'contrast(500%) grayscale(100%) brightness(120%)';
      ctx.drawImage(img, pX, pY, idW, idH, 0, 0, idW, idH);
      preProcesarImagen(ctx, idW, idH, true);
      const roiID = canvas.toDataURL('image/jpeg', 1.0);

      // 2. RECORTE DE DATOS (Zona Derecha: 85% Restante)
      const dW = pW * 0.65;
      const dH = pH * 0.85;
      const dX = pX + (pW * 0.35);
      const dY = pY + (pH * 0.15);
      canvas.width = dW;
      canvas.height = dH;
      ctx.filter = 'contrast(300%) grayscale(100%)';
      ctx.drawImage(img, dX, dY, dW, dH, 0, 0, dW, dH);
      preProcesarImagen(ctx, dW, dH, false);
      const roiDatos = canvas.toDataURL('image/jpeg', 1.0);

      try {
        const [resID, resDatos] = await Promise.all([
          Tesseract.recognize(roiID, 'eng', { tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' }),
          Tesseract.recognize(roiDatos, 'eng', { tessedit_char_whitelist: '0123456789.' })
        ]);

        const tagLeido = resID.data.text.trim();
        const { data: equipos } = await supabase.from('cat_equipos').select('*');
        
        // Buscamos coincidencia parcial (por si el OCR lee "EH-..." en vez de "EH_...")
        const equipo = equipos?.find(eq => 
          tagLeido.replace(/[^A-Z0-9]/g, '').includes(eq.tag_id.replace(/[^A-Z0-9]/g, ''))
        );

        if (!equipo) {
          alert(`ERROR: ID no reconocido (${tagLeido}). Limpie el visor e intente sin flash.`);
          setLoading(false);
          return;
        }

        const nums = resDatos.data.lines
          .map(l => l.text.replace(/[^0-9.]/g, ''))
          .filter(n => n.length > 1);

        setDatosConfirmados({
          tagDetectado: equipo.tag_id,
          nombreEquipo: equipo.nombre,
          valorPrincipal: parseInt(nums[0] || "0"),
          metadatosAdicionales: {
            masa_kg_h: parseFloat(nums[1] || "0"),
            temperatura_c: parseFloat(nums[2] || "0"),
            densidad_kg_l: parseFloat(nums[3] || "0")
          }
        });
        setFotoUrl(roiID); // Mostramos el recorte del ID para verificar calidad
      } catch (err) {
        alert("Error en el análisis de imagen.");
      } finally {
        setLoading(false);
      }
    };
  };

  const handleGuardar = async () => {
    if (!datosConfirmados) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('operaciones_refineria').insert([{
        tipo_operacion: 'INGRESO_ACP',
        valor_lectura: datosConfirmados.valorPrincipal,
        masa_kg_h: datosConfirmados.metadatosAdicionales.masa_kg_h,
        temperatura_c: datosConfirmados.metadatosAdicionales.temperatura_c,
        densidad_kg_l: datosConfirmados.metadatosAdicionales.densidad_kg_l,
        es_reproceso: esReproceso,
        observaciones: `Lectura Segmentada ID: ${datosConfirmados.tagDetectado}`
      }]);
      if (error) throw error;
      alert("Registro guardado con éxito.");
      setDatosConfirmados(null);
      setFotoUrl(null);
    } catch (e: any) {
      alert("Error al guardar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 font-sans text-white">
      <canvas ref={canvasRef} className="hidden" />
      <div className="max-w-md mx-auto bg-[#161616] rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden">
        
        <header className={`p-8 text-center ${esReproceso ? 'bg-red-800/40' : 'bg-blue-800/40'} border-b border-white/5`}>
          <h2 className="text-xl font-black italic tracking-tighter uppercase">Captura de Datos</h2>
          <p className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Ajuste de Precisión ROI</p>
        </header>

        <div className="p-6 space-y-6">
          {!fotoUrl ? (
            <button onClick={() => fileInputRef.current?.click()} className="w-full h-44 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-all">
              <span className="text-4xl mb-2">{loading ? '⌛' : '📸'}</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {loading ? 'Segmentando y Analizando...' : 'Escanear Panel Masico'}
              </p>
            </button>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-black/50 p-4 rounded-2xl border border-blue-500/20">
                <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                  <span className="text-blue-400 font-mono font-bold text-xs">{datosConfirmados?.tagDetectado}</span>
                  <span className="text-[9px] text-gray-500 uppercase">{datosConfirmados?.nombreEquipo}</span>
                </div>
                
                <div className="text-center py-2">
                  <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Totalizador</p>
                  <p className="text-5xl font-black text-green-400 tracking-tighter">{datosConfirmados?.valorPrincipal.toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                    <p className="text-[7px] text-blue-500 font-bold uppercase">Masa</p>
                    <p className="font-bold text-sm">{datosConfirmados?.metadatosAdicionales.masa_kg_h}</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                    <p className="text-[7px] text-orange-500 font-bold uppercase">Temp</p>
                    <p className="font-bold text-sm">{datosConfirmados?.metadatosAdicionales.temperatura_c}°</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                    <p className="text-[7px] text-purple-500 font-bold uppercase">Dens</p>
                    <p className="font-bold text-sm">{datosConfirmados?.metadatosAdicionales.densidad_kg_l}</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setFotoUrl(null)} className="w-full text-[9px] font-bold text-gray-500 uppercase">Intentar otra toma</button>
            </div>
          )}

          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />

          <button onClick={handleGuardar} disabled={loading || !datosConfirmados} className={`w-full py-5 rounded-2xl font-black text-white text-[11px] tracking-[0.2em] transition-all shadow-xl ${esReproceso ? 'bg-red-600' : 'bg-blue-600'}`}>
            {loading ? 'PROCESANDO...' : 'GUARDAR LECTURA'}
          </button>
        </div>
      </div>
    </div>
  );
}