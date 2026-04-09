'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'refineria_assets'; 
const IA_ENDPOINT = "https://orojuezsa-lector-ocr-industrial.hf.space/upload";

export default function LectorIndustrial() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recuperar estado al recargar
  useEffect(() => {
    const savedTicket = localStorage.getItem('last_ticket_id');
    const savedFoto = localStorage.getItem('last_foto_url');
    if (savedTicket) { setTicketId(savedTicket); setLoading(true); }
    if (savedFoto) setFotoUrl(savedFoto);
  }, []);

  // Escuchar respuesta de la IA en tiempo real
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`seguimiento-${ticketId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', schema: 'public', table: 'lecturas_ia', filter: `id=eq.${ticketId}` 
      }, (payload) => {
          if (payload.new.status === 'completado') {
            setDatos({
              tag: payload.new.tag_id,
              totalizador: payload.new.totalizador,
              masa: payload.new.masa,
              temp: payload.new.temperatura,
              dens: payload.new.densidad
            });
            setLoading(false);
            setTicketId(null);
            localStorage.removeItem('last_ticket_id');
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      const fileName = `${Date.now()}.jpg`; 
      const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      setFotoUrl(publicUrl);
      localStorage.setItem('last_foto_url', publicUrl);

      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(IA_ENDPOINT, { method: "POST", body: formData });
      const iaData = await res.json();
      
      setTicketId(iaData.ticket_id);
      localStorage.setItem('last_ticket_id', iaData.ticket_id);

    } catch (err: any) {
      alert("Error: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="flex justify-between items-center py-4 border-b border-white/10">
          <button onClick={() => window.location.href='/dashboard_principal'} className="text-zinc-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2.5"/></svg>
          </button>
          <h1 className="text-blue-500 font-bold text-[10px] tracking-widest">INGRESO ACP</h1>
          <div className="w-10"></div>
        </header>

        {!datos ? (
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20">
            
            {/* Solo mostramos el Link, no la imagen pesada */}
            {fotoUrl && (
              <a href={fotoUrl} target="_blank" className="mb-8 bg-blue-600/20 text-blue-400 border border-blue-600/30 px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 animate-pulse">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth="2"/></svg>
                VER EVIDENCIA SUBIDA
              </a>
            )}

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !!ticketId} 
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all ${
                ticketId ? 'bg-zinc-900' : 'bg-blue-600 shadow-2xl shadow-blue-900/40'
              }`}
            >
              {ticketId ? (
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2"/></svg>
              )}
            </button>
            
            <p className="mt-10 text-zinc-500 text-[11px] font-black text-center leading-relaxed">
              {ticketId ? "LA IA ESTÁ ANALIZANDO LOS DATOS...\nESTA PANTALLA SE ACTUALIZARÁ SOLA." : "TOME UNA FOTO DEL MEDIDOR"}
            </p>

            {ticketId && (
               <button onClick={() => {setTicketId(null); setFotoUrl(null); localStorage.clear();}} className="mt-8 text-red-500 text-[10px] font-black border border-red-500/20 px-8 py-3 rounded-full">
                 CANCELAR PROCESO
               </button>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-8 shadow-2xl">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
              <span className="text-[10px] text-zinc-500 font-black">TAG: {datos.tag}</span>
              <a href={fotoUrl || '#'} target="_blank" className="text-blue-500 text-[10px] font-black underline">LINK EVIDENCIA</a>
            </div>

            <div className="text-center py-6">
              <p className="text-[12px] text-zinc-500 font-bold mb-2 tracking-widest">TOTALIZADOR</p>
              <p className="text-8xl font-black text-green-500 tracking-tighter">{datos.totalizador}</p>
            </div>

            <button onClick={() => {setDatos(null); setFotoUrl(null);}} className="w-full py-6 bg-blue-600 rounded-3xl font-black text-sm tracking-widest active:scale-95 transition-all">
              FINALIZAR REGISTRO
            </button>
          </div>
        )}

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}