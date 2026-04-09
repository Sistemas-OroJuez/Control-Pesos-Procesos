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

      // --- PLANO CARTESIANO DEL PANEL ---
      const pW = img.width * 0.85;  
      const pH = img.height * 0.50; 
      const pX = (img.width - pW) / 2;
      const pY = (img.height - pH) / 2;

      // 1. SEGMENTO ID: Fila 1 (Superior Izquierda - 20% Altura)
      const idW = pW * 0.40; 
      const idH = pH * 0.20; 
      canvas.width = idW;
      canvas.height = idH;
      ctx.filter = 'grayscale(100%) contrast(450%) invert(100%)';
      ctx.drawImage(img, pX, pY, idW, idH, 0, 0, idW, idH);
      const roiID = canvas.toDataURL('image/jpeg', 1.0);

      // 2. SEGMENTO DATOS: Filas 2-5 (Derecha - 80% Altura restante)
      const dW = pW * 0.60; 
      const dH = pH * 0.80; 
      const dX = pX + (pW * 0.40); // Empieza tras el ID
      const dY = pY + (pH * 0.20); // Empieza bajo la fila 1
      canvas.width = dW;
      canvas.height = dH;
      ctx.filter = 'grayscale(100%) contrast(350%) invert(100%)';
      ctx.drawImage(img, dX, dY, dW, dH, 0, 0, dW, dH);
      const roiDatos = canvas.toDataURL('image/jpeg', 1.0);

      try {
        const [resID, resDatos] = await Promise.all([
          Tesseract.recognize(roiID, 'eng'),
          Tesseract.recognize(roiDatos, 'eng')
        ]);

        const cleanID = resID.data.text.replace(/[^A-Z0-9_-]/g, '');
        const { data: equipos } = await supabase.from('cat_equipos').select('*');
        const equipo = equipos?.find(eq => cleanID.includes(eq.tag_id.replace(/[^A-Z0-9_-]/g, '')));

        if (!equipo) {
          alert(`ID no detectado. Leído: ${cleanID}. Centre el ID en la esquina superior izquierda.`);
          setLoading(false);
          return;
        }

        const nums = resDatos.data.lines
          .map(l => l.text.replace(/[^0-9.]/g, ''))
          .filter(n => n.length > 1);

        setDatosConfirmados({
          tagDetectado: equipo.tag_id,
          nombreEquipo: equipo.nombre,
          valorPrincipal: parseInt(nums[0] || "0"), // Fila 2
          metadatosAdicionales: {
            masa_kg_h: parseFloat(nums[1] || "0"),    // Fila 3
            temperatura_c: parseFloat(nums[2] || "0"),// Fila 4
            densidad_kg_l: parseFloat(nums[3] || "0") // Fila 5
          }
        });

        setFotoUrl(roiDatos); 
      } catch (err) {
        alert("Fallo en la lectura por coordenadas.");
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
        observaciones: `Segmentado OK - ID: ${datosConfirmados.tagDetectado}`
      }]);
      if (error) throw error;
      alert("Guardado con éxito");
      setDatosConfirmados(null);
      setFotoUrl(null);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 flex flex-col items-center font-sans">
      <canvas ref={canvasRef} className="hidden" />
      <div className="w-full max-w-md bg-[#111] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
        
        <header className={`p-8 text-center ${esReproceso ? 'bg-red-900/40' : 'bg-blue-900/40'} border-b border-white/5`}>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">Ingreso ACP</h1>
          <p className="text-[10px] font-bold text-white/30 tracking-[0.3em] uppercase mt-1">Lector de Segmentos 20/80</p>
        </header>

        <div className="p-6 space-y-6">
          {!fotoUrl ? (
            <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="w-full h-52 border-2 border-dashed border-white/10 rounded-[2rem] bg-white/5 flex flex-col items-center justify-center">
              <span className="text-4xl mb-3">{loading ? '⌛' : '📸'}</span>
              <p className="text-[10px] font-black uppercase text-gray-500">{loading ? 'Procesando Filas...' : 'Escanear Panel Central'}</p>
            </button>
          ) : (
            <div className="bg-black/50 p-6 rounded-[2rem] border border-blue-500/20 space-y-5 animate-in fade-in">
              <div className="flex justify-between items-center border-b border-white/5 pb-3 font-mono">
                <span className="text-blue-400 font-bold text-[11px]">{datosConfirmados?.tagDetectado}</span>
                <span className="text-white/30 text-[9px] uppercase">{datosConfirmados?.nombreEquipo}</span>
              </div>
              <div className="text-center">
                <p className="text-[8px] text-gray-600 font-black uppercase mb-1">Totalizador Σ1</p>
                <p className="text-6xl font-black text-green-400 tracking-tighter">{datosConfirmados?.valorPrincipal.toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <p className="text-[7px] text-blue-400 font-bold uppercase">Masa</p>
                  <p className="text-white text-xs">{datosConfirmados?.metadatosAdicionales.masa_kg_h}</p>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <p className="text-[7px] text-orange-400 font-bold uppercase">Temp</p>
                  <p className="text-white text-xs">{datosConfirmados?.metadatosAdicionales.temperatura_c}°</p>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <p className="text-[7px] text-purple-400 font-bold uppercase">Dens</p>
                  <p className="text-white text-xs">{datosConfirmados?.metadatosAdicionales.densidad_kg_l}</p>
                </div>
              </div>
              <button onClick={() => setFotoUrl(null)} className="w-full text-[9px] font-bold text-gray-600 uppercase tracking-widest">Re-escanear</button>
            </div>
          )}

          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />

          <button onClick={handleGuardar} disabled={loading || !datosConfirmados} className={`w-full py-5 rounded-2xl font-black text-white text-[11px] tracking-[0.2em] shadow-xl ${esReproceso ? 'bg-red-600' : 'bg-blue-600'}`}>
            {loading ? 'ANALIZANDO...' : 'CONFIRMAR Y GUARDAR'}
          </button>
        </div>
      </div>
    </div>
  );
}