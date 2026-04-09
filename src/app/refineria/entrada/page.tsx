'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface DatosConfirmados {
  tag: string;
  nombre?: string;
  totalizador: string;
  masa: string;
  temp: string;
  dens: string;
}

export default function LectorIndustrialIA() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [datosConfirmados, setDatosConfirmados] = useState<DatosConfirmados | null>(null);
  const [esReproceso, setEsReproceso] = useState(false);

  const IA_URL = "https://orojuezsa-lector-ocr-industrial.hf.space/ocr";

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

  // FUNCIÓN CRÍTICA: Separa los números si vienen pegados
  const procesarLecturaSucia = (data: any) => {
    let valores = data.valores || ["0", "0", "0", "0"];
    
    // Si el totalizador es un número gigante (ruido de OCR), intentamos limpiar
    let total = valores[0];
    if (total.length > 8) {
        // En tus fotos, el totalizador real suele ser la parte central
        // Intentamos extraer un número coherente de 7 dígitos
        const match = total.match(/\d{7}/);
        total = match ? match[0] : total.slice(-7);
    }

    return {
      totalizador: total,
      masa: valores[1] || "0",
      temp: valores[2] || "0",
      dens: valores[3] || "0"
    };
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(IA_URL, { method: "POST", body: formData });
      const data = await response.json();
      const data = await res.json();
      console.log("Datos recibidos de la IA:", data); // Esto te dirá qué está llegando realmente

      const lecturaLimpia = procesarLecturaSucia(data);

      const { data: equipos } = await supabase.from('cat_equipos').select('*');
      const tagID = data.tag_id || "No detectado";
      const equipo = equipos?.find(eq => tagID.includes(eq.tag_id));

      setDatosConfirmados({
        tag: equipo ? equipo.tag_id : tagID,
        nombre: equipo?.nombre || "Equipo no identificado",
        ...lecturaLimpia
      });

    } catch (err) {
      alert("Error en la lectura de IA");
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
        valor_lectura: parseFloat(datosConfirmados.totalizador),
        masa_kg_h: parseFloat(datosConfirmados.masa),
        temperatura_c: parseFloat(datosConfirmados.temp),
        densidad_kg_l: parseFloat(datosConfirmados.dens),
        es_reproceso: esReproceso
      }]);
      if (error) throw error;
      alert("✅ Guardado");
      setDatosConfirmados(null);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 text-white flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-[#0f0f0f] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden">
        
        <header className={`p-6 text-center ${esReproceso ? 'bg-red-900/20' : 'bg-blue-900/20'}`}>
          <h1 className="text-xl font-black tracking-tighter uppercase">Oro Juez IA</h1>
          <p className="text-[9px] font-bold opacity-50 tracking-widest">MONITOR DE FLUJO MÁSICO</p>
        </header>

        <div className="p-6 space-y-4">
          {!datosConfirmados ? (
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="w-full h-56 border-2 border-dashed border-white/10 rounded-[2rem] bg-white/[0.02] flex flex-col items-center justify-center"
            >
              <span className="text-5xl mb-3">{loading ? '⏳' : '📸'}</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                {loading ? 'Procesando...' : 'Escanear Panel'}
              </p>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <p className="text-[8px] text-blue-400 font-bold uppercase mb-1">TAG Detectado</p>
                <p className="text-md font-mono font-bold">{datosConfirmados.tag}</p>
              </div>

              <div className="bg-green-500/10 p-5 rounded-3xl border border-green-500/20 text-center">
                <p className="text-[9px] text-green-400 font-bold uppercase mb-1">Totalizador (Σ1)</p>
                <p className="text-5xl font-black text-green-400 tracking-tighter">
                  {datosConfirmados.totalizador}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 p-3 rounded-xl text-center">
                  <p className="text-[8px] text-gray-500 font-bold uppercase">Masa</p>
                  <p className="text-sm font-bold">{datosConfirmados.masa}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl text-center">
                  <p className="text-[8px] text-orange-400 font-bold uppercase">Temp</p>
                  <p className="text-sm font-bold">{datosConfirmados.temp}°</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl text-center">
                  <p className="text-[8px] text-purple-400 font-bold uppercase">Dens</p>
                  <p className="text-sm font-bold">{datosConfirmados.dens}</p>
                </div>
              </div>

              <button onClick={() => setDatosConfirmados(null)} className="w-full text-[10px] text-gray-500 font-bold py-2">
                ← REPETIR CAPTURA
              </button>
            </div>
          )}

          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />

          <button 
            onClick={handleGuardar}
            disabled={!datosConfirmados || loading}
            className="w-full py-5 bg-blue-600 rounded-3xl font-bold text-xs tracking-widest uppercase disabled:opacity-20"
          >
            Confirmar y Guardar
          </button>
        </div>
      </div>
    </div>
  );
}