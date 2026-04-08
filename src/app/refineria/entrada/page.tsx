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
  version_test?: string;
}

export default function IngresoACP() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [datosConfirmados, setDatosConfirmados] = useState<DatosFlujometro | null>(null);
  const [observaciones, setObservaciones] = useState('');

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
      
      // CONFIGURACIÓN OCR
      const result = await Tesseract.recognize(publicUrl, 'eng');
      const text = result.data.text;

      // 1. Extraer Sumatoria (7-8 dígitos) - Forzamos ENTERO
      const sumMatch = text.match(/(\d{7,8})/);
      const sumatoria = sumMatch ? parseInt(sumMatch[1], 10) : 0;

      // 2. Extraer Masa (ṁ) - Busca número antes de kg/h
      const masaMatch = text.match(/(\d+\.\d+)\s*kg\/h/i);
      const masa = masaMatch ? parseFloat(masaMatch[1]) : 0;

      // 3. Extraer Temperatura (🌡) - Busca número antes de °C
      const tempMatch = text.match(/(\d+\.\d+)\s*°C/i);
      const temp = tempMatch ? parseFloat(tempMatch[1]) : 0;

      // 4. Extraer Densidad (ρ) - Busca número antes de kg/l
      const densMatch = text.match(/(\d+\.\d+)\s*kg\/l/i);
      const densidad = densMatch ? parseFloat(densMatch[1]) : 0;

      setDatosConfirmados({
        valorPrincipal: sumatoria,
        metadatosAdicionales: {
          masa_kg_h: masa,
          temperatura_c: temp,
          densidad_kg_l: densidad
        },
        version_test: "TESSERACT_FULL_SYNC"
      });
      
    } catch (error: any) {
      alert(error.message);
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
          // Columnas nuevas en Supabase
          masa_kg_h: datosConfirmados.metadatosAdicionales.masa_kg_h,
          temperatura_c: datosConfirmados.metadatosAdicionales.temperatura_c,
          densidad_kg_l: datosConfirmados.metadatosAdicionales.densidad_kg_l,
          usuario_registro: 'Operador'
        }]);

      if (error) throw error;
      alert("✅ Registro guardado con éxito.");
      router.push('/dashboard'); 
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-800">
        <div className="bg-blue-700 p-6 text-white text-center border-b-4 border-blue-900">
          <h1 className="text-xl font-black italic tracking-tighter">REFINERÍA - INGRESO ACP</h1>
        </div>

        <div className="p-5 space-y-5">
          {/* Cámara / Preview */}
          <div className="text-center">
            {fotoUrl ? (
              <div className="relative group">
                <img src={fotoUrl} className="w-full h-48 object-cover rounded-xl border-2 border-blue-500" alt="Captura" />
                <button 
                  onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition-all"
                >
                  CAMBIAR FOTO
                </button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full h-40 border-4 border-dashed border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
              >
                <span className="text-4xl mb-2">📸</span>
                <span className="text-xs font-black tracking-widest">{loading ? 'ESCANEANDO...' : 'CAPTURAR PANTALLA'}</span>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} id="ocr_input" name="ocr_input" className="hidden" onChange={handleCapture} />
          </div>

          {/* PANTALLA TIPO FLUJÓMETRO */}
          {datosConfirmados && (
            <div className="bg-[#0a0a0a] p-5 rounded-xl border-2 border-gray-700 font-mono text-green-500 shadow-inner">
              <div className="flex justify-between items-end border-b border-green-900/30 pb-2 mb-3">
                <span className="text-[10px] text-green-800 font-sans font-bold">ṁ</span>
                <span className="text-xl">{datosConfirmados.metadatosAdicionales.masa_kg_h.toFixed(3)} <span className="text-[10px]">kg/h</span></span>
              </div>

              <div className="py-4">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-green-800 font-sans font-bold">Σ1</span>
                  <span className="text-5xl font-black tracking-tighter text-green-400">
                    {datosConfirmados.valorPrincipal.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-green-900/30 pt-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-green-800 font-sans font-bold">🌡 TEMP</span>
                  <span className="text-lg">{datosConfirmados.metadatosAdicionales.temperatura_c.toFixed(2)}<span className="text-xs">°C</span></span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-green-800 font-sans font-bold">ρ DENS</span>
                  <span className="text-lg">{datosConfirmados.metadatosAdicionales.densidad_kg_l.toFixed(4)}<span className="text-xs">kg/l</span></span>
                </div>
              </div>
            </div>
          )}

          <textarea 
            id="obs" name="obs"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-gray-800 rounded-xl p-3 text-white text-xs border-none focus:ring-2 focus:ring-blue-600"
            placeholder="Observaciones de la carga..."
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !datosConfirmados}
            className={`w-full py-4 rounded-xl font-black text-white ${loading || !datosConfirmados ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'}`}
          >
            {loading ? 'PROCESANDO...' : 'GUARDAR LECTURA'}
          </button>
        </div>
      </div>
    </div>
  );
}