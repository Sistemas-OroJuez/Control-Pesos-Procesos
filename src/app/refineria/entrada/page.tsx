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

      // --- CONFIGURACIÓN DE PLANO CARTESIANO (ROI) ---
      // Definimos el área de lectura en el centro de la imagen capturada.
      // x, y: punto de inicio | w, h: dimensiones del cuadro de lectura
      const w = img.width * 0.75;  // 75% del ancho de la foto
      const h = img.height * 0.45; // 45% del alto de la foto
      const x = (img.width - w) / 2;
      const y = (img.height - h) / 2;

      canvas.width = w;
      canvas.height = h;

      // 1. RECORTE SEGMENTADO + FILTROS DE CONTRASTE
      ctx.filter = 'grayscale(100%) contrast(350%) brightness(110%)';
      // Dibujamos solo el área del "plano" definido arriba
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

      // 2. INVERSIÓN BINARIA (Para que el OCR vea letras negras)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // Umbral: Si es claro (texto), poner negro (0). Si es oscuro (fondo), poner blanco (255)
        const color = avg > 150 ? 0 : 255; 
        data[i] = data[i+1] = data[i+2] = color;
      }
      ctx.putImageData(imageData, 0, 0);

      try {
        const processedImage = canvas.toDataURL('image/jpeg', 1.0);
        const result = await Tesseract.recognize(processedImage, 'eng');
        const textOCR = result.data.text.toUpperCase();
        
        // 3. BÚSQUEDA DEL ID EN EL ÁREA SEGMENTADA
        const cleanOCR = textOCR.replace(/[^A-Z0-9_]/g, '');
        const { data: equipos } = await supabase.from('cat_equipos').select('*');
        const equipoVinculado = equipos?.find(eq => 
          cleanOCR.includes(eq.tag_id.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
        );

        if (!equipoVinculado) {
          alert("❌ ERROR DE COORDENADAS: El ID no está dentro del cuadro de lectura. Centre más la pantalla.");
          setLoading(false);
          return;
        }

        // 4. EXTRACCIÓN POR PATRONES
        const numeros = result.data.lines
          .map(l => l.text.replace(/[^0-9.]/g, ''))
          .filter(n => n.length > 2);

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
        alert("Error en el procesador cartesiano");
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
        observaciones: `COORDENADAS OK - ID: ${datosConfirmados.tagDetectado}`
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
    <div className="min-h-screen bg-black p-4 flex flex-col items-center">
      <canvas ref={canvasRef} className="hidden" />
      <div className="w-full max-w-md bg-[#111] rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl">
        
        <header className={`p-8 text-center ${esReproceso ? 'bg-red-900/40' : 'bg-blue-900/40'} border-b border-white/5`}>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">Ingreso ACP</h1>
          <p className="text-[9px] font-bold text-white/40 tracking-[0.3em] uppercase mt-1">Lector de Segmentos</p>
        </header>

        <div className="p-6 space-y-6">
          <div className="relative">
            {fotoUrl ? (
              <div className="group">
                <img src={fotoUrl} className="w-full rounded-[2.5rem] border border-blue-500/20" />
                <button onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }} className="absolute -top-2 -right-2 bg-red-600 text-white w-10 h-10 rounded-full font-bold border-4 border-[#111]">✕</button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="w-full h-56 border-2 border-dashed border-white/10 rounded-[2.5rem] bg-white/5 flex flex-col items-center justify-center">
                <div className="bg-white/5 p-5 rounded-full mb-3">
                  <span className="text-4xl">{loading ? '⌛' : '📸'}</span>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Encuadre el panel negro</p>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          {datosConfirmados && (
            <div className="bg-black/50 p-6 rounded-[2rem] border border-white/10 space-y-5 font-mono">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-blue-400 font-bold text-[11px] tracking-tighter">{datosConfirmados.tagDetectado}</span>
                <span className="text-white/30 text-[9px] uppercase">{datosConfirmados.nombreEquipo}</span>
              </div>
              <div className="text-center">
                <p className="text-[8px] text-gray-500 font-black uppercase mb-1">Totalizador Σ</p>
                <p className="text-6xl font-black text-green-400 tracking-tighter leading-none">
                  {datosConfirmados.valorPrincipal.toLocaleString()}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                  <p className="text-blue-400 font-bold mb-1 uppercase text-[7px]">Masa</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatosAdicionales.masa_kg_h}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                  <p className="text-orange-400 font-bold mb-1 uppercase text-[7px]">Temp</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatosAdicionales.temperatura_c}°</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                  <p className="text-purple-400 font-bold mb-1 uppercase text-[7px]">Dens</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatosAdicionales.densidad_kg_l}</p>
                </div>
              </div>
            </div>
          )}

          <button onClick={handleGuardar} disabled={loading || !datosConfirmados} className={`w-full py-5 rounded-2xl font-black text-white text-[11px] tracking-[0.2em] transition-all ${esReproceso ? 'bg-red-600' : 'bg-blue-600'}`}>
            {loading ? 'CALCULANDO ÁREA...' : 'GUARDAR REGISTRO'}
          </button>
        </div>
      </div>
    </div>
  );
}