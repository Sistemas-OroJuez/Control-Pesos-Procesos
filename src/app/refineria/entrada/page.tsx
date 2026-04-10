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

  useEffect(() => {
    const savedTicket = localStorage.getItem('last_ticket_id');
    const savedFoto = localStorage.getItem('last_foto_url');
    if (savedTicket) { setTicketId(savedTicket); setLoading(true); }
    if (savedFoto) setFotoUrl(savedFoto);
  }, []);

  // ESCUCHAR CAMBIOS EN TIEMPO REAL
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`seguimiento-${ticketId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', schema: 'public', table: 'lecturas_ia', filter: `id=eq.${ticketId}` 
      }, (payload) => {
          if (payload.new.status === 'completado') {
            setDatos(payload.new);
            setLoading(false);
            setTicketId(null);
            localStorage.clear();
          } else if (payload.new.status === 'error') {
            alert("La IA encontró un problema. Intente de nuevo.");
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
      const hoy = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('lecturas_ia')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', hoy);
      
      const nuevoTicketNum = (count || 0) + 1;

      const fileName = `ticket_${nuevoTicketNum}_${Date.now()}.jpg`; 
      const { error: upErr } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      setFotoUrl(publicUrl);

      const { data: ticket, error: dbErr } = await supabase
        .from('lecturas_ia')
        .insert({ 
            status: 'procesando', 
            foto_url: publicUrl,
            ticket_num: nuevoTicketNum,
            revision_status: 'ia_ok'
        })
        .select().single();

      if (dbErr) throw dbErr;
      setTicketId(ticket.id);
      localStorage.setItem('last_ticket_id', ticket.id);
      localStorage.setItem('last_foto_url', publicUrl);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('ticket_id', ticket.id);

      fetch(IA_ENDPOINT, { method: "POST", body: formData }).catch(e => console.error(e));

    } catch (err: any) {
      alert("Error: " + err.message);
      setLoading(false);
    }
  };

  const handleEnviarAlJefe = async () => {
    if (!datos) return;

    try {
      // Marcar en DB primero
      await supabase
        .from('lecturas_ia')
        .update({ revision_status: 'pendiente_jefe' })
        .eq('id', datos.id);

      // Construcción del mensaje con saltos de línea explícitos para URL
      const mensaje = [
        "🚨 REVISIÓN REQUERIDA - REFINERÍA 🚨",
        "",
        `TICKET: #${datos.ticket_num}`,
        `TOTALIZADOR: ${datos.totalizador} kg`,
        `TEMPERATURA: ${datos.temperatura || 'N/A'}°C`,
        "",
        `FOTO EVIDENCIA:`,
        datos.foto_url,
        "",
        "Favor revisar la lectura manual."
      ].join("\n");

      // El secreto está en encodeURIComponent sobre TODO el bloque de texto
      const finalUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
      
      window.open(finalUrl, '_blank');
      
      // Resetear vista
      setDatos(null);
      setFotoUrl(null);
    } catch (e) {
      alert("Error al procesar el envío de WhatsApp");
    }
  };

  const cancelarProceso = () => {
    setTicketId(null); setFotoUrl(null); setLoading(false); localStorage.clear();
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* CABECERA CON BOTÓN DE SALIR MEJORADO */}
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button 
            onClick={() => window.location.href = DASHBOARD_URL} 
            className="bg-zinc-900 border border-white/10 p-3 rounded-2xl hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center"
            title="Salir al Dashboard"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="ml-2 text-[10px] font-black tracking-widest mr-1">SALIR</span>
          </button>
          
          <div className="flex-1 text-center">
            <h1 className="text-blue-500 font-black text-[10px] tracking-[0.3em]">REFINERÍA OROJUEZ</h1>
          </div>
        </header>

        {!datos ? (
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20 shadow-inner">
            
            {fotoUrl && (
              <a href={fotoUrl} target="_blank" className="mb-8 text-blue-400 text-[9px] font-black underline underline-offset-4 tracking-widest">
                VER EVIDENCIA CAPTURADA
              </a>
            )}

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !!ticketId} 
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                ticketId ? 'bg-zinc-900 animate-pulse border-2 border-blue-500/20' : 'bg-blue-600 shadow-2xl shadow-blue-900/40 active:scale-90'
              }`}
            >
              {ticketId ? (
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2"/>
                </svg>
              )}
            </button>
            
            <p className="mt-10 text-zinc-600 text-[11px] font-black text-center tracking-widest leading-tight">
              {ticketId ? "LA IA ESTÁ ANALIZANDO...\nESPERE UN MOMENTO" : "PRESIONE PARA CAPTURAR\nCONTADOR MÁSICO"}
            </p>

            {ticketId && (
              <button onClick={cancelarProceso} className="mt-8 text-red-500 text-[9px] font-black border border-red-500/20 px-8 py-3 rounded-full tracking-widest">
                ANULAR
              </button>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-6 animate-in zoom-in shadow-2xl">
            <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-bold text-zinc-500 tracking-widest">TICKET #</span>
                <span className="text-xl font-black text-white">{datos.ticket_num}</span>
            </div>

            <div className="text-center py-6 border-y border-white/5 space-y-4">
              <p className="text-[11px] text-zinc-500 font-bold tracking-widest">TOTALIZADOR DETECTADO</p>
              <p className="text-6xl font-black text-green-500 tabular-nums tracking-tighter">{datos.totalizador}</p>
              <p className="text-[10px] text-zinc-600 font-bold mb-4">MÁSICO (kg)</p>

              <div className="flex justify-center gap-6 py-4 bg-zinc-800/30 rounded-3xl mx-2">
                <div>
                  <p className="text-[9px] text-zinc-500 font-bold tracking-widest mb-1">TEMPERATURA</p>
                  <p className="text-2xl font-black text-white">{datos.temperatura}°C</p>
                </div>
                <div className="border-l border-white/5 pl-6">
                  <p className="text-[9px] text-zinc-500 font-bold tracking-widest mb-1">ESTADO IA</p>
                  <p className="text-2xl font-black text-blue-500">LISTO</p>
                </div>
              </div>

              <a 
                href={datos.foto_url} 
                target="_blank" 
                className="inline-block mt-4 text-[10px] text-blue-400 font-black underline underline-offset-4 tracking-widest"
              >
                📂 COMPARAR CON FOTO ORIGINAL
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => {setDatos(null); setTicketId(null); setFotoUrl(null);}}
                    className="py-5 bg-zinc-800 rounded-3xl font-black text-[9px] tracking-widest border border-white/5 active:bg-zinc-700"
                >
                    RE-PROCESAR
                </button>
                <button 
                    onClick={handleEnviarAlJefe}
                    className="py-5 bg-orange-600/20 text-orange-500 rounded-3xl font-black text-[9px] tracking-widest border border-orange-500/20 active:bg-orange-600/30"
                >
                    AVISAR AL JEFE
                </button>
            </div>

            <button 
                onClick={() => {setDatos(null); setFotoUrl(null);}} 
                className="w-full py-6 bg-blue-600 rounded-3xl font-black text-xs tracking-[0.2em] shadow-lg shadow-blue-900/20 active:scale-95"
            >
                CONFIRMAR Y FINALIZAR
            </button>
          </div>
        )}

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}