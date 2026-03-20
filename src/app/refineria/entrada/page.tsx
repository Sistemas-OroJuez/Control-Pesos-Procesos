'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Definición de tipos para los datos leídos del flujómetro
interface DatosFlujometro {
  valorPrincipal: number; // Mapeado a ∑1
  metadatosAdicionales: {
    masa_kg_h: number;   // Mapeado a ṁ
    temperatura_c: number; // Mapeado a 🌡1
    densidad_kg_l: number; // Mapeado a ρ
  };
}

export default function IngresoACP() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  
  // Estado para los datos leídos por el OCR y mostrados para confirmación
  const [datosConfirmados, setDatosConfirmados] = useState<DatosFlujometro | null>(null);
  const [observaciones, setObservaciones] = useState('');

  // 1. Captura de Foto y llamada al OCR
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setDatosConfirmados(null); // Reiniciamos datos previos si los hay

    try {
      // Usamos un nombre de archivo limpio y único
      const fileName = `${Date.now()}_ingreso_acp.jpg`;
      
      // A. Subida al bucket exclusivo (Con las políticas de RLS que definimos en Supabase)
      const { error: uploadError } = await supabase.storage
        .from('refineria_assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw new Error(`Error de subida: ${uploadError.message}`);

      // B. Obtener URL pública (Texto corto para la DB)
      const { data: urlData } = supabase.storage
        .from('refineria_assets')
        .getPublicUrl(fileName);

      const publicFotoUrl = urlData.publicUrl;
      setFotoUrl(publicFotoUrl);
      
      // C. Llamada al motor de OCR Multi-valor (A través de nuestro Backend seguro)
      const ocrResponse = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotoUrl: publicFotoUrl }),
      });

      if (!ocrResponse.ok) throw new Error('Error al conectar con el motor de OCR');

      const datosLeidos: DatosFlujometro = await ocrResponse.json();
      
      // D. Mostramos los datos al operador para confirmación
      setDatosConfirmados(datosLeidos);
      alert("Valores del flujómetro detectados. Por favor verifique y confirme.");
      
    } catch (error: any) {
      console.error(error);
      alert(`Error en el proceso: ${error.message}`);
      setFotoUrl(null); // Reiniciamos si hay error
    } finally {
      setLoading(false);
    }
  };

  // 2. Guardar el registro final estructurado
  const handleGuardar = async () => {
    if (!fotoUrl || !datosConfirmados) {
      alert("Es necesario tomar la foto y verificar los datos.");
      return;
    }

    setLoading(true);
    try {
      // Guardado Estructurado en la tabla operações_refineria que definimos en Supabase
      const { error } = await supabase
        .from('operaciones_refineria')
        .insert([{
          tipo_operacion: 'INGRESO_ACP',
          
          // Campo Principal para Balance de Masa (Mapeado a ∑1 Sumatoria kg)
          valor_lectura: datosConfirmados.valorPrincipal, 
          
          // Enlace a la evidencia visual (Link de pocos bytes)
          foto_url: fotoUrl,
          
          observaciones: observaciones,
          
          // Metadatos para Cálculos Posteriores (ṁ, 🌡, ρ en formato JSON)
          metadata: datosConfirmados.metadatosAdicionales, 
          
          usuario_registro: 'Operador Refinería' // Esto puede venir de un estado global después
        }]);

      if (error) throw error;

      alert("Ingreso ACP registrado y datos estructurados guardados con éxito.");
      router.push('/dashboard'); 
    } catch (error: any) {
      console.error(error);
      alert("Error al guardar en base de datos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-blue-600 p-8 text-white text-center">
          <span className="text-6xl mb-2 block">🔵</span>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Ingreso ACP</h1>
          <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Lectura de Flujómetro EH</p>
        </div>

        <div className="p-6 space-y-6">
          {/* A. SECCIÓN DE FOTO Y PREVIEW */}
          <div className="text-center">
            {fotoUrl ? (
              <div className="relative inline-block w-full">
                <img src={fotoUrl} alt="Preview" className="w-full h-56 object-contain rounded-2xl border-4 border-blue-50 bg-gray-100" />
                <button 
                  onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }}
                  className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-3 text-xs font-bold shadow-lg"
                  disabled={loading}
                >
                  CAMBIAR
                </button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full h-48 border-4 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all shadow-inner"
              >
                <span className="text-5xl mb-2">📸</span>
                <span className="font-bold uppercase text-xs tracking-widest text-center px-4">
                  {loading ? 'Subiendo y Leyendo OCR...' : 'Tomar Foto del Flujómetro'}
                </span>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          {/* B. CONFIRMACIÓN OPERADOR (Solo aparece tras el OCR) */}
          {datosConfirmados && (
            <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200 space-y-4 shadow-inner">
              <h2 className="text-xs font-black text-blue-900 uppercase tracking-widest text-center">Verificación de Lectura (OCR)</h2>
              
              {/* CAMPO PRINCIPAL: SUMATORIA (∑1) */}
              <div className="text-center border-b-2 border-blue-100 pb-4">
                <label className="block text-[10px] font-black text-blue-700 uppercase tracking-[0.2em]">Suma Total (∑1) <span className="font-bold text-lg text-blue-900">* kg *</span></label>
                <p className="text-5xl font-mono font-bold text-blue-900 tracking-tighter">{datosConfirmados.valorPrincipal.toLocaleString('de-DE')}</p>
              </div>

              {/* CAMPOS ADICIONALES (metadata para cálculos) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-3 text-center border">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest">Masa (ṁ) <span className="text-gray-900">kg/h</span></label>
                  <p className="font-mono text-xl text-gray-900 font-bold">{datosConfirmados.metadatosAdicionales.masa_kg_h.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center border">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest">Temperatura (🌡1) <span className="text-gray-900">°C</span></label>
                  <p className="font-mono text-xl text-gray-900 font-bold">{datosConfirmados.metadatosAdicionales.temperatura_c.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center border">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest">Densidad (ρ) <span className="text-gray-900">kg/l</span></label>
                  <p className="font-mono text-xl text-gray-900 font-bold">{datosConfirmados.metadatosAdicionales.densidad_kg_l.toFixed(4)}</p>
                </div>
              </div>
              <p className="text-[10px] text-blue-600 font-bold text-center pt-2">Si los valores son incorrectos, por favor cambie la foto.</p>
            </div>
          )}

          {/* C. OBSERVACIONES */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Observaciones</label>
            <textarea 
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-100 h-24 border border-gray-100"
              placeholder="Notas adicionales..."
              disabled={loading}
            />
          </div>

          {/* D. BOTÓN GUARDAR (Solo si hay OCR confirmado) */}
          <button 
            onClick={handleGuardar}
            disabled={loading || !fotoUrl || !datosConfirmados}
            className={`w-full py-5 rounded-2xl font-black text-white shadow-2xl transition-all ${loading || !fotoUrl || !datosConfirmados ? 'bg-gray-300' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
          >
            {loading ? 'PROCESANDO...' : 'CONFIRMAR Y GUARDAR INGRESO'}
          </button>
          
          <button onClick={() => router.back()} className="w-full text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]" disabled={loading}>
            Cancelar y Volver
          </button>
        </div>
      </div>
    </div>
  );
}