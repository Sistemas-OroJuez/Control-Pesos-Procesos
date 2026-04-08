'use client';
import { useState, useRef } from 'react';
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
  
  // ESTADO DE REPROCESO
  const [esReproceso, setEsReproceso] = useState(false);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setDatosConfirmados(null);

    try {
      const fileName = `${Date.now()}_acp.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('refineria_assets')
        .upload(fileName, file);

      if (uploadError) throw new Error("Error al subir imagen.");

      const { data: urlData } = supabase.storage
        .from('refineria_assets')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      setFotoUrl(publicUrl);
      
      const result = await Tesseract.recognize(publicUrl, 'eng');
      const text = result.data.text;

      const decimales = text.match(/\d+\.\d+/g) || [];
      const sumMatch = text.match(/(\d{7,8})/);
      const sumatoria = sumMatch ? parseInt(sumMatch[1], 10) : 0;

      const masa = decimales[0] ? parseFloat(decimales[0]) : 0;
      const temp = decimales[1] ? parseFloat(decimales[1]) : 0;
      const dens = decimales[2] ? parseFloat(decimales[2]) : 0;

      setDatosConfirmados({
        valorPrincipal: sumatoria,
        metadatosAdicionales: { masa_kg_h: masa, temperatura_c: temp, densidad_kg_l: dens }
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
          es_reproceso: esReproceso, // ENVIAMOS EL ESTADO ACTUAL
          usuario_registro: 'Operador Refinería'
        }]);

      if (error) throw error;
      alert(esReproceso ? "⚠️ Lectura de REPROCESO guardada" : "✅ Lectura NORMAL guardada");
      
      // Limpiamos solo la lectura, mantenemos el estado de reproceso si estaba activo
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
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-800">
        
        {/* Header dinámico según el estado */}
        <div className={`p-6 text-white text-center border-b-4 transition-colors ${esReproceso ? 'bg-orange-600 border-orange-800' : 'bg-blue-700 border-blue-900'}`}>
          <h1 className="text-xl font-black italic uppercase">
            {esReproceso ? '⚠️ MODO REPROCESO ACTIVADO' : 'REFINERÍA - PROCESO NORMAL'}
          </h1>
        </div>

        <div className="p-5 space-y-5">
          
          {/* CONTROL DE MODO REPROCESO */}
          <div className="bg-gray-800 p-4 rounded-2xl flex items-center justify-between border border-gray-700">
            <div>
              <p className="text-white font-bold text-sm">Estado del Proceso</p>
              <p className="text-gray-400 text-[10px] uppercase">¿Esta lectura es reproceso?</p>
            </div>
            <button 
              onClick={() => setEsReproceso(!esReproceso)}
              className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${esReproceso ? 'bg-orange-500 text-white animate-pulse' : 'bg-gray-700 text-gray-400'}`}
            >
              {esReproceso ? 'SÍ, REPROCESO' : 'NO, NORMAL'}
            </button>
          </div>

          <div className="text-center">
            {fotoUrl ? (
              <div className="relative">
                <img src={fotoUrl} className={`w-full h-48 object-cover rounded-xl border-2 ${esReproceso ? 'border-orange-500' : 'border-blue-500'}`} />
                <button onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 text-[10px] font-bold">REPETIR</button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="w-full h-40 border-4 border-dashed border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:text-blue-400 transition-colors">
                <span className="text-4xl mb-2">📸</span>
                <span className="text-xs font-black uppercase">{loading ? 'Procesando...' : 'Capturar Flujómetro'}</span>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          {datosConfirmados && (
            <div className={`bg-[#0a0a0a] p-5 rounded-xl border-2 font-mono shadow-inner ${esReproceso ? 'border-orange-900 text-orange-500' : 'border-gray-700 text-green-500'}`}>
              <div className="flex justify-between items-end border-b border-white/5 pb-2 mb-3">
                <span className="text-sm font-bold italic">ṁ</span>
                <span className="text-xl">{datosConfirmados.metadatosAdicionales.masa_kg_h.toFixed(3)} <span className="text-[10px]">kg/h</span></span>
              </div>
              <div className="py-4 flex justify-between items-start">
                <span className="text-sm font-bold italic">Σ1</span>
                <span className={`text-5xl font-black tracking-tighter ${esReproceso ? 'text-orange-400' : 'text-green-400'}`}>
                    {datosConfirmados.valorPrincipal.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                <div className="flex flex-col">
                  <span className="text-[10px] opacity-50 font-bold uppercase">🌡 Temp</span>
                  <span className="text-lg">{datosConfirmados.metadatosAdicionales.temperatura_c.toFixed(2)}°C</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] opacity-50 font-bold uppercase">ρ Dens</span>
                  <span className="text-lg">{datosConfirmados.metadatosAdicionales.densidad_kg_l.toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}

          <textarea 
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-gray-800 rounded-xl p-3 text-white text-xs border-none focus:ring-2 focus:ring-blue-600"
            placeholder={esReproceso ? "Indique motivo del reproceso..." : "Observaciones..."}
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !datosConfirmados}
            className={`w-full py-4 rounded-xl font-black text-white transition-all ${loading || !datosConfirmados ? 'bg-gray-700' : esReproceso ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            {loading ? 'GUARDANDO...' : esReproceso ? 'GUARDAR COMO REPROCESO' : 'GUARDAR LECTURA'}
          </button>
        </div>
      </div>
    </div>
  );
}