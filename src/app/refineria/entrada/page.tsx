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

  // FUNCIÓN ORIGINAL DE GUARDADO (Se mantiene igual)
  const handleConfirmarYGuardar = async () => {
    if (!datos?.valor_lectura) return;
    setLoading(true);
    setStatusText('GUARDANDO EN BASE DE DATOS...');
    
    const { error } = await supabase.from('operaciones_refineria').insert([{
        tipo_operacion: 'ENTRADA_ACP',
        valor_lectura: parseFloat(datos.valor_lectura),
        foto_url: fotoUrl,
        observaciones: observaciones,
        variedad: variedad,
        es_reproceso: esReproceso,
        usuario_registro: 'Operador Entrada'
    }]);

    if (error) {
        alert("Error al guardar");
        setLoading(false);
    } else {
        resetTodo();
        alert("Guardado exitosamente");
        setLoading(false);
    }
  };

  // --- FUNCIÓN DE WHATSAPP ACTUALIZADA CON GUARDADO AUTOMÁTICO ---
  const handleWhatsApp = async () => {
    if (!datos?.valor_lectura) return;
    
    // Primero guardamos la información
    setLoading(true);
    setStatusText('GUARDANDO Y PREPARANDO WHATSAPP...');

    const { error } = await supabase.from('operaciones_refineria').insert([{
        tipo_operacion: 'ENTRADA_ACP',
        valor_lectura: parseFloat(datos.valor_lectura),
        foto_url: fotoUrl,
        observaciones: observaciones,
        variedad: variedad,
        es_reproceso: esReproceso,
        usuario_registro: 'Operador Entrada'
    }]);

    if (error) {
        alert("Error al guardar antes de enviar: " + error.message);
        setLoading(false);
        return;
    }

    // Si guardó correctamente, procedemos a enviar el mensaje
    const mensaje = `*REPORTES REFINERÍA - ENTRADA ACP*%0A` +
                    `*VARIEDAD:* ${variedad}%0A` +
                    `*PROCESO:* ${esReproceso ? 'REPROCESO' : 'NORMAL'}%0A` +
                    `*VALOR REGISTRADO:* ${Number(datos.valor_lectura).toLocaleString()} KG%0A` +
                    `*NOTAS:* ${observaciones || 'Sin observaciones'}%0A%0A` +
                    `*EVIDENCIA:* ${fotoUrl}%0A%0A` +
                    `✅ _REGISTRO GUARDADO Y CONFIRMADO_`;

    window.open(`https://wa.me/?text=${mensaje}`, '_blank');
    
    resetTodo();
    setLoading(false);
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
              className="w-full bg-black/40 rounded-2xl p-4 text-[10px] text-white border border-white/5" 
              placeholder="NOTAS ADICIONALES..." 
            />

            {/* BOTÓN WHATSAPP CON GUARDADO AUTOMÁTICO */}
            <button onClick={handleWhatsApp} className="w-full py-4 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-3">
              <span className="text-lg">💬</span>
              <span className="text-[10px] font-black text-emerald-400">ENVIAR REPORTE Y GUARDAR</span>
            </button>
            
            <div className="grid grid-cols-2 gap-3">
                <button onClick={resetTodo} className="py-5 bg-zinc-800 rounded-2xl font-black text-[9px] text-red-400">REINTENTAR</button>
                <button onClick={handleConfirmarYGuardar} className="py-5 bg-blue-600 rounded-2xl font-black text-[9px]">CONFIRMAR Y GUARDAR</button>
            </div>
        </div>
      )}
    </div>
  );
}