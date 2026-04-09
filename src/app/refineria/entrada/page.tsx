'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Interfaz para estructurar los datos de la IA y la DB
interface DatosConfirmados {
  tag: string;
  nombre?: string;
  totalizador: number;
  masa: number;
  temp: number;
  dens: number;
}

export default function LectorIndustrialIA() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [datosConfirmados, setDatosConfirmados] = useState<DatosConfirmados | null>(null);
  const [esReproceso, setEsReproceso] = useState(false);

  // URL de tu Space en Hugging Face
  const IA_URL = "https://orojuezsa-lector-ocr-industrial.hf.space/ocr";

  // Cargar estado de reproceso al iniciar
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

    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Enviar imagen a Hugging Face
      const response = await fetch(IA_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("La IA no responde (Cold Boot)");

      const data = await response.json();
      console.log("Datos recibidos de IA:", data);

      // 2. Buscar si el TAG existe en tu catálogo de equipos
      const { data: equipos } = await supabase.from('cat_equipos').select('*');
      const tagLimpio = data.tag_id.replace(/[^A-Z0-9]/g, '');
      const equipoMatch = equipos?.find(eq => 
        tagLimpio.includes(eq.tag_id.replace(/[^A-Z0-9]/g, ''))
      );

      // 3. Mapear los 4 valores del array [Total, Masa, Temp, Dens]
      setDatosConfirmados({
        tag: equipoMatch ? equipoMatch.tag_id : data.tag_id,
        nombre: equipoMatch?.nombre || "Equipo no identificado",
        totalizador: parseFloat(data.valores[0] || "0"),
        masa: parseFloat(data.valores[1] || "0"),
        temp: parseFloat(data.valores[2] || "0"),
        dens: parseFloat(data.valores[3] || "0")
      });

    } catch (err: any) {
      alert("Error: " + err.message);
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
        observaciones: `Captura IA - Tag detectado: ${datosConfirmados.tag}`
      }]);

      if (error) throw error;
      alert("✅ Lectura guardada exitosamente");
      setDatosConfirmados(null); // Limpiar pantalla
    } catch (e: any) {
      alert("Error al guardar en BD: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 text-white flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-[#111] rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden">
        
        <header className={`p-8 text-center ${esReproceso ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
          <h1 className="text-2xl font-black italic tracking-tighter">LECTOR IA INDUSTRIAL</h1>
          <p className="text-[10px] font-bold opacity-50 tracking-widest mt-1">ENDRESS+HAUSER MONITOR</p>
        </header>

        <div className="p-6 space-y-4">
          {!datosConfirmados ? (
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="w-full h-64 border-2 border-dashed border-white/20 rounded-[2.5rem] bg-white/5 flex flex-col items-center justify-center active:scale-95 transition-transform"
            >
              <span className="text-6xl mb-4">{loading ? '⏳' : '📸'}</span>
              <p className="text-[10px] font-black uppercase tracking-widest">
                {loading ? 'Procesando Imagen...' : 'Escanear Panel Masico'}
              </p>
            </button>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-white/5 p-4 rounded-3xl border border-white/10">
                <p className="text-[8px] text-blue-400 font-bold mb-1 uppercase">Identificación</p>
                <p className="text-lg font-mono font-bold">{datosConfirmados.tag}</p>
                <p className="text-[10px] opacity-40 uppercase">{datosConfirmados.nombre}</p>
              </div>

              <div className="bg-green-500/10 p-5 rounded-3xl border border-green-500/20 text-center">
                <p className="text-[9px] text-green-400 font-black uppercase mb-1">Totalizador Principal (Σ1)</p>
                <p className="text-5xl font-black tracking-tighter text-green-400">
                  {datosConfirmados.totalizador.toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                  <p className="text-[8px] text-gray-500 font-bold uppercase mb-1">Masa</p>
                  <p className="text-sm font-bold">{datosConfirmados.masa}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                  <p className="text-[8px] text-orange-400 font-bold uppercase mb-1">Temp</p>
                  <p className="text-sm font-bold">{datosConfirmados.temp}°C</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                  <p className="text-[8px] text-purple-400 font-bold uppercase mb-1">Dens</p>
                  <p className="text-sm font-bold">{datosConfirmados.dens}</p>
                </div>
              </div>

              <button 
                onClick={() => setDatosConfirmados(null)} 
                className="w-full text-[9px] font-bold text-gray-500 uppercase tracking-widest py-2"
              >
                ← Descartar y repetir
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
            className={`w-full py-6 rounded-[2rem] font-black text-[12px] tracking-[0.3em] uppercase transition-all ${
              datosConfirmados 
                ? 'bg-blue-600 shadow-blue-500/20 shadow-xl' 
                : 'bg-white/10 opacity-20'
            }`}
          >
            {loading ? 'CONECTANDO...' : 'CONFIRMAR Y GUARDAR'}
          </button>
        </div>
      </div>
    </div>
  );
}