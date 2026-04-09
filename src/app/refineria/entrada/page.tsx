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
      const { data } = await supabase
        .from('estado_proceso_refineria')
        .select('en_reproceso')
        .eq('id', 'GLOBAL_STATUS')
        .single();
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

      canvas.width = img.width;
      canvas.height = img.height;

      // 1. PRE-PROCESADO: Contraste máximo para combatir el reflejo del cristal
      ctx.filter = 'grayscale(100%) contrast(400%) brightness(120%)';
      ctx.drawImage(img, 0, 0);

      // 2. FILTRO BINARIO INVERSO ADAPTATIVO
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // Si el pixel es muy brillante (texto blanco o reflejo fuerte), se vuelve negro
        // Si es oscuro (fondo del panel), se vuelve blanco puro
        const color = avg > 140 ? 0 : 255; 
        data[i] = data[i+1] = data[i+2] = color;
      }
      ctx.putImageData(imageData, 0, 0);

      try {
        const processedImage = canvas.toDataURL('image/jpeg', 1.0);
        
        // 3. OCR CON CONFIGURACIÓN DE MOTOR
        const result = await Tesseract.recognize(processedImage, 'eng');
        const textOCR = result.data.text.toUpperCase();
        
        // 4. BÚSQUEDA DEL TAG ID EN EL CATÁLOGO
        const cleanOCR = textOCR.replace(/[^A-Z0-9_]/g, '');
        const { data: equipos } = await supabase.from('cat_equipos').select('*');
        
        const equipoVinculado = equipos?.find(eq => {
          const cleanTag = eq.tag_id.toUpperCase().replace(/[^A-Z0-9_]/g, '');
          return cleanOCR.includes(cleanTag);
        });

        if (!equipoVinculado) {
          alert("❌ ERROR: El reflejo impide leer el ID. Intente inclinar un poco el celular para evitar el brillo directo.");
          setLoading(false);
          return;
        }

        // 5. EXTRACCIÓN DE NÚMEROS POR ESTRUCTURA
        const lineasNumericas = result.data.lines
          .map(l => l.text.replace(/[^0-9.]/g, ''))
          .filter(n => n.length > 2);

        setDatosConfirmados({
          valorPrincipal: parseInt(lineasNumericas.find(n => n.length >= 7) || "0"),
          tagDetectado: equipoVinculado.tag_id,
          nombreEquipo: equipoVinculado.nombre,
          metadatosAdicionales: {
            masa_kg_h: parseFloat(lineasNumericas.find(n => n.includes('.') && n.length > 5) || "0"),
            temperatura_c: parseFloat(lineasNumericas.find(n => n.length < 6 && n.includes('.')) || "0"),
            densidad_kg_l: parseFloat(lineasNumericas.reverse().find(n => n.includes('.') && n.length < 7) || "0")
          }
        });

        setFotoUrl(processedImage);
      } catch (error) {
        alert("Error en el escaneo");
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
        observaciones: `ID: ${datosConfirmados.tagDetectado} - ${observaciones}`
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
    <div className="min-h-screen bg-black p-4 flex flex-col items-center">
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="w-full max-w-md bg-[#121212] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
        <header className={`p-8 text-center ${esReproceso ? 'bg-red-900/40' : 'bg-blue-900/40'} backdrop-blur-xl border-b border-white/5`}>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">Ingreso ACP</h1>
          <p className="text-[9px] font-bold text-white/40 tracking-[0.3em] uppercase mt-1">Refinería Producción</p>
        </header>

        <div className="p-6 space-y-6">
          {!fotoUrl ? (
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={loading}
              className="w-full h-52 border-2 border-dashed border-white/10 rounded-[2rem] bg-white/5 flex flex-col items-center justify-center group active:scale-95 transition-all"
            >
              <div className="bg-white/5 p-5 rounded-full mb-3 group-hover:bg-blue-500/20 transition-colors">
                <span className="text-4xl">{loading ? '⌛' : '📸'}</span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {loading ? 'Procesando Filas...' : 'Escanear Flujómetro'}
              </p>
            </button>
          ) : (
            <div className="relative animate-in fade-in duration-500">
              <img src={fotoUrl} className="w-full rounded-[2rem] border border-blue-500/20 shadow-2xl" />
              <button 
                onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }} 
                className="absolute -top-2 -right-2 bg-red-600 text-white w-9 h-9 rounded-full font-bold border-4 border-[#121212]"
              >✕</button>
            </div>
          )}

          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />

          {datosConfirmados && (
            <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 space-y-5">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-blue-400 font-mono text-[10px] font-bold">{datosConfirmados.tagDetectado}</span>
                <span className="text-white/40 text-[9px] font-black uppercase">{datosConfirmados.nombreEquipo}</span>
              </div>
              
              <div className="text-center py-2">
                <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Totalizador Σ</p>
                <p className="text-6xl font-black text-green-400 tracking-tighter">
                  {datosConfirmados.valorPrincipal.toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                  <p className="text-[7px] text-gray-500 font-bold uppercase mb-1">Masa</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatosAdicionales.masa_kg_h}</p>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                  <p className="text-[7px] text-gray-500 font-bold uppercase mb-1">Temp</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatosAdicionales.temperatura_c}°</p>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                  <p className="text-[7px] text-gray-500 font-bold uppercase mb-1">Dens</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatosAdicionales.densidad_kg_l}</p>
                </div>
              </div>
            </div>
          )}

          <textarea 
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-white/5 rounded-2xl p-4 text-white text-[10px] border border-white/5 outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Anotaciones de carga..."
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !datosConfirmados}
            className={`w-full py-5 rounded-2xl font-black text-white text-[11px] tracking-[0.2em] transition-all active:scale-95 ${esReproceso ? 'bg-red-600 shadow-red-500/20' : 'bg-blue-600 shadow-blue-500/20 shadow-lg'}`}
          >
            {loading ? 'LECTURA EN CURSO...' : 'CONFIRMAR REGISTRO'}
          </button>
        </div>
      </div>
    </div>
  );
}