'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LectorIndustrial() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. PERSISTENCIA: Recuperar ticket y foto al recargar
  useEffect(() => {
    const savedTicket = localStorage.getItem('last_ticket_id');
    const savedFoto = localStorage.getItem('last_foto_url');
    if (savedTicket) { setTicketId(savedTicket); setLoading(true); }
    if (savedFoto) setFotoUrl(savedFoto);
  }, []);

  // 2. REALTIME: Detectar cuando la IA guarda los datos en Supabase
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`seguimiento-${ticketId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'lecturas_ia', 
          filter: `id=eq.${ticketId}` 
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
      // PASO 1: Subir foto al Bucket (Evidencia inmediata)
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `lecturas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('evidencia-lecturas') // <--- NOMBRE DE TU BUCKET
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('evidencia-lecturas')
        .getPublicUrl(filePath);
      
      setFotoUrl(publicUrl);
      localStorage.setItem('last_foto_url', publicUrl);

      // PASO 2: Avisar a la IA en Hugging Face
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch("https://orojuezsa-lector-ocr-industrial.hf.space/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setTicketId(data.ticket_id);
      localStorage.setItem('last_ticket_id', data.ticket_id);

    } catch (err: any) {
      alert("Error de conexión: " + err.message);
      setLoading(false);
    }
  };

  const cancelarEspera = () => {
    if (confirm("¿Cancelar espera? La IA seguirá procesando pero podrás tomar otra foto.")) {
      setTicketId(null);
      setFotoUrl(null);
      setLoading(false);
      localStorage.removeItem('last_ticket_id');
      localStorage.removeItem('last_foto_url');
    }
  };

  const guardarFinal = async () => {
    setLoading(true);
    // Aquí guardas en tu tabla de historial permanente
    const { error } = await supabase.from('operaciones_refineria').insert([{
      valor_lectura: parseFloat(datos.totalizador),
      masa_kg_h: parseFloat(datos.masa),
      foto_referencia: fotoUrl // Guardamos el link de la foto para siempre
    }]);
    
    if(!error) {
      alert("Registro Completado");
      setDatos(null);
      setFotoUrl(null);
      localStorage.removeItem('last_foto_url');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase tracking-tighter">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="flex justify-between items-center py-4 border-b border-white/10">
          <button onClick={() => window.location.href='/dashboard_principal'} className="text-zinc-500 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2"/></svg>
          </button>
          <span className="text-[10px] font-bold text-blue-500 tracking-[0.3em]">Ingreso ACP</span>
          <div className="w-6"></div>
        </header>

        {!datos ? (
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20">
            {fotoUrl && (
              <div className="mb-6 text-center animate-pulse">
                <img src={fotoUrl} className="w-32 h-32 object-cover rounded-2xl border border-blue-500/50" alt="Bucket" />
                <a href={fotoUrl} target="_blank" className="block mt-2 text-[8px] text-blue-400 underline font-bold">VER FOTO EN SUPABASE</a>
              </div>
            )}

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={!!ticketId}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${ticketId ? 'bg-zinc-900' : 'bg-blue-600 shadow-xl shadow-blue-900/40'}`}
            >
              {ticketId ? (
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2" /></svg>
              )}
            </button>

            <div className="mt-8 text-center">
               <p className="text-zinc-600 text-[9px] font-bold leading-relaxed mb-4">
                {ticketId ? "IA PROCESANDO EN BACKGROUND...\nDATOS SE GUARDARÁN AL TERMINAR." : "ESCANEAR VISOR INDUSTRIAL"}
              </p>
              {ticketId && (
                <button onClick={cancelarEspera} className="text-red-500 text-[8px] font-black border border-red-500/30 px-4 py-2 rounded-full uppercase">
                  Cancelar y nueva foto
                </button>
              )}
            </div>
          </div>
        ) : (
          /* RESULTADOS */
          <div className="bg-zinc-900 rounded-[35px] p-6 space-y-6 border border-white/5 animate-in zoom-in duration-300">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
              <span className="text-[10px] text-zinc-500 font-bold">TAG: {datos.tag}</span>
              <a href={fotoUrl || '#'} target="_blank" className="text-blue-500 text-[9px] font-bold underline">VER EVIDENCIA</a>
            </div>
            
            <div className="text-center py-4">
              <p className="text-[10px] text-zinc-500 font-bold mb-2 tracking-widest">TOTALIZADOR</p>
              <p className="text-7xl font-black text-green-500">{datos.totalizador}</p>
            </div>

            <button onClick={guardarFinal} className="w-full py-5 bg-blue-600 rounded-2xl font-black text-xs tracking-widest shadow-lg shadow-blue-900/30">
              CONFIRMAR REGISTRO
            </button>
          </div>
        )}

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}