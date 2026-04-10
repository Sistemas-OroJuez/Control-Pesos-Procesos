'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'refineria_assets'; 
const IA_ENDPOINT = "https://orojuezsa-lector-ocr-industrial.hf.space/upload";
const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";

export default function IngresoACP() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const [observaciones, setObservaciones] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          } else if (payload.new.status === 'error') {
            alert("Error IA: " + payload.new.ia_raw);
            setLoading(false); 
            setTicketId(null);
          }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 1. BLOQUEO INMEDIATO
    setLoading(true);

    try {
      const hoy = new Date().toISOString().split('T')[0];
      const { count } = await supabase.from('lecturas_ia').select('*', { count: 'exact', head: true }).gte('created_at', hoy);
      const nuevoTicketNum = (count || 0) + 1;

      const fileName = `ingreso_${nuevoTicketNum}_${Date.now()}.jpg`; 
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
            revision_status: 'ia_ok',
            tipo_operacion: 'INGRESO_ACP'
        })
        .select().single();

      if (dbErr) throw dbErr;
      
      setTicketId(ticket.id);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('ticket_id', ticket.id);

      // El loading se mantiene activo durante la petición a la IA
      await fetch(IA_ENDPOINT, { method: "POST", body: formData });

    } catch (err: any) {
      alert("Error: " + err.message);
      setLoading(false); 
      setTicketId(null);
    }
  };

  const handleConfirmarYGuardar = async () => {
    if (!datos || !fotoUrl) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('operaciones_refineria').insert([{
          tipo_operacion: 'INGRESO_ACP',
          valor_lectura: parseFloat(datos.totalizador), 
          foto_url: fotoUrl,
          observaciones: observaciones,
          temperatura_c: parseFloat(datos.temperatura),
          densidad_kg_l: 0.8900,
          usuario_registro: 'Operador Entrada'
      }]);
      if (error) throw error;
      alert("✅ INGRESO REGISTRADO");
      setDatos(null); setFotoUrl(null); setObservaciones('');
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleEnviarAlJefe = async () => {
    if (!datos) return;
    const mensaje = `🚨 *REVISIÓN INGRESO ACP* 🚨\n\n*Ticket:* #${datos.ticket_num}\n*Lectura:* ${datos.totalizador} kg\n*Temp:* ${datos.temperatura}°C\n\n*FOTO:* ${datos.foto_url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  // --- COMPONENTE DE CARGA (Para asegurar el bloqueo visual) ---
  if (loading && !datos) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
         <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-8"></div>
         <h2 className="text-blue-500 font-black tracking-[0.2em] text-center uppercase">
            IA Analizando Lectura...
         </h2>
         <p className="text-zinc-600 text-[10px] mt-4 font-bold tracking-widest uppercase">
            Por favor espera, esto puede tardar unos minutos
         </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button 
            onClick={() => {
              setLoading(false);
              window.location.href = DASHBOARD_URL;
            }} 
            className="bg-zinc-900 border border-white/10 p-3 rounded-2xl flex items-center"
          >
            <span className="text-[10px] font-black text-zinc-400">VOLVER</span>
          </button>
          <h1 className="flex-1 text-blue-500 font-black text-[10px] tracking-[0.3em] text-center">REFINERÍA OROJUEZ</h1>
        </header>

        {!datos ? (
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20">
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-900/40"
            >
              <span className="text-4xl">📸</span>
            </button>
            <p className="mt-8 text-zinc-600 text-[11px] font-black text-center tracking-widest leading-tight">
              CAPTURAR ENTRADA ACP
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-6 animate-in zoom-in">
            <div className="text-center py-4 border-b border-white/5">
                <p className="text-[11px] text-zinc-500 font-black tracking-[.2em]">TOTALIZADOR ENTRADA</p>
                <p className="text-6xl font-black text-blue-400 tracking-tighter tabular-nums">{datos.totalizador}</p>
                <p className="text-[10px] text-zinc-600 font-bold uppercase">{datos.temperatura}°C</p>
            </div>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full bg-black/40 rounded-2xl p-4 text-[10px] text-white border border-white/5" placeholder="NOTAS..." />
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => {setDatos(null); setFotoUrl(null); setLoading(false);}} className="py-5 bg-zinc-800 rounded-2xl font-black text-[9px]">RE-PROCESAR</button>
                <button onClick={handleEnviarAlJefe} className="py-5 bg-orange-600/20 text-orange-500 rounded-2xl font-black text-[9px]">AVISAR JEFE</button>
            </div>
            <button onClick={handleConfirmarYGuardar} className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xs tracking-[0.2em] shadow-lg">CONFIRMAR REGISTRO</button>
          </div>
        )}
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}