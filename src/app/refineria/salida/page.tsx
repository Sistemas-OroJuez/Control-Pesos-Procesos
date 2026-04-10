'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'refineria_assets'; 
const IA_ENDPOINT = "https://orojuezsa-lector-ocr-industrial.hf.space/upload";
const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";

export default function SalidaRBD() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const [observaciones, setObservaciones] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. PERSISTENCIA
  useEffect(() => {
    const verificarProcesoPendiente = async () => {
      const hoy = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('lecturas_ia')
        .select('*')
        .eq('status', 'procesando')
        .eq('tipo_operacion', 'SALIDA_RBD') // Identificador de salida
        .gte('created_at', hoy)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setTicketId(data.id);
        setFotoUrl(data.foto_url);
        setLoading(true);
      }
    };
    verificarProcesoPendiente();
  }, []);

  // 2. ESCUCHA EN TIEMPO REAL
  useEffect(() => {
    if (!ticketId) return;
    const channel = supabase
      .channel(`seguimiento-salida-${ticketId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', schema: 'public', table: 'lecturas_ia', filter: `id=eq.${ticketId}` 
      }, (payload) => {
          if (payload.new.status === 'completado') {
            setDatos(payload.new);
            setLoading(false);
            setTicketId(null);
          } else if (payload.new.status === 'error') {
            alert("Error IA Salida: " + payload.new.ia_raw);
            resetEstados();
          }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const resetEstados = () => {
    setLoading(false);
    setTicketId(null);
    setDatos(null);
    setFotoUrl(null);
  };

  const handleCancelar = async () => {
    if (!ticketId) return resetEstados();
    await supabase.from('lecturas_ia').update({ status: 'error', ia_raw: 'Cancelado por usuario' }).eq('id', ticketId);
    resetEstados();
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      const hoy = new Date().toISOString().split('T')[0];
      const { count } = await supabase.from('lecturas_ia').select('*', { count: 'exact', head: true }).gte('created_at', hoy);
      const nuevoTicketNum = (count || 0) + 1;

      // Identificamos el archivo como salida en el bucket
      const fileName = `salida_${nuevoTicketNum}_${Date.now()}.jpg`; 
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
            tipo_operacion: 'SALIDA_RBD' // Tipo de operación técnica
        })
        .select().single();

      if (dbErr) throw dbErr;
      setTicketId(ticket.id);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('ticket_id', ticket.id);
      await fetch(IA_ENDPOINT, { method: "POST", body: formData });

    } catch (err: any) {
      alert("Error en Salida: " + err.message);
      resetEstados();
    }
  };

  const handleConfirmarYGuardar = async () => {
    if (!datos || !fotoUrl) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('operaciones_refineria').insert([{
          tipo_operacion: 'SALIDA_RBD', // Tipo de operación de negocio
          valor_lectura: parseFloat(datos.totalizador), 
          foto_url: fotoUrl,
          observaciones: observaciones,
          temperatura_c: parseFloat(datos.temperatura),
          densidad_kg_l: 0.8862, // Densidad RBD por defecto
          usuario_registro: 'Operador Salida'
      }]);
      if (error) throw error;
      alert("✅ SALIDA RBD REGISTRADA");
      resetEstados();
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleEnviarAlJefe = async () => {
    if (!datos) return;
    const mensaje = `🚨 *REVISIÓN SALIDA RBD* 🚨\n\n*Ticket:* #${datos.ticket_num}\n*Lectura:* ${datos.totalizador} kg\n*Temp:* ${datos.temperatura}°C\n\n*FOTO:* ${datos.foto_url || fotoUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-zinc-900 border border-white/10 p-3 rounded-2xl flex items-center">
            <span className="text-[10px] font-black text-zinc-400">VOLVER</span>
          </button>
          {/* TÍTULO EN VERDE ESMERALDA */}
          <h1 className="flex-1 text-emerald-500 font-black text-[10px] tracking-[0.3em] text-center">REFINERÍA OROJUEZ - SALIDA RBD</h1>
        </header>

        {/* --- ESTADO: PROCESANDO (VERDE ESMERALDA) --- */}
        {loading && !datos ? (
          <div className="flex flex-col items-center border-2 border-emerald-900/30 rounded-[40px] p-10 bg-zinc-900/40">
            {/* SPINNER VERDE ESMERALDA */}
            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-emerald-500 font-black text-[11px] tracking-widest text-center">IA ANALIZANDO SALIDA...</p>
            
            {fotoUrl && (
              /* LINK VERDE ESMERALDA */
              <a href={fotoUrl} target="_blank" className="mt-4 text-emerald-400 text-[9px] font-black underline tracking-widest">
                VER FOTO ENVIADA
              </a>
            )}

            <button 
              onClick={handleCancelar}
              className="mt-8 px-6 py-3 bg-red-600/20 text-red-500 border border-red-500/20 rounded-xl text-[9px] font-black tracking-widest"
            >
              CANCELAR PROCESO
            </button>
          </div>
        ) : !datos ? (
          /* --- ESTADO: LISTO PARA FOTO (BOTÓN VERDE ESMERALDA) --- */
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20">
            <button onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-full bg-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-900/40">
              <span className="text-4xl">📸</span>
            </button>
            <p className="mt-8 text-zinc-600 text-[11px] font-black text-center tracking-widest">CAPTURAR SALIDA RBD</p>
          </div>
        ) : (
          /* --- ESTADO: RESULTADOS --- */
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-6 animate-in zoom-in">
            <div className="text-center py-4 border-b border-white/5">
                <p className="text-[11px] text-zinc-500 font-black tracking-[.2em]">TOTALIZADOR SALIDA</p>
                {/* NÚMEROS EN VERDE ESMERALDA */}
                <p className="text-6xl font-black text-emerald-400 tracking-tighter tabular-nums">{datos.totalizador}</p>
                <p className="text-[10px] text-zinc-600 font-bold uppercase">{datos.temperatura}°C</p>
                
                {/* LINK VERDE ESMERALDA */}
                <a href={datos.foto_url || fotoUrl} target="_blank" className="mt-2 inline-block text-emerald-400 text-[9px] font-black underline tracking-widest">
                  VER FOTO DE RESPALDO
                </a>
            </div>
            
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full bg-black/40 rounded-2xl p-4 text-[10px] text-white border border-white/5" placeholder="NOTAS DE SALIDA..." />
            
            <div className="grid grid-cols-2 gap-3">
                <button onClick={resetEstados} className="py-5 bg-zinc-800 rounded-2xl font-black text-[9px]">RE-PROCESAR</button>
                <button onClick={handleEnviarAlJefe} className="py-5 bg-orange-600/20 text-orange-500 rounded-2xl font-black text-[9px]">AVISAR JEFE</button>
            </div>
            
            {/* BOTÓN CONFIRMAR VERDE ESMERALDA */}
            <button onClick={handleConfirmarYGuardar} className="w-full py-6 bg-emerald-600 rounded-2xl font-black text-xs tracking-[0.2em] shadow-lg">CONFIRMAR REGISTRO</button>
          </div>
        )}
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}