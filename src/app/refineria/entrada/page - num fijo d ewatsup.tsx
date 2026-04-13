'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'refineria_assets'; 
const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";
const OCR_API_KEY = 'K82540315988957'; 
const JEFE_WHATSAPP = "593963864268"; // Reemplaza con el número real del jefe

export default function EntradaACP() {
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
    const backup = localStorage.getItem('backup_entrada_acp');
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
      localStorage.setItem('backup_entrada_acp', JSON.stringify({
        datos, fotoUrl, variedad, esReproceso, observaciones
      }));
    }
  }, [datos, fotoUrl, variedad, esReproceso, observaciones]);

  const resetTodo = () => {
    localStorage.removeItem('backup_entrada_acp'); 
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
          const MAX_WIDTH = 1200; 
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => resolve(blob as Blob), 'image/jpeg', 0.85);
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
      const fileName = `entrada_acp_${Date.now()}.jpg`;
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
      
      const lineas = textRaw.split('\n');
      let valorDetectado = "0";

      const lineaTotalizador = lineas.find((l: string) => 
        l.includes('Σ') || l.includes('E1') || l.includes('S1') || l.includes('M1')
      );

      if (lineaTotalizador) {
        valorDetectado = lineaTotalizador.replace(/[^0-9]/g, '');
      } else {
        const lineasNumericas = lineas
          .map((l: string) => l.replace(/[^0-9]/g, ''))
          .filter((l: string) => l.length >= 5);
        
        valorDetectado = lineasNumericas.length >= 2 ? lineasNumericas[1] : (lineasNumericas[0] || "0");
      }

      setDatos({
        totalizador: valorDetectado,
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
          tipo_operacion: 'ENTRADA_ACP',
          valor_lectura: parseFloat(datos.totalizador), 
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

  const handleWhatsApp = () => {
    if (!datos || !fotoUrl) return;
    const msg = `*REPORTE ENTRADA ACP*%0A` +
                `*Lectura:* ${datos.totalizador}%0A` +
                `*Proceso:* ${esReproceso ? 'REPROCESO' : 'NORMAL'}%0A` +
                `*Variedad:* ${variedad}%0A` +
                `*Foto:* ${fotoUrl}`;
    window.open(`https://wa.me/${JEFE_WHATSAPP}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-zinc-900 border border-white/10 p-3 rounded-2xl">
            <span className="text-[10px] font-black text-zinc-400">VOLVER</span>
          </button>
          <h1 className="flex-1 text-blue-500 font-black text-[10px] tracking-[0.3em] text-center">ENTRADA ACP OROJUEZ</h1>
        </header>

        <div className={`bg-zinc-900 p-6 rounded-[30px] border border-white/5 space-y-4 ${(datos || loading) ? 'opacity-40 pointer-events-none' : ''}`}>
           <select 
              value={variedad} 
              onChange={(e) => setVariedad(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xs font-bold text-white focus:outline-none"
            >
              <option value="ALTO OLEICO">ALTO OLEICO</option>
              <option value="GUINENSIS">GUINENSIS</option>
            </select>
           <button 
            onClick={() => setEsReproceso(!esReproceso)}
            className={`w-full p-4 rounded-2xl border flex justify-between items-center ${esReproceso ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-black'}`}
           >
             <span className="text-[10px] font-black tracking-widest">{esReproceso ? 'ES REPROCESO ✅' : 'PROCESO NORMAL'}</span>
             <div className={`w-4 h-4 rounded-full ${esReproceso ? 'bg-orange-500' : 'bg-zinc-800'}`}></div>
           </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center p-10 bg-zinc-900/40 rounded-[40px] border-2 border-blue-900/30">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-blue-500 font-black text-[11px] tracking-widest uppercase mb-4">{statusText}</p>
            {/* LINK SIEMPRE PRESENTE DURANTE CARGA */}
            {fotoUrl && (
              <a href={fotoUrl} target="_blank" className="text-[10px] bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full border border-blue-500/20 font-bold animate-pulse">
                🔗 VER CAPTURA SUBIDA
              </a>
            )}
          </div>
        ) : !datos ? (
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20">
            <button onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl">
              <span className="text-4xl">📸</span>
            </button>
            <p className="mt-8 text-zinc-600 text-[11px] font-black tracking-widest uppercase">CAPTURAR ENTRADA ACP</p>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-6 animate-in zoom-in">
            <div className="text-center py-4 border-b border-white/5">
                <p className="text-[11px] text-zinc-500 font-black tracking-[.2em]">TOTALIZADOR (Σ1)</p>
                <input 
                  type="text"
                  value={datos.totalizador}
                  onChange={(e) => setDatos({...datos, totalizador: e.target.value.replace(/[^0-9]/g, '')})}
                  className="w-full bg-transparent text-6xl font-black text-blue-400 tracking-tighter tabular-nums text-center focus:outline-none"
                />
                <a href={fotoUrl!} target="_blank" className="text-[10px] text-blue-500 underline block mt-4 font-black tracking-widest uppercase">REVISAR FOTO ORIGINAL</a>
            </div>
            
            <textarea 
              value={observaciones} 
              onChange={(e) => setObservaciones(e.target.value)} 
              className="w-full bg-black/40 rounded-2xl p-4 text-[10px] text-white border border-white/5" 
              placeholder="NOTAS ADICIONALES..." 
            />

            <button onClick={handleWhatsApp} className="w-full py-4 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-3">
              <span className="text-lg">💬</span>
              <span className="text-[10px] font-black text-emerald-400">NOTIFICAR A JEFE</span>
            </button>
            
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