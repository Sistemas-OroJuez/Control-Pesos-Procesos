'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'refineria_assets'; 
const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";
const OCR_API_KEY = 'K82540315988957'; 

export default function IngresoACP() {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const [observaciones, setObservaciones] = useState('');
  const [variedad, setVariedad] = useState('ALTO OLEICO');
  const [esReproceso, setEsReproceso] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // PERSISTENCIA
  useEffect(() => {
    const backup = localStorage.getItem('backup_ingreso_acp');
    if (backup) {
      const p = JSON.parse(backup);
      if (p.datos) {
        setDatos(p.datos);
        setFotoUrl(p.fotoUrl);
        setVariedad(p.variedad || 'ALTO OLEICO');
        setEsReproceso(p.esReproceso || false);
        setObservaciones(p.observaciones || '');
      }
    }
  }, []);

  useEffect(() => {
    if (datos || fotoUrl) {
      localStorage.setItem('backup_ingreso_acp', JSON.stringify({
        datos, fotoUrl, variedad, esReproceso, observaciones
      }));
    }
  }, [datos, fotoUrl, variedad, esReproceso, observaciones]);

  const resetTodo = () => {
    localStorage.removeItem('backup_ingreso_acp'); 
    setLoading(false);
    setDatos(null);
    setFotoUrl(null);
    setObservaciones('');
    setStatusText('');
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000; 
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => resolve(blob as Blob), 'image/jpeg', 0.8);
        };
      };
    });
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusText('Optimizando Imagen...');

    try {
      const blob = await compressImage(file);
      setStatusText('Subiendo Archivo...');
      const fileName = `ingreso_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET_NAME).upload(fileName, blob);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      setFotoUrl(publicUrl);

      setStatusText('Analizando con IA...');
      const formData = new FormData();
      formData.append('apikey', OCR_API_KEY);
      formData.append('url', publicUrl);
      formData.append('language', 'eng');
      formData.append('OCREngine', '2'); 

      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      const textRaw = result.ParsedResults?.[0]?.ParsedText || "";

      // --- LÓGICA DE EXTRACCIÓN POR PATRONES (NO POR ORDEN) ---
      const bloques = textRaw.split(/\s+/) // Separar por cualquier espacio o salto de línea
        .map((b: string) => b.replace(/[^0-9.]/g, '')) // Limpiar basura
        .filter((b: string) => b.length >= 2); // Solo bloques que parezcan números

      let masa = "0";
      let totalizador = "0";
      let temperatura = "0";
      let densidad = "0.8936";

      // 1. Buscamos el Totalizador (Es el número más largo, usualmente > 6 dígitos)
      const sortedByLength = [...bloques].sort((a, b) => b.length - a.length);
      if (sortedByLength.length > 0) totalizador = sortedByLength[0];

      // 2. Buscamos la Densidad (Número que empieza con 0.8 o 0.9)
      const bloqueDensidad = bloques.find(b => b.startsWith('0.8') || b.startsWith('0.9'));
      if (bloqueDensidad) densidad = bloqueDensidad;

      // 3. Buscamos Masa y Temperatura entre lo que sobra
      const restantes = bloques.filter(b => b !== totalizador && b !== bloqueDensidad);
      
      restantes.forEach(num => {
        const n = parseFloat(num);
        // Si tiene 2 o 3 dígitos y es menor a 100, probablemente es temperatura
        if (num.length <= 4 && n > 10 && n < 100) {
          temperatura = num;
        } 
        // Si es un número grande con decimales, es la masa
        else if (num.length >= 4) {
          masa = num;
        }
      });

      setDatos({
        masa_kg_h: masa,
        totalizador: totalizador,
        temperatura_c: temperatura,
        densidad_kg_l: densidad,
        status: 'completado'
      });

    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleConfirmarYGuardar = async () => {
    if (!datos || !fotoUrl) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('operaciones_refineria').insert([{
          tipo_operacion: 'INGRESO_ACP',
          valor_lectura: parseFloat(datos.totalizador), 
          masa_kg_h: parseFloat(datos.masa_kg_h),
          temperatura_c: parseFloat(datos.temperatura_c),
          densidad_kg_l: parseFloat(datos.densidad_kg_l),
          foto_url: fotoUrl,
          observaciones: observaciones,
          usuario_registro: 'Operador Entrada',
          variedad: variedad,
          es_reproceso: esReproceso
      }]);
      if (error) throw error;
      alert("✅ REGISTRO EXITOSO");
      resetTodo(); 
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-zinc-900 border border-white/10 p-3 rounded-2xl">
            <span className="text-[10px] font-black text-zinc-400">VOLVER</span>
          </button>
          <h1 className="flex-1 text-blue-500 font-black text-[10px] tracking-[0.3em] text-center">REFINERÍA OROJUEZ</h1>
        </header>

        {/* ... Resto del componente visual (Selects, Botones de cámara, etc) ... */}
        {/* Mantengo la UI exacta que ya tienes para no romper el diseño */}
        
        <div className={`bg-zinc-900 p-6 rounded-[30px] border border-white/5 space-y-4 ${(datos || loading) ? 'opacity-40 pointer-events-none' : ''}`}>
           <select value={variedad} onChange={(e) => setVariedad(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xs font-bold text-white focus:outline-none">
              <option value="ALTO OLEICO">ALTO OLEICO</option>
              <option value="GUINENSIS">GUINENSIS</option>
            </select>
           <button onClick={() => setEsReproceso(!esReproceso)} className={`w-full p-4 rounded-2xl border flex justify-between items-center ${esReproceso ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-black'}`}>
             <span className="text-[10px] font-black tracking-widest">{esReproceso ? 'ES REPROCESO ✅' : 'PROCESO NORMAL'}</span>
             <div className={`w-4 h-4 rounded-full ${esReproceso ? 'bg-orange-500' : 'bg-zinc-800'}`}></div>
           </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center p-10 bg-zinc-900/40 rounded-[40px] border-2 border-blue-900/30">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-blue-500 font-black text-[11px] tracking-widest uppercase mb-4">{statusText}</p>
          </div>
        ) : !datos ? (
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20">
            <button onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl">
              <span className="text-4xl">📸</span>
            </button>
            <p className="mt-8 text-zinc-600 text-[11px] font-black tracking-widest uppercase">CAPTURAR INGRESO</p>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-6 animate-in zoom-in">
            <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-6">
                <div className="text-center p-3 bg-black/20 rounded-2xl border border-white/5">
                    <p className="text-[8px] text-zinc-500 font-bold tracking-widest">MASA (KG/H)</p>
                    <p className="text-xl font-black text-white">{datos.masa_kg_h}</p>
                </div>
                <div className="text-center p-3 bg-black/20 rounded-2xl border border-white/5">
                    <p className="text-[8px] text-zinc-500 font-bold tracking-widest">TEMP (°C)</p>
                    <p className="text-xl font-black text-white">{datos.temperatura_c}</p>
                </div>
                <div className="col-span-2 text-center py-4 bg-blue-500/5 rounded-3xl border border-blue-500/20">
                    <p className="text-[11px] text-blue-500 font-black tracking-[.2em]">TOTALIZADOR (Σ1)</p>
                    <p className="text-6xl font-black text-blue-400 tracking-tighter tabular-nums">{datos.totalizador}</p>
                </div>
                <div className="col-span-2 text-center p-2 bg-black/20 rounded-2xl border border-white/5">
                    <p className="text-[8px] text-zinc-500 font-bold tracking-widest">DENSIDAD (KG/L)</p>
                    <p className="text-lg font-black text-white">{datos.densidad_kg_l}</p>
                </div>
            </div>
            
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full bg-black/40 rounded-2xl p-4 text-[10px] text-white border border-white/5" placeholder="NOTAS ADICIONALES..." />
            
            <div className="grid grid-cols-2 gap-3">
                <button onClick={resetTodo} className="py-5 bg-zinc-800 rounded-2xl font-black text-[9px] text-red-400">REINTENTAR</button>
                <button onClick={handleConfirmarYGuardar} className="py-5 bg-blue-600 rounded-2xl font-black text-[9px]">CONFIRMAR</button>
            </div>
          </div>
        )}
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}