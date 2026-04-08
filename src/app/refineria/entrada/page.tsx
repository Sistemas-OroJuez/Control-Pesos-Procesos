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

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setDatosConfirmados(null);

    try {
      // 1. Subir imagen a Supabase
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
      
      // 2. Ejecutar OCR localmente con Tesseract.js
      const result = await Tesseract.recognize(publicUrl, 'eng', {
        logger: m => console.log(m.status, m.progress)
      });

      const text = result.data.text;
      console.log("Texto detectado:", text);

      // --- LÓGICA DE EXTRACCIÓN CON SEGURIDAD ---
      
      // Buscamos todos los números que tengan un punto decimal
      const decimales = text.match(/\d+\.\d+/g) || [];
      
      // Buscamos el número largo de 7-8 dígitos (Sumatoria Σ1)
      const sumMatch = text.match(/(\d{7,8})/);
      const sumatoria = sumMatch ? parseInt(sumMatch[1], 10) : 0;

      // Cambios para mayor seguridad: Validación de existencia antes de parsear
      const masa = decimales[0] ? parseFloat(decimales[0]) : 0;
      const temp = decimales[1] ? parseFloat(decimales[1]) : 0;
      const dens = decimales[2] ? parseFloat(decimales[2]) : 0;

      setDatosConfirmados({
        valorPrincipal: sumatoria,
        metadatosAdicionales: {
          masa_kg_h: masa,
          temperatura_c: temp,
          densidad_kg_l: dens
        }
      });
      
    } catch (error: any) {
      alert("Error en lectura: " + error.message);
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
          // Guardar valores numéricos validados
          masa_kg_h: Number(datosConfirmados.metadatosAdicionales.masa_kg_h),
          temperatura_c: Number(datosConfirmados.metadatosAdicionales.temperatura_c),
          densidad_kg_l: Number(datosConfirmados.metadatosAdicionales.densidad_kg_l),
          usuario_registro: 'Operador Refinería'
        }]);

      if (error) throw error;
      alert("✅ Registro guardado con éxito.");
      router.push('/dashboard'); 
    } catch (error: any) {
      alert("Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-800">
        <div className="bg-blue-700 p-6 text-white text-center border-b-4 border-blue-900">
          <h1 className="text-xl font-black italic uppercase tracking-tighter">Refinería - Ingreso ACP</h1>
        </div>

        <div className="p-5 space-y-5">
          <div className="text-center">
            {fotoUrl ? (
              <div className="relative">
                <img src={fotoUrl} className="w-full h-48 object-cover rounded-xl border-2 border-blue-500" alt="Captura" />
                <button 
                  onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 text-[10px] font-bold"
                >
                  REPETIR
                </button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full h-40 border-4 border-dashed border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-500"
              >
                <span className="text-4xl mb-2">📸</span>
                <span className="text-xs font-black uppercase tracking-widest">
                  {loading ? 'Escaneando flujómetro...' : 'Capturar Pantalla'}
                </span>
              </button>
            )}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleCapture} 
            />
          </div>

          {/* PANEL VISUAL TIPO FLUJÓMETRO */}
          {datosConfirmados && (
            <div className="bg-[#0a0a0a] p-5 rounded-xl border-2 border-gray-700 font-mono text-green-500 shadow-inner">
              <div className="flex justify-between items-end border-b border-green-900/30 pb-2 mb-3">
                <span className="text-sm font-bold italic">ṁ</span>
                <span className="text-xl">
                  {datosConfirmados.metadatosAdicionales.masa_kg_h.toFixed(3)}
                  <span className="text-[10px] ml-1">kg/h</span>
                </span>
              </div>

              <div className="py-4 flex justify-between items-start">
                <span className="text-sm font-bold italic">Σ1</span>
                <span className="text-5xl font-black tracking-tighter text-green-400">
                  {datosConfirmados.valorPrincipal.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-green-900/30 pt-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-green-800 font-bold uppercase tracking-tighter">🌡 Temp</span>
                  <span className="text-lg">
                    {datosConfirmados.metadatosAdicionales.temperatura_c.toFixed(2)}
                    <span className="text-xs">°C</span>
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-green-800 font-bold uppercase tracking-tighter">ρ Dens</span>
                  <span className="text-lg">
                    {datosConfirmados.metadatosAdicionales.densidad_kg_l.toFixed(4)}
                    <span className="text-[10px] ml-1 font-sans">kg/l</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          <textarea 
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-gray-800 rounded-xl p-3 text-white text-xs border-none outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="Observaciones de la carga..."
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !datosConfirmados}
            className={`w-full py-4 rounded-xl font-black text-white transition-all ${loading || !datosConfirmados ? 'bg-gray-700' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'}`}
          >
            {loading ? 'PROCESANDO...' : 'CONFIRMAR Y GUARDAR'}
          </button>
        </div>
      </div>
    </div>
  );
}