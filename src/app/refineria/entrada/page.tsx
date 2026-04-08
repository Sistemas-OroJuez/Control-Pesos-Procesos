'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface DatosFlujometro {
  valorPrincipal: number;
  metadatosAdicionales: {
    masa_kg_h: number;
    temperatura_c: number;
    densidad_kg_l: number;
  };
  debug?: string;
  version_test?: string;
  error?: string;
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

      if (uploadError) throw new Error("Error al subir la imagen a Supabase.");

      const { data: urlData } = supabase.storage
        .from('refineria_assets')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      setFotoUrl(publicUrl);
      
      const ocrResponse = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotoUrl: publicUrl }),
      });

      const datosLeidos: DatosFlujometro = await ocrResponse.json();

      if (!ocrResponse.ok) {
        throw new Error(
          `❌ ERROR MOTOR OCR\n` +
          `Mensaje: ${datosLeidos.error || 'Fallo desconocido'}\n` +
          `Debug: ${datosLeidos.debug || 'Sin detalles'}\n` +
          `Versión: ${datosLeidos.version_test || 'ANTIGUA'}`
        );
      }
      
      if (!datosLeidos.valorPrincipal || datosLeidos.valorPrincipal === 0) {
        throw new Error("No se pudo extraer la sumatoria. Intente una foto más nítida.");
      }

      setDatosConfirmados(datosLeidos);
      
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
          metadata: {
            ...datosConfirmados.metadatosAdicionales
          }, 
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border">
        <div className="bg-blue-600 p-8 text-white text-center">
          <h1 className="text-2xl font-black uppercase italic">Ingreso ACP</h1>
          {/* Nuevo texto solicitado */}
          <p className="text-sm font-bold mt-1 text-blue-100">Lectura de Flujómetro</p>
          <p className="text-[10px] font-bold opacity-70 tracking-[0.3em] mt-2">LECTURA AUTOMÁTICA OCR</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            {fotoUrl ? (
              <div className="relative">
                <img src={fotoUrl} className="w-full h-56 object-contain rounded-2xl bg-black" alt="Captura" />
                {!loading && (
                  <button 
                    onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }}
                    className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-3 shadow-xl font-bold text-xs"
                  >
                    REPETIR
                  </button>
                )}
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full h-48 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center text-gray-400"
              >
                <span className="text-5xl mb-2">📸</span>
                <span className="font-bold text-xs uppercase tracking-widest">
                  {loading ? 'Procesando lectura...' : 'Capturar Flujómetro'}
                </span>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          {datosConfirmados && (
            <div className="bg-gray-900 text-green-400 p-6 rounded-2xl font-mono shadow-2xl border-4 border-gray-800 animate-pulse-slow">
              <p className="text-[9px] text-gray-500 mb-1 uppercase tracking-widest font-sans">Sumatoria (∑1) detectada:</p>
              <p className="text-4xl font-bold mb-4">{datosConfirmados.valorPrincipal.toLocaleString()}</p>
              
              <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-gray-700 pt-4">
                <div>
                  <p className="text-gray-500 uppercase">Masa (ṁ)</p>
                  <p className="text-white text-sm">{datosConfirmados.metadatosAdicionales.masa_kg_h} kg/h</p>
                </div>
                <div>
                  <p className="text-gray-500 uppercase">Temp (🌡)</p>
                  <p className="text-white text-sm">{datosConfirmados.metadatosAdicionales.temperatura_c} °C</p>
                </div>
              </div>
            </div>
          )}

          <textarea 
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-gray-50 rounded-xl p-4 text-xs border outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Observaciones opcionales..."
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !datosConfirmados}
            className={`w-full py-5 rounded-2xl font-black text-white transition-all ${loading || !datosConfirmados ? 'bg-gray-300' : 'bg-blue-600 shadow-blue-200 shadow-2xl active:scale-95'}`}
          >
            {loading ? 'ESPERE...' : 'CONFIRMAR Y SUBIR'}
          </button>
        </div>
      </div>
    </div>
  );
}