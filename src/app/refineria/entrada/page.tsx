'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'refineria_assets'; 
const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";
const OCR_API_KEY = 'K82540315988957'; 

export default function EntradaACP() {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const [observaciones, setObservaciones] = useState('');
  const [variedad, setVariedad] = useState('ALTO OLEICO');
  const [esReproceso, setEsReproceso] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      localStorage.setItem('backup_entrada_acp', JSON.stringify({ datos, fotoUrl, variedad, esReproceso, observaciones }));
    }
  }, [datos, fotoUrl, variedad, esReproceso, observaciones]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusText('SUBIENDO EVIDENCIA...');
    const fileName = `entrada_acp_${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);

    if (uploadError) {
      alert("Error subiendo imagen");
      setLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    setFotoUrl(publicUrl);

    setStatusText('PROCESANDO LECTURA (OCR)...');
    const formData = new FormData();
    formData.append('apikey', OCR_API_KEY);
    formData.append('url', publicUrl);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');

    try {
      const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: formData });
      const ocrData = await res.json();
      const text = ocrData.ParsedResults?.[0]?.ParsedText || '';
      const numbers = text.match(/\d+/g);
      const biggestNumber = numbers ? Math.max(...numbers.map(Number)) : 0;

      setDatos({ valor_lectura: biggestNumber });
      setStatusText('LECTURA COMPLETADA');
    } catch (err) {
      console.error(err);
      setDatos({ valor_lectura: 0 });
      setStatusText('ERROR EN OCR, INGRESA MANUALMENTE');
    } finally {
      setLoading(false);
    }
  };

  // --- NUEVA FUNCIÓN UNIFICADA: GUARDA Y LUEGO ABRE WHATSAPP ---
  const handleConfirmarYEnviarWhatsApp = async () => {
    if (!datos?.valor_lectura) {
        alert("No hay datos para guardar.");
        return;
    }

    setLoading(true);
    setStatusText('GUARDANDO Y GENERANDO REPORTE...');

    try {
        // 1. GUARDAR EN SUPABASE
        const { error } = await supabase.from('operaciones_refineria').insert([{
            tipo_operacion: 'ENTRADA_ACP',
            valor_lectura: parseFloat(datos.valor_lectura),
            foto_url: fotoUrl,
            observaciones: observaciones,
            variedad: variedad,
            es_reproceso: esReproceso,
            usuario_registro: 'Operador Entrada'
        }]);

        if (error) throw error;

        // 2. SI GUARDÓ BIEN, PREPARAR Y ABRIR WHATSAPP
        const mensaje = `*REPORTES REFINERÍA - ENTRADA ACP*%0A` +
                        `*VARIEDAD:* ${variedad}%0A` +
                        `*PROCESO:* ${esReproceso ? 'REPROCESO' : 'NORMAL'}%0A` +
                        `*VALOR REGISTRADO:* ${Number(datos.valor_lectura).toLocaleString()} KG%0A` +
                        `*NOTAS:* ${observaciones || 'Sin observaciones'}%0A%0A` +
                        `*EVIDENCIA:* ${fotoUrl}%0A%0A` +
                        `✅ _REGISTRO CONFIRMADO EN EL SISTEMA_`;

        window.open(`https://wa.me/?text=${mensaje}`, '_blank');

        // 3. LIMPIAR TODO TRAS EL ÉXITO
        resetTodo();
        alert("Registro guardado y reporte enviado.");

    } catch (err: any) {
        alert("Error al procesar: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  const resetTodo = () => {
    setDatos(null);
    setFotoUrl(null);
    setObservaciones('');
    localStorage.removeItem('backup_entrada_acp');
    setStatusText('');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans tracking-tighter uppercase">
      
      {!datos && !loading && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/10 rounded-[40px] bg-zinc-900/50"
             onClick={() => fileInputRef.current?.click()}>
          <span className="text-5xl mb-4">📸</span>
          <p className="text-[10px] font-black tracking-[0.3em] text-zinc-500">CAPTURAR ENTRADA ACP</p>
          <input type="file" ref={fileInputRef} onChange={handleCapture} accept="image/*" capture="environment" className="hidden" />
        </div>
      )}

      {loading && (
        <div className="py-20 text-center animate-pulse">
          <p className="text-[10px] font-black tracking-[0.4em] text-orange-500">{statusText}</p>
        </div>
      )}

      {datos && !loading && (
        <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-zinc-900 border border-white/10 rounded-[35px] p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                <label className="text-[8px] font-black text-zinc-600 tracking-widest block mb-4">LECTURA DETECTADA (KG)</label>
                <input 
                  type="number" 
                  value={datos.valor_lectura} 
                  onChange={(e) => setDatos({...datos, valor_lectura: e.target.value})}
                  className="bg-transparent text-6xl font-black text-white w-full text-center tabular-nums focus:outline-none"
                />
                <a href={fotoUrl!} target="_blank" className="text-[10px] text-blue-500 underline block mt-4 font-black tracking-widest uppercase">REVISAR FOTO ORIGINAL</a>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-900 p-4 rounded-3xl border border-white/5">
                    <label className="text-[7px] font-bold text-zinc-500 block mb-2">VARIEDAD</label>
                    <select value={variedad} onChange={(e)=>setVariedad(e.target.value)} className="bg-transparent w-full font-black text-[10px]">
                        <option value="ALTO OLEICO">ALTO OLEICO</option>
                        <option value="GUINENSIS">GUINENSIS</option>
                    </select>
                </div>
                <div className="bg-zinc-900 p-4 rounded-3xl border border-white/5 flex items-center justify-between">
                    <label className="text-[7px] font-bold text-zinc-500 uppercase">¿REPROCESO?</label>
                    <input type="checkbox" checked={esReproceso} onChange={(e)=>setEsReproceso(e.target.checked)} className="w-5 h-5 accent-orange-500" />
                </div>
            </div>
            
            <textarea 
              value={observaciones} 
              onChange={(e) => setObservaciones(e.target.value)} 
              className="w-full bg-zinc-900 rounded-[25px] p-6 text-[10px] text-white border border-white/5 focus:border-orange-500/50 outline-none transition-all" 
              placeholder="NOTAS ADICIONALES (OPCIONAL)..." 
              rows={3}
            />

            {/* BOTÓN PRINCIPAL ACTUALIZADO */}
            <button 
              onClick={handleConfirmarYEnviarWhatsApp} 
              className="w-full py-6 bg-emerald-600 rounded-[30px] flex flex-col items-center justify-center gap-1 shadow-xl shadow-emerald-900/20 active:scale-95 transition-all"
            >
              <span className="text-[10px] font-black text-white tracking-widest">CONFIRMAR Y ENVIAR WHATSAPP</span>
              <span className="text-[8px] text-emerald-200 font-bold opacity-70">SE GUARDARÁ AUTOMÁTICAMENTE</span>
            </button>
            
            <button onClick={resetTodo} className="w-full py-4 text-[9px] font-black text-zinc-600 tracking-[0.2em]">DESCARTAR Y REPETIR</button>
        </div>
      )}
    </div>
  );
}