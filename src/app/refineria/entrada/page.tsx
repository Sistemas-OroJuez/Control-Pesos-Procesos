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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [datosConfirmados, setDatosConfirmados] = useState<DatosFlujometro | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [esReproceso, setEsReproceso] = useState(false);

  // Cargar estado global al inicio
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
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. PRE-PROCESAMIENTO DINÁMICO
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Aplicamos filtros para resaltar el texto blanco sobre negro
      ctx.filter = 'grayscale(100%) contrast(250%) invert(100%)'; 
      ctx.drawImage(img, 0, 0);

      try {
        // 2. OCR CON WHITELIST (Solo números y puntos para evitar confusión con símbolos)
        const result = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng', {
          logger: m => console.log(m.progress)
        });

        // 3. LÓGICA DE EXTRACCIÓN POR FILAS Y PATRONES
        const lines = result.data.lines;
        const textoLimpio = result.data.text.toUpperCase();

        // Buscamos el TAG ID en el catálogo
        const { data: equipos } = await supabase.from('cat_equipos').select('*');
        const equipoVinculado = equipos?.find(eq => textoLimpio.includes(eq.tag_id.toUpperCase()));

        if (!equipoVinculado) {
          alert("⚠️ ERROR: No se detectó el ID del equipo (Fila superior).");
          setLoading(false);
          return;
        }

        // Filtramos solo los números de las líneas detectadas
        const numerosDetectados = lines
          .map(l => l.text.replace(/[^0-9.]/g, '').trim())
          .filter(n => n.length > 2);

        // Asignación por estructura (Basado en la imagen del contador):
        // Fila 2: Masa (Tiene decimales)
        // Fila 3: Sumatoria (Número largo sin decimales)
        // Fila 4: Temperatura
        // Fila 5: Densidad
        
        const masa = parseFloat(numerosDetectados.find(n => n.includes('.') && n.length > 5) || "0");
        const totalizador = parseInt(numerosDetectados.find(n => n.length >= 7 && !n.includes('.')) || "0");
        const temp = parseFloat(numerosDetectados.find(n => n.length < 6 && n.includes('.')) || "0");
        const dens = parseFloat(numerosDetectados.filter(n => n.includes('.')).reverse()[0] || "0");

        setDatosConfirmados({
          valorPrincipal: totalizador,
          tagDetectado: equipoVinculado.tag_id,
          nombreEquipo: equipoVinculado.nombre,
          metadatosAdicionales: {
            masa_kg_h: masa,
            temperatura_c: temp,
            densidad_kg_l: dens
          }
        });

        // Guardar la foto procesada para auditoría visual
        setFotoUrl(canvas.toDataURL('image/jpeg'));
        
      } catch (error) {
        alert("Error procesando la imagen");
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
        observaciones: `Equipo: ${datosConfirmados.nombreEquipo} [${datosConfirmados.tagDetectado}] - ${observaciones}`
      }]);
      if (error) throw error;
      alert("Registro guardado con éxito.");
      setFotoUrl(null);
      setDatosConfirmados(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-md mx-auto bg-[#1a1a1a] rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/5">
        
        <div className={`p-8 text-white text-center transition-all duration-500 ${esReproceso ? 'bg-red-600' : 'bg-blue-700'}`}>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">Ingreso ACP</h1>
          <p className="text-[10px] font-bold opacity-60 tracking-[0.3em] mt-1 uppercase">Refinería ProduccionORJ</p>
        </div>

        <div className="p-6 space-y-6">
          {/* IDENTIFICACIÓN DEL EQUIPO */}
          {datosConfirmados && (
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Equipo Detectado</p>
                <p className="text-white font-black text-sm">{datosConfirmados.nombreEquipo}</p>
              </div>
              <span className="text-blue-500 font-mono text-xs">{datosConfirmados.tagDetectado}</span>
            </div>
          )}

          {/* CAPTURA CON PREVIEW PROCESADO */}
          <div className="text-center">
            {fotoUrl ? (
              <div className="relative group">
                <img src={fotoUrl} className="w-full rounded-3xl border border-white/10" alt="Captura" />
                <button onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }} className="absolute -top-2 -right-2 bg-red-600 text-white w-8 h-8 rounded-full font-bold shadow-xl">✕</button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="w-full h-48 border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center text-gray-500 hover:border-blue-500/50 transition-all bg-white/5">
                <span className="text-5xl mb-3">📸</span>
                <span className="text-[11px] font-black uppercase tracking-widest">{loading ? 'Procesando Filas...' : 'Escanear Contador'}</span>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          {/* DISPLAY ESTILO INDUSTRIAL */}
          {datosConfirmados && (
            <div className="bg-[#050505] p-6 rounded-[2rem] border border-white/5 space-y-4 font-mono">
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-xs text-gray-500">ṁ (Masa)</span>
                <span className="text-xl text-white font-bold">{datosConfirmados.metadatosAdicionales.masa_kg_h.toFixed(3)} <span className="text-[10px] opacity-40">kg/h</span></span>
              </div>
              <div className="py-4">
                <span className="text-[10px] text-green-500 font-bold block mb-1">Σ1 (TOTALIZADOR)</span>
                <span className="text-6xl font-black text-green-400 tracking-tighter leading-none">
                  {datosConfirmados.valorPrincipal.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 text-[11px]">
                <div className="flex flex-col">
                  <span className="text-gray-600 uppercase mb-1">🌡 Temp.</span>
                  <span className="text-white font-bold text-lg">{datosConfirmados.metadatosAdicionales.temperatura_c.toFixed(2)}°C</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-gray-600 uppercase mb-1">ρ Dens.</span>
                  <span className="text-white font-bold text-lg">{datosConfirmados.metadatosAdicionales.densidad_kg_l.toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}

          <textarea 
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-white/5 rounded-2xl p-4 text-white text-xs border border-white/5 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="Anotaciones de carga..."
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !datosConfirmados}
            className={`w-full py-5 rounded-2xl font-black text-white text-[11px] tracking-[0.2em] shadow-2xl transition-all active:scale-95 ${esReproceso ? 'bg-red-600 shadow-red-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}
          >
            {loading ? 'ANALIZANDO...' : 'CONFIRMAR Y GUARDAR'}
          </button>
        </div>
      </div>
    </div>
  );
}