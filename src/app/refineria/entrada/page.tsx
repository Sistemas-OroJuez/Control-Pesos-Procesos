'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LectorIndustrial() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Recuperar estado si se refresca la página
  useEffect(() => {
    const savedTicket = localStorage.getItem('last_ticket_id');
    const savedFoto = localStorage.getItem('last_foto_url');
    if (savedTicket) { setTicketId(savedTicket); setLoading(true); }
    if (savedFoto) setFotoUrl(savedFoto);
  }, []);

  // 2. Radar Realtime para detectar cuando la IA termine
  useEffect(() => {
    if (!ticketId) return;
    localStorage.setItem('last_ticket_id', ticketId);

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
            localStorage.removeItem('last_foto_url');
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      // Subida al Bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `lecturas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('evidencia-lecturas')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('evidencia-lecturas')
        .getPublicUrl(filePath);
      
      setFotoUrl(publicUrl);
      localStorage.setItem('last_foto_url', publicUrl);

      // Envío a Hugging Face
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch("https://orojuezsa-lector-ocr-industrial.hf.space/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setTicketId(data.ticket_id);

    } catch (err: any) {
      alert("Error: " + err.message);
      setLoading(false);
    }
  };

  const regresarAlMenu = () => { window.location.href = '/dashboard_principal'; };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase tracking-wider">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="flex items-center justify-between py-4 border-b border-white/10 relative">
          <button onClick={regresarAlMenu} className="absolute left-0 text-zinc-500 hover:text-white p-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="text-blue-500 font-bold text-[10px] w-full text-center">Control Refinería</h1>
        </header>

        {!datos ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/30">
              
              {/* --- VISTA PREVIA DE LA FOTO GUARDADA --- */}
              {fotoUrl && (
                <div className="relative group mb-8">
                  <img src={fotoUrl} className="w-48 h-48 object-cover rounded-3xl border-2 border-blue-500/30 shadow-2xl" alt="Evidencia" />
                  <a 
                    href={fotoUrl} 
                    target="_blank" 
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-blue-600 text-[9px] px-3 py-1.5 rounded-full font-bold shadow-xl flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>Ver Original</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                </div>
              )}

              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || !!ticketId} 
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  (loading || ticketId) ? 'bg-zinc-800 animate-pulse' : 'bg-blue-600 hover:bg-blue-500 active:scale-90 shadow-xl shadow-blue-900/40'
                }`}
              >
                {ticketId ? (
                   <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 6v6m0 0l-3-3m3 3l3-3" strokeWidth="2"/></svg>
                ) : (
                   <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                )}
              </button>
              
              <p className="mt-8 text-zinc-500 text-[9px] font-bold text-center leading-loose">
                {ticketId ? "FOTO GUARDADA EN SUPABASE.\nIA PROCESANDO LECTURA..." : "PRESIONE PARA CAPTURAR"}
              </p>
            </div>
          </div>
        ) : (
          /* PANTALLA DE RESULTADOS */
          <div className="bg-zinc-900 rounded-[32px] p-6 border border-white/5 space-y-6">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
              <span className="text-[9px] text-zinc-500 font-bold">TAG: {datos.tag}</span>
              <a href={fotoUrl || '#'} target="_blank" className="text-[9px] text-blue-500 font-bold underline">VER FOTO</a>
            </div>

            <div className="text-center py-4">
              <p className="text-[9px] text-zinc-500 font-bold mb-2">Lectura Totalizador</p>
              <p className="text-6xl font-black text-green-500">{datos.totalizador}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'MASA', v: datos.masa }, { l: 'TEMP', v: datos.temp }, { l: 'DENS', v: datos.dens }
              ].map((it, i) => (
                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-[8px] text-zinc-500 mb-1">{it.l}</p>
                  <p className="text-xs font-bold">{it.v}</p>
                </div>
              ))}
            </div>

            <button onClick={() => { alert("Guardado"); setDatos(null); setFotoUrl(null); }} className="w-full py-5 bg-blue-600 rounded-2xl font-black text-xs shadow-lg shadow-blue-900/30">
              CONFIRMAR REGISTRO
            </button>
          </div>
        )}

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}