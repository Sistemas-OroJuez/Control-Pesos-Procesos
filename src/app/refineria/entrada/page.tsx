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
      try {
        const { data } = await supabase
          .from('estado_proceso_refineria')
          .select('en_reproceso')
          .eq('id', 'GLOBAL_STATUS')
          .single();
        if (data) setEsReproceso(data.en_reproceso);
      } catch (e) {
        console.error("Error cargando estado");
      }
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

      canvas.width = img.width;
      canvas.height = img.height;

      // 1. PRE-PROCESAMIENTO: Escala de grises y alto contraste
      ctx.filter = 'grayscale(100%) contrast(300%)';
      ctx.drawImage(img, 0, 0);

      // 2. FILTRO DE UMBRAL (Threshold) E INVERSIÓN
      // Esto convierte el fondo negro en blanco y el texto blanco en negro sólido
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // Umbral: si el píxel es claro (>120), lo volvemos negro (0). Si es oscuro, blanco (255).
        const color = avg > 120 ? 0 : 255; 
        data[i] = data[i+1] = data[i+2] = color;
      }
      ctx.putImageData(imageData, 0, 0);

      try {
        const processedImage = canvas.toDataURL('image/jpeg', 1.0);
        
        // 3. OCR SOBRE LA IMAGEN BINARIZADA
        const result = await Tesseract.recognize(processedImage, 'eng');
        const textOCR = result.data.text.toUpperCase();
        
        // Limpiamos el texto para buscar el ID en el catálogo
        const cleanOCR = textOCR.replace(/[^A-Z0-9_]/g, '');
        const { data: equipos } = await supabase.from('cat_equipos').select('*');
        const equipoVinculado = equipos?.find(eq => 
          cleanOCR.includes(eq.tag_id.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
        );

        if (!equipoVinculado) {
          alert("❌ ERROR: No se detectó el ID del equipo (EH_...). Tome la foto lo más nivelada posible.");
          setLoading(false);
          return;
        }

        // 4. EXTRACCIÓN DE VALORES POR FILAS
        const lines = result.data.lines.map(l => l.text.replace(/[^0-9.]/g, ''));
        const numeros = lines.filter(n => n.length > 2);

        setDatosConfirmados({
          valorPrincipal: parseInt(numeros.find(n => n.length >= 7) || "0"),
          tagDetectado: equipoVinculado.tag_id,
          nombreEquipo: equipoVinculado.nombre,
          metadatosAdicionales: {
            masa_kg_h: parseFloat(numeros.find(n => n.includes('.') && n.length > 5) || "0"),
            temperatura_c: parseFloat(numeros.find(n => n.length < 6 && n.includes('.')) || "0"),
            densidad_kg_l: parseFloat(numeros.reverse().find(n => n.includes('.') && n.length < 7) || "0")
          }
        });

        setFotoUrl(processedImage);
      } catch (error) {
        alert("Error procesando OCR");
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
        observaciones: `Auto-ID: ${datosConfirmados.tagDetectado} | ${observaciones}`
      }]);
      if (error) throw error;
      alert("Registro guardado con éxito");
      setFotoUrl(null);
      setDatosConfirmados(null);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <canvas ref={canvasRef} className="hidden" />
      <div className="max-w-md mx-auto bg-[#1a1a1a] rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/5">
        
        <header className={`p-8 text-white text-center ${esReproceso ? 'bg-red-700' : 'bg-blue-700'}`}>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter italic">Ingreso ACP</h1>
          <p className="text-[10px] font-bold opacity-50 tracking-[0.2em] mt-1 uppercase">Refinería Producción</p>
        </header>

        <div className="p-6 space-y-6">
          <div className="text-center">
            {fotoUrl ? (
              <div className="relative">
                <img src={fotoUrl} className="w-full rounded-3xl border border-blue-500/30" alt="Procesada" />
                <button onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }} className="absolute -top-2 -right-2 bg-red-600 text-white w-10 h-10 rounded-full font-bold shadow-xl border-4 border-[#1a1a1a]">✕</button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="w-full h-56 border-2 border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 transition-all bg-white/5">
                <div className="bg-white/5 p-5 rounded-full mb-3">
                  <span className="text-4xl">{loading ? '⌛' : '📸'}</span>
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest">{loading ? 'Analizando Fila por Fila...' : 'Escanear Panel Masico'}</span>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          {datosConfirmados && (
            <div className="bg-black/50 p-6 rounded-[2rem] border border-white/5 space-y-5 font-mono shadow-inner">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-blue-400 font-bold text-[10px] tracking-widest">{datosConfirmados.tagDetectado}</span>
                <span className="text-white/40 text-[9px] uppercase font-black">{datosConfirmados.nombreEquipo}</span>
              </div>
              
              <div className="text-center">
                <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Totalizador Σ1</p>
                <p className="text-6xl font-black text-green-400 tracking-tighter">
                  {datosConfirmados.valorPrincipal.toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                  <p className="text-[7px] text-gray-500 uppercase mb-1 font-bold">Masa</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatosAdicionales.masa_kg_h}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                  <p className="text-[7px] text-gray-500 uppercase mb-1 font-bold">Temp</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatosAdicionales.temperatura_c}°</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                  <p className="text-[7px] text-gray-500 uppercase mb-1 font-bold">Dens</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatosAdicionales.densidad_kg_l}</p>
                </div>
              </div>
            </div>
          )}

          <textarea 
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-white/5 rounded-2xl p-4 text-white text-[10px] border border-white/5 focus:ring-1 focus:ring-blue-500 outline-none shadow-inner"
            placeholder={esReproceso ? "Indique el motivo del reproceso..." : "Observaciones de carga..."}
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !datosConfirmados}
            className={`w-full py-5 rounded-2xl font-black text-white text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 ${esReproceso ? 'bg-red-600 shadow-red-500/30' : 'bg-blue-600 shadow-blue-500/30'}`}
          >
            {loading ? 'PROCESANDO LECTURA...' : 'CONFIRMAR Y GUARDAR'}
          </button>
        </div>
      </div>
    </div>
  );
}