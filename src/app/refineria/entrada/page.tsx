'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'refineria_assets'; 
const IA_ENDPOINT = "https://orojuezsa-lector-ocr-industrial.hf.space/upload";
const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";

export default function LectorIndustrial() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. PERSISTENCIA
  useEffect(() => {
    const savedTicket = localStorage.getItem('last_ticket_id');
    const savedFoto = localStorage.getItem('last_foto_url');
    if (savedTicket) { setTicketId(savedTicket); setLoading(true); }
    if (savedFoto) setFotoUrl(savedFoto);
  }, []);

  // 2. REALTIME (Escuchar respuesta de Supabase)
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`seguimiento-${ticketId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', schema: 'public', table: 'lecturas_ia', filter: `id=eq.${ticketId}` 
      }, (payload) => {
          console.log("Cambio detectado:", payload.new);
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
            localStorage.clear();
          } else if (payload.new.status === 'error') {
            alert("La IA no pudo procesar esta foto. Intente con otra toma.");
            cancelarProceso();
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      // SUBIDA AL BUCKET
      const fileName = `${Date.now()}.jpg`; 
      const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      setFotoUrl(publicUrl);
      localStorage.setItem('last_foto_url', publicUrl);

      // LLAMADA A HUGGING FACE CON TIMEOUT DE SEGURIDAD
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minuto máximo

      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(IA_ENDPOINT, { 
        method: "POST", 
        body: formData,
        signal: controller.signal 
      });

      clearTimeout(timeoutId);
      const iaData = await res.json();
      
      if(iaData.ticket_id) {
        setTicketId(iaData.ticket_id);
        localStorage.setItem('last_ticket_id', iaData.ticket_id);
      } else {
        throw new Error("La IA no devolvió un Ticket ID");
      }

    } catch (err: any) {
      const msg = err.name === 'AbortError' ? "El servidor de IA tardó demasiado." : err.message;
      alert("ERROR: " + msg);
      setLoading(false);
    }
  };

  const cancelarProceso = () => {
    setTicketId(null);
    setFotoUrl(null);
    setLoading(false);
    localStorage.clear();
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase tracking-tight">
      <div className="max-w-md mx-auto">
        
        <header className="flex justify-between items-center py-6 border-b border-white/10">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="text-zinc-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2.5"/></svg>
          </button>
          <span className="text-blue-500 font-black text-[10px] tracking-widest">REFINERÍA OROJUEZ</span>
          <div className="w-10"></div>
        </header>

        {!datos ? (
          <div className="mt-10 flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/10">
            {fotoUrl && (
              <a href={fotoUrl} target="_blank" className="mb-8 text-blue-400 text-[9px] font-black underline underline-offset-4">
                FOTO EN CLOUD (OK)
              </a>
            )}

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !!ticketId} 
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                ticketId ? 'bg-zinc-800 animate-pulse' : 'bg-blue-600 shadow-2xl shadow-blue-900/40'
              }`}
            >
              {ticketId ? (
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2"/></svg>
              )}
            </button>
            
            <p className="mt-10 text-zinc-600 text-[10px] font-black text-center leading-relaxed">
              {ticketId ? "ESPERANDO DATOS DEL LECTOR...\nESTO TOMA DE 10 A 30 SEGUNDOS." : "PRESIONE PARA CAPTURAR"}
            </p>

            {ticketId && (
              <button onClick={cancelarProceso} className="mt-8 text-red-500 text-[9px] font-black border border-red-500/20 px-6 py-2 rounded-full">
                ANULAR Y REINTENTAR
              </button>
            )}
          </div>
        ) : (
          <div className="mt-10 bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-8 animate-in zoom-in duration-300">
            <div className="text-center">
              <p className="text-[10px] text-zinc-500 font-bold mb-2">TOTALIZADOR LEÍDO</p>
              <p className="text-7xl font-black text-green-500 tracking-tighter tabular-nums">{datos.totalizador}</p>
            </div>
            <button onClick={() => {setDatos(null); setFotoUrl(null);}} className="w-full py-6 bg-blue-600 rounded-3xl font-black text-xs tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all">
              REGISTRAR LECTURA
            </button>
          </div>
        )}

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}