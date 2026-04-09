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

  useEffect(() => {
    const savedTicket = localStorage.getItem('last_ticket_id');
    const savedFoto = localStorage.getItem('last_foto_url');
    if (savedTicket) { setTicketId(savedTicket); setLoading(true); }
    if (savedFoto) setFotoUrl(savedFoto);
  }, []);

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
      // 1. NOMBRE DE ARCHIVO (Sin carpetas extrañas para evitar bloqueos de políticas)
      const fileName = `${Date.now()}.jpg`; 
      const filePath = fileName; // Lo subimos a la raíz del bucket para probar

      // 2. SUBIDA
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file);

      if (uploadError) throw new Error(`Error Supabase: ${uploadError.message}`);

      // 3. GENERAR URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
      
      setFotoUrl(publicUrl);
      localStorage.setItem('last_foto_url', publicUrl);

      // 4. ENVIAR A IA
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(IA_ENDPOINT, { method: "POST", body: formData });
      const iaData = await res.json();
      
      setTicketId(iaData.ticket_id);
      localStorage.setItem('last_ticket_id', iaData.ticket_id);

    } catch (err: any) {
      alert("ERROR: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase tracking-tight">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="flex justify-between items-center py-4 border-b border-white/10">
          <button onClick={() => window.location.href='/dashboard_principal'} className="text-zinc-500 p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2.5" strokeLinecap="round"/></svg>
          </button>
          <h1 className="text-blue-500 font-bold text-[10px] tracking-widest text-center w-full">REFINERÍA OROJUEZ</h1>
        </header>

        {!datos ? (
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-8 bg-zinc-900/20">
            
            {fotoUrl && (
              <div className="mb-8 text-center animate-in fade-in duration-500">
                <img src={fotoUrl} className="w-40 h-40 object-cover rounded-3xl border-2 border-blue-600/40" alt="Preview" />
                <a href={fotoUrl} target="_blank" className="mt-4 inline-flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-full text-[9px] font-black shadow-lg">
                   VER FOTO EN CLOUD
                </a>
              </div>
            )}

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !!ticketId} 
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                (loading || ticketId) ? 'bg-zinc-800' : 'bg-blue-600 shadow-xl shadow-blue-900/40 active:scale-95'
              }`}
            >
              {ticketId ? (
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2"/></svg>
              )}
            </button>
            
            <p className="mt-8 text-zinc-500 text-[10px] font-black text-center leading-relaxed">
              {ticketId ? "LA IA ESTÁ ANALIZANDO LOS DATOS...\nEL PROCESO SEGUIRÁ AUNQUE SALGAS." : "CAPTURE LECTURA"}
            </p>

            {ticketId && (
               <button onClick={() => {setTicketId(null); setFotoUrl(null); localStorage.clear();}} className="mt-6 text-red-500 text-[9px] font-black border border-red-500/20 px-6 py-2 rounded-full">
                 CANCELAR Y NUEVA FOTO
               </button>
            )}
          </div>
        ) : (
          /* RESULTADOS */
          <div className="bg-zinc-900 rounded-[40px] p-6 border border-white/5 space-y-6">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
              <span className="text-[10px] text-zinc-500 font-black">TAG: {datos.tag}</span>
              <a href={fotoUrl || '#'} target="_blank" className="text-blue-500 text-[9px] font-black underline">FOTO ORIGINAL</a>
            </div>
            <div className="text-center py-4 border-y border-white/5">
              <p className="text-[10px] text-zinc-500 font-bold mb-2">TOTALIZADOR</p>
              <p className="text-7xl font-black text-green-500 tracking-tighter tabular-nums">{datos.totalizador}</p>
            </div>
            <button onClick={() => {setDatos(null); setFotoUrl(null);}} className="w-full py-5 bg-blue-600 rounded-3xl font-black text-xs tracking-[0.2em]">
              CONFIRMAR REGISTRO
            </button>
          </div>
        )}

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}