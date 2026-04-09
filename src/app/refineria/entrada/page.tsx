'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Definimos la estructura de datos que esperamos de la IA y de la DB
interface DatosConfirmados {
  tag: string;
  nombre?: string;
  totalizador: number;
  masa: number;
  temp: number;
  dens: number;
}

export default function IngresoACP() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [datosConfirmados, setDatosConfirmados] = useState<DatosConfirmados | null>(null);
  const [esReproceso, setEsReproceso] = useState(false);

  // URL de tu Space en Hugging Face (Endpoint de la IA)
  const IA_URL = "https://orojuezsa-lector-ocr-industrial.hf.space/ocr";

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

    // 1. Preparamos el FormData para enviar la imagen a la IA
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 2. Petición a Hugging Face
      const response = await fetch(IA_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("La IA no responde. Verifique que el Space esté activo.");

      const data = await response.json();
      
      // 3. Cruzar el ID detectado con la base de datos de Supabase
      const { data: equipos } = await supabase.from('cat_equipos').select('*');
      const tagLimpio = data.tag_id.replace(/[^A-Z0-9]/g, '');
      const equipo = equipos?.find(eq => tagLimpio.includes(eq.tag_id.replace(/[^A-Z0-9]/g, '')));

      // 4. Mapear valores numéricos (Fila 2=Totalizador, Fila 3=Masa, etc.)
      setDatosConfirmados({
        tag: equipo ? equipo.tag_id : (data.tag_id || "ID DESCONOCIDO"),
        nombre: equipo?.nombre || "No registrado",
        totalizador: parseInt(data.valores[0] || "0"),
        masa: parseFloat(data.valores[1] || "0"),
        temp: parseFloat(data.valores[2] || "0"),
        dens: parseFloat(data.valores[3] || "0")
      });

    } catch (err: any) {
      alert("Error de conexión con la IA: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardar = async () => {
    if (!datosConfirmados) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('operaciones_refineria').insert([{
        tipo_operacion: 'INGRESO_ACP',
        valor_lectura: datosConfirmados.totalizador,
        masa_kg_h: datosConfirmados.masa,
        temperatura_c: datosConfirmados.temp,
        densidad_kg_l: datosConfirmados.dens,
        es_reproceso: esReproceso,
        observaciones: `Captura IA EasyOCR - Tag: ${datosConfirmados.tag}`
      }]);
      if (error) throw error;
      alert("✅ Datos guardados correctamente en Supabase");
      setDatosConfirmados(null);
    } catch (e: any) {
      alert("Error al guardar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 text-white font-sans flex flex-col items-center">
      <div className="w-full max-w-md bg-[#111] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
        
        <header className={`p-8 text-center ${esReproceso ? 'bg-red-900/30' : 'bg-blue-900/30'} border-b border-white/5`}>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">Lector IA Masico</h1>
          <p className="text-[9px] font-bold opacity-40 uppercase tracking-[0.2em] mt-1">Powered by EasyOCR & Hugging Face</p>
        </header>

        <div className="p-6 space-y-6">
          {!datosConfirmados ? (
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={loading}
              className="w-full h-52 border-2 border-dashed border-white/10 rounded-[2.5rem] bg-white/5 flex flex-col items-center justify-center transition-all active:scale-95"
            >
              <span className="text-5xl mb-4">{loading ? '⌛' : '📸'}</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {loading ? 'Procesando con Redes Neuronales...' : 'Tomar Foto al Panel'}
              </p>
            </button>
          ) : (
            <div className="bg-black/40 p-6 rounded-[2rem] border border-blue-500/20 space-y-5 animate-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex flex-col">
                  <span className="text-[8px] text-blue-400 font-black uppercase">TAG EQUIPO</span>
                  <span className="text-sm font-bold font-mono">{datosConfirmados.tag}</span>
                </div>
                <span className="text-[9px] text-white/30 uppercase">{datosConfirmados.nombre}</span>
              </div>

              <div className="text-center">
                <p className="text-[8px] text-gray-500 font-black uppercase mb-1">Totalizador Principal</p>
                <p className="text-6xl font-black text-green-400 tracking-tighter">
                  {datosConfirmados.totalizador.toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[7px] text-blue-400 font-bold uppercase mb-1">Masa</p>
                  <p className="font-bold text-xs">{datosConfirmados.masa}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[7px] text-orange-400 font-bold uppercase mb-1">Temp</p>
                  <p className="font-bold text-xs">{datosConfirmados.temp}°</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[7px] text-purple-400 font-bold uppercase mb-1">Dens</p>
                  <p className="font-bold text-xs">{datosConfirmados.dens}</p>
                </div>
              </div>

              <button 
                onClick={() => setDatosConfirmados(null)} 
                className="w-full py-2 text-[8px] font-black text-gray-600 uppercase tracking-widest"
              >
                Volver a escanear
              </button>
            </div>
          )}

          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleCapture} 
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !datosConfirmados}
            className={`w-full py-5 rounded-2xl font-black text-white text-[11px] tracking-[0.2em] transition-all shadow-xl ${
              datosConfirmados ? (esReproceso ? 'bg-red-600' : 'bg-blue-600') : 'bg-gray-800 opacity-30'
            }`}
          >
            {loading ? 'ANALIZANDO...' : 'GUARDAR LECTURA'}
          </button>
        </div>
      </div>
    </div>
  );
}