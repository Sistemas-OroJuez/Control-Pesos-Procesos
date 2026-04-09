'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Estructura de datos para la interfaz y la base de datos
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

  // URL de tu Space en Hugging Face
  const IA_URL = "https://orojuezsa-lector-ocr-industrial.hf.space/ocr";

  // Cargar estado de reproceso desde Supabase al iniciar
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

  // Función para limpiar números gigantes (si la IA pega varios valores)
  const limpiarValorIA = (val: string, esTotalizador: boolean) => {
    if (!val || val === "0") return "0";
    
    // Si la lectura es un "chorizo" de más de 12 dígitos, intentamos rescatar 
    // la parte final que suele ser el valor real en este modelo de panel.
    if (val.length > 12) {
      return val.slice(-7); 
    }
    return val;
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(IA_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Servidor IA no disponible");

      const data = await response.json();
      console.log("Respuesta Servidor:", data);

      // Validación de seguridad para el array de valores
      const valoresIA = data.valores && Array.isArray(data.valores) 
        ? data.valores 
        : ["0", "0", "0", "0"];

      // Intentar cruzar el TAG detectado con tu catálogo en Supabase
      const { data: equipos } = await supabase.from('cat_equipos').select('*');
      const tagDetectado = data.tag_id || "No detectado";
      const equipoMatch = equipos?.find(eq => 
        tagDetectado.toUpperCase().includes(eq.tag_id.toUpperCase())
      );

      setDatosConfirmados({
        tag: equipoMatch ? equipoMatch.tag_id : tagDetectado,
        nombre: equipoMatch?.nombre || "Equipo no identificado",
        totalizador: limpiarValorIA(valoresIA[0], true),
        masa: valoresIA[1] || "0",
        temp: valoresIA[2] || "0",
        dens: valoresIA[3] || "0"
      });

    } catch (err: any) {
      alert("Error de conexión: " + err.message);
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
        es_reproceso: esReproceso,
        observaciones: `Captura IA - Tag: ${datosConfirmados.tag}`
      }]);

      if (error) throw error;
      alert("✅ Datos guardados correctamente");
      setDatosConfirmados(null);
    } catch (e: any) {
      alert("Error al guardar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 text-white flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-[#0a0a0a] rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden">
        
        {/* Encabezado Dinámico */}
        <header className={`p-8 text-center ${esReproceso ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
          <h1 className="text-2xl font-black italic tracking-tighter italic">ORO JUEZ IA</h1>
          <p className="text-[10px] font-bold opacity-50 tracking-[0.2em] mt-1">LECTOR DE FLUJO MÁSICO</p>
        </header>

        <div className="p-6 space-y-4">
          {!datosConfirmados ? (
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={loading}
              className="w-full h-64 border-2 border-dashed border-white/10 rounded-[2.5rem] bg-white/[0.02] flex flex-col items-center justify-center active:scale-95 transition-all"
            >
              <span className="text-6xl mb-4">{loading ? '⏳' : '📸'}</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                {loading ? 'Analizando Panel...' : 'Escanear Pantalla'}
              </p>
            </button>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Bloque de Identificación */}
              <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                <p className="text-[8px] text-blue-400 font-bold mb-1 uppercase tracking-widest">TAG Equipo</p>
                <p className="text-lg font-mono font-bold leading-none">{datosConfirmados.tag}</p>
                <p className="text-[10px] opacity-40 uppercase mt-1">{datosConfirmados.nombre}</p>
              </div>

              {/* Valor Principal: Totalizador */}
              <div className="bg-green-500/5 p-6 rounded-[2rem] border border-green-500/20 text-center">
                <p className="text-[9px] text-green-400 font-black uppercase mb-1 tracking-widest">Totalizador (Σ1)</p>
                <p className="text-5xl font-black tracking-tighter text-green-400">
                  {datosConfirmados.totalizador}
                </p>
              </div>

              {/* Grid de valores secundarios */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                  <p className="text-[8px] text-gray-500 font-bold uppercase mb-1">Masa</p>
                  <p className="text-sm font-bold font-mono">{datosConfirmados.masa}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                  <p className="text-[8px] text-orange-400 font-bold uppercase mb-1">Temp</p>
                  <p className="text-sm font-bold font-mono">{datosConfirmados.temp}°</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                  <p className="text-[8px] text-purple-400 font-bold uppercase mb-1">Dens</p>
                  <p className="text-sm font-bold font-mono">{datosConfirmados.dens}</p>
                </div>
              </div>

              <button 
                onClick={() => setDatosConfirmados(null)} 
                className="w-full text-[9px] font-bold text-gray-600 uppercase tracking-widest py-2 hover:text-white transition-colors"
              >
                ← Cancelar y repetir
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
                ? 'bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95' 
                : 'bg-white/5 opacity-20 cursor-not-allowed'
            }`}
          >
            {loading ? 'Procesando...' : 'Confirmar Lectura'}
          </button>
        </div>
      </div>
    </div>
  );
}