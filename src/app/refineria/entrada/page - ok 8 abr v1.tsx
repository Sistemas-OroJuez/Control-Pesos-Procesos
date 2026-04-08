'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Tesseract from 'tesseract.js';

interface DatosFlujometro {
  valorPrincipal: number;
  metadatosAdicionales: {
    masa_kg_h: number;
    temperatura_c: number;
    densidad_kg_l: number;
  };
}

export default function IngresoACP() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [datosConfirmados, setDatosConfirmados] = useState<DatosFlujometro | null>(null);
  const [observaciones, setObservaciones] = useState('');
  
  // ESTADO PERSISTENTE EN BASE DE DATOS
  const [esReproceso, setEsReproceso] = useState(false);

  // 1. CARGAR ESTADO ACTUAL AL ENTRAR A LA APP
  useEffect(() => {
    const cargarEstadoGlobal = async () => {
      try {
        const { data, error } = await supabase
          .from('estado_proceso_refineria')
          .select('en_reproceso')
          .eq('id', 'GLOBAL_STATUS')
          .single();
        
        if (data) setEsReproceso(data.en_reproceso);
        if (error) console.error("Error cargando estado:", error);
      } catch (e) {
        console.error("Error de conexión");
      }
    };
    cargarEstadoGlobal();
  }, []);

  // 2. FUNCIÓN PARA CAMBIAR EL MODO (Sincronizado con Supabase)
  const toggleReproceso = async () => {
    const nuevoEstado = !esReproceso;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('estado_proceso_refineria')
        .upsert({ 
          id: 'GLOBAL_STATUS', 
          en_reproceso: nuevoEstado, 
          actualizado_el: new Date(),
          usuario_que_cambio: 'Operador Refinería'
        });
      
      if (error) throw error;
      setEsReproceso(nuevoEstado);
    } catch (e: any) {
      alert("Error al actualizar estado global: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileName = `${Date.now()}_acp.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('refineria_assets')
        .upload(fileName, file);

      if (uploadError) throw new Error("Error al subir imagen.");

      const { data: urlData } = supabase.storage
        .from('refineria_assets')
        .getPublicUrl(fileName);

      setFotoUrl(urlData.publicUrl);
      
      // OCR Local
      const result = await Tesseract.recognize(urlData.publicUrl, 'eng');
      const text = result.data.text;
      
      const decimales = text.match(/\d+\.\d+/g) || [];
      const sumMatch = text.match(/(\d{7,8})/);

      setDatosConfirmados({
        valorPrincipal: sumMatch ? parseInt(sumMatch[1], 10) : 0,
        metadatosAdicionales: {
          masa_kg_h: decimales[0] ? parseFloat(decimales[0]) : 0,
          temperatura_c: decimales[1] ? parseFloat(decimales[1]) : 0,
          densidad_kg_l: decimales[2] ? parseFloat(decimales[2]) : 0
        }
      });
      
    } catch (error: any) {
      alert("Error: " + error.message);
      setFotoUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardar = async () => {
    if (!fotoUrl || !datosConfirmados) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('operaciones_refineria')
        .insert([{
          tipo_operacion: 'INGRESO_ACP',
          valor_lectura: datosConfirmados.valorPrincipal, 
          foto_url: fotoUrl,
          observaciones: observaciones,
          masa_kg_h: Number(datosConfirmados.metadatosAdicionales.masa_kg_h),
          temperatura_c: Number(datosConfirmados.metadatosAdicionales.temperatura_c),
          densidad_kg_l: Number(datosConfirmados.metadatosAdicionales.densidad_kg_l),
          es_reproceso: esReproceso, // Guarda el estado global
          usuario_registro: 'Operador Refinería'
        }]);

      if (error) throw error;
      alert("Lectura guardada correctamente.");
      setFotoUrl(null);
      setDatosConfirmados(null);
      setObservaciones('');
    } catch (error: any) {
      alert("Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-md mx-auto bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-800">
        
        {/* INDICADOR DE ESTADO GLOBAL */}
        <div className={`p-6 text-white text-center border-b-4 transition-all duration-500 ${esReproceso ? 'bg-red-600 border-red-900 animate-pulse' : 'bg-blue-700 border-blue-900'}`}>
          <h1 className="text-xl font-black italic uppercase tracking-tighter">
            {esReproceso ? '⚠️ MODO REPROCESO' : 'PROCESO NORMAL'}
          </h1>
          <p className="text-[10px] opacity-80 mt-1 font-bold">ESTADO SINCRONIZADO PARA TODA LA PLANTA</p>
        </div>

        <div className="p-5 space-y-5">
          
          {/* SWITCH DE REPROCESO */}
          <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-white text-xs font-bold uppercase">Estado:</span>
              <span className={`text-[10px] font-black ${esReproceso ? 'text-red-400' : 'text-blue-400'}`}>
                {esReproceso ? 'RECIRCULANDO' : 'CARGA NUEVA'}
              </span>
            </div>
            <button 
              onClick={toggleReproceso}
              disabled={loading}
              className={`px-4 py-2 rounded-xl font-black text-[10px] transition-all ${esReproceso ? 'bg-red-500 text-white border-b-4 border-red-800' : 'bg-gray-800 text-gray-400 border-b-4 border-gray-950'}`}
            >
              {esReproceso ? 'TERMINAR REPROCESO' : 'CAMBIAR A REPROCESO'}
            </button>
          </div>

          {/* CAPTURA */}
          <div className="text-center">
            {fotoUrl ? (
              <div className="relative">
                <img src={fotoUrl} className={`w-full h-48 object-cover rounded-xl border-2 ${esReproceso ? 'border-red-500' : 'border-blue-500'}`} alt="Captura" />
                <button onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 text-[10px] font-bold">X</button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="w-full h-32 border-4 border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:text-blue-500">
                <span className="text-4xl mb-1">📸</span>
                <span className="text-[10px] font-black uppercase tracking-widest">{loading ? 'Procesando...' : 'Capturar Flujómetro'}</span>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          {/* VISTA PREVIA (ESTILO FLUJÓMETRO) */}
          {datosConfirmados && (
            <div className={`bg-[#050505] p-5 rounded-xl border-2 font-mono shadow-inner ${esReproceso ? 'border-red-900 text-red-500' : 'border-green-900 text-green-500'}`}>
              <div className="flex justify-between items-end border-b border-white/5 pb-2 mb-3">
                <span className="text-xs font-bold italic">ṁ</span>
                <span className="text-xl">{datosConfirmados.metadatosAdicionales.masa_kg_h.toFixed(3)} <span className="text-[10px]">kg/h</span></span>
              </div>
              <div className="py-4 flex justify-between items-start">
                <span className="text-xs font-bold italic">Σ1</span>
                <span className={`text-5xl font-black tracking-tighter ${esReproceso ? 'text-red-400' : 'text-green-400'}`}>
                  {datosConfirmados.valorPrincipal.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                <div className="flex flex-col">
                  <span className="text-[10px] opacity-50 uppercase">🌡 Temp</span>
                  <span className="text-lg">{datosConfirmados.metadatosAdicionales.temperatura_c.toFixed(2)}°C</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] opacity-50 uppercase">ρ Dens</span>
                  <span className="text-lg">{datosConfirmados.metadatosAdicionales.densidad_kg_l.toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}

          <textarea 
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-gray-900 rounded-xl p-3 text-white text-[10px] border-none focus:ring-1 focus:ring-blue-500"
            placeholder={esReproceso ? "Indique por qué es reproceso..." : "Observaciones..."}
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !datosConfirmados}
            className={`w-full py-4 rounded-xl font-black text-white text-xs tracking-widest shadow-lg ${esReproceso ? 'bg-red-600 shadow-red-900/20' : 'bg-blue-600 shadow-blue-900/20'}`}
          >
            {loading ? 'CARGANDO...' : esReproceso ? 'REGISTRAR REPROCESO' : 'REGISTRAR LECTURA NORMAL'}
          </button>
        </div>
      </div>
    </div>
  );
}