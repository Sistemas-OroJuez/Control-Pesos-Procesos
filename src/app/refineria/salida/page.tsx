'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// --- CONFIGURACIÓN GLOBAL (Mismos buckets y endpoints) ---
const BUCKET_NAME = 'refineria_assets'; 
const IA_ENDPOINT = "https://orojuezsa-lector-ocr-industrial.hf.space/upload";
const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard"; // URL para salir

export default function SalidaRBD() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recargamos estado si la página se refresca
  useEffect(() => {
    const savedTicket = localStorage.getItem('last_ticket_id_salida');
    const savedFoto = localStorage.getItem('last_foto_url_salida');
    if (savedTicket) { setTicketId(savedTicket); setLoading(true); }
    if (savedFoto) setFotoUrl(savedFoto);
  }, []);

  // --- SUSCRIPCIÓN EN TIEMPO REAL (Idéntica a la entrada) ---
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`seguimiento-salida-${ticketId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', schema: 'public', table: 'lecturas_ia', filter: `id=eq.${ticketId}` 
      }, (payload) => {
          console.log("Cambio detectado en DB Salida:", payload.new.status);
          if (payload.new.status === 'completado') {
            setDatos(payload.new);
            setLoading(false);
            setTicketId(null);
            localStorage.clear(); // Limpiamos rastros locales
          } else if (payload.new.status === 'error') {
            alert("Error en proceso de IA (Salida): " + payload.new.ia_raw);
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
      // 1. Generar número de Ticket (Contador diario)
      const hoy = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('lecturas_ia')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', hoy);
      
      const nuevoTicketNum = (count || 0) + 1;

      // 2. Subir Foto al Bucket
      const fileName = `salida_${nuevoTicketNum}_${Date.now()}.jpg`; 
      const { error: upErr } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
      if (upErr) throw upErr;

      // 3. Obtener URL Pública
      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      setFotoUrl(publicUrl);

      // 4. Crear registro en la DB con tipo SALIDA_RBD
      const { data: ticket, error: dbErr } = await supabase
        .from('lecturas_ia')
        .insert({ 
            status: 'procesando', 
            foto_url: publicUrl,
            ticket_num: nuevoTicketNum,
            revision_status: 'ia_ok',
            tipo_operacion: 'SALIDA_RBD' // <--- CAMBIO CLAVE PARA BALANCE
        })
        .select().single();

      if (dbErr) throw dbErr;
      
      // Guardamos estado local por seguridad
      setTicketId(ticket.id);
      localStorage.setItem('last_ticket_id_salida', ticket.id);
      localStorage.setItem('last_foto_url_salida', publicUrl);

      // 5. Llamar a la IA (Mismo endpoint)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ticket_id', ticket.id);

      console.log("Enviando a IA (Salida)...");
      fetch(IA_ENDPOINT, { method: "POST", body: formData }).catch(e => console.error(e));

    } catch (err: any) {
      alert("Error en App Salida: " + err.message);
      setLoading(false);
    }
  };

  const handleEnviarAlJefe = async () => {
    if (!datos) return;
    try {
      // Marcamos para revisión en Supabase
      await supabase.from('lecturas_ia').update({ revision_status: 'pendiente_jefe' }).eq('id', datos.id);
      
      // MENSAJE DE WHATSAPP ADAPTADO A SALIDA (Blindado con encodeURIComponent)
      const mensaje = 
        `🚨 *REVISIÓN REQUERIDA - SALIDA RBD* 🚨\n\n` +
        `*Ticket Salida:* #${datos.ticket_num}\n` +
        `*Totalizador:* ${datos.totalizador} kg\n` +
        `*Temperatura:* ${datos.temperatura}°C\n\n` +
        `*FOTO EVIDENCIA:* ${datos.foto_url}\n\n` +
        `_Favor revisar lectura de producto terminado._`;

      window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
      
      // Limpiamos vista
      setDatos(null); setFotoUrl(null);
    } catch (e) { alert("Error al contactar al jefe"); }
  };

  const cancelarProceso = () => {
    setTicketId(null); setFotoUrl(null); setLoading(false); localStorage.clear();
  };

  return (
    // CAMBIO DE FONDO: Mantenemos negro pero con toques verdes en componentes
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* CABECERA (Botón Salir igual) */}
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button 
            onClick={() => window.location.href = DASHBOARD_URL} 
            className="bg-zinc-900 border border-white/10 p-3 rounded-2xl flex items-center active:scale-95 transition-all"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M11 19l-7-7 7-7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="ml-2 text-[10px] font-black text-zinc-400">VOLVER</span>
          </button>
          {/* TÍTULO CAMBIADO A VERDE */}
          <h1 className="flex-1 text-green-500 font-black text-[10px] tracking-[0.3em] text-center">REFINERÍA OROJUEZ</h1>
        </header>

        {!datos ? (
          // --- ZONA DE CAPTURA ---
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20 shadow-inner overflow-hidden">
            
            {/* Si hay foto local, la mostramos como preview */}
            {fotoUrl && !loading && (
                <img src={fotoUrl} alt="Preview Salida" className="w-full h-32 object-cover rounded-2xl mb-6 border border-zinc-700 animate-in fade-in" />
            )}

            {/* BOTÓN PRINCIPAL (Color Verde al cargar) */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading} 
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                loading ? 'bg-zinc-900 animate-pulse border-2 border-green-500/20' : 'bg-green-600 shadow-2xl shadow-green-900/30 active:scale-90'
              }`}
            >
              {loading ? (
                <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2"/>
                </svg>
              )}
            </button>
            <p className="mt-10 text-zinc-600 text-[11px] font-black text-center tracking-widest leading-tight">
              {loading ? "LA IA ANALIZA SALIDA...\nESPERE POR FAVOR" : "CAPTURAR CONTADOR\nSALIDA RBD"}
            </p>
            {loading && (
                <button onClick={cancelarProceso} className="mt-8 text-red-500 text-[9px] font-black border border-red-500/20 px-8 py-3 rounded-full tracking-widest">ANULAR</button>
            )}
          </div>
        ) : (
          // --- PANEL DE RESULTADOS (DISEÑO VERDE ESQUEMÁTICO) ---
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-6 animate-in zoom-in shadow-2xl">
            
            {/* CABECERA RESULTADO VERDE */}
            <div className="bg-green-950/30 border border-green-900 p-5 rounded-3xl text-center">
                <p className="text-[10px] text-green-300 font-black tracking-[.2em] mb-1">PRODUCTO TERMINADO</p>
                <h2 className="text-3xl font-black text-white tracking-tighter">SALIDA RBD</h2>
            </div>

            <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-bold text-zinc-500 tracking-widest">TICKET SALIDA #</span>
                <span className="text-xl font-black text-white">{datos.ticket_num}</span>
            </div>
            
            {/* VALOR PRINCIPAL (Verde Esmeralda) */}
            <div className="text-center py-6 border-y border-white/5 space-y-2">
                <p className="text-[11px] text-zinc-500 font-black tracking-[.2em]">TOTALIZADOR ACUMULADO</p>
                <p className="text-6xl font-black text-green-400 tracking-tighter tabular-nums">{datos.totalizador}</p>
                <p className="text-[10px] text-zinc-600 font-bold uppercase">Kilogramos (kg)</p>
            </div>
            
            {/* TEMPERATURA */}
            <div className="py-4 bg-black/20 rounded-3xl border border-white/5 text-center">
                <p className="text-[9px] text-zinc-500 font-bold mb-1 tracking-widest">TEMPERATURA LECTURA</p>
                <p className="text-3xl font-black text-white">{datos.temperatura}°C</p>
            </div>

            <a href={datos.foto_url} target="_blank" className="text-blue-400 text-[10px] font-black underline block py-2 text-center tracking-widest">📂 VER FOTO ORIGINAL</a>

            {/* BOTONES DE ACCIÓN (Misma lógica) */}
            <div className="grid grid-cols-2 gap-3 pt-4">
                <button onClick={() => {setDatos(null); setTicketId(null);}} className="py-5 bg-zinc-800 rounded-2xl font-black text-[9px] tracking-widest active:bg-zinc-700">RE-PROCESAR</button>
                <button onClick={handleEnviarAlJefe} className="py-5 bg-orange-600/20 text-orange-500 rounded-2xl font-black text-[9px] tracking-widest border border-orange-500/20 active:bg-orange-600/30">AVISAR JEFE</button>
            </div>

            {/* CONFIRMAR (Botón Verde) */}
            <button onClick={() => {setDatos(null); setFotoUrl(null);}} className="w-full py-6 bg-green-600 rounded-2xl font-black text-xs tracking-[0.2em] shadow-lg shadow-green-900/40 active:scale-95">CONFIRMAR Y FINALIZAR</button>
          </div>
        )}

        {/* Input oculto (Captura nativa) */}
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}