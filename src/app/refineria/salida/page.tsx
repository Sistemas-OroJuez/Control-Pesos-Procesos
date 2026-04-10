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

  // 1. ESCUCHAR CAMBIOS DE LA IA EN TIEMPO REAL
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
            setLoading(false);
          }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  // 2. CAPTURA E INICIO DE PROCESO (Hacia Hugging Face)
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      const hoy = new Date().toISOString().split('T')[0];
      const { count } = await supabase.from('lecturas_ia').select('*', { count: 'exact', head: true }).gte('created_at', hoy);
      const nuevoTicketNum = (count || 0) + 1;

      // Nombre de archivo identificado como salida
      const fileName = `salida_${nuevoTicketNum}_${Date.now()}.jpg`; 
      const { error: upErr } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      setFotoUrl(publicUrl);

      // Crear ticket técnico para la IA
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

      // Petición a Hugging Face
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ticket_id', ticket.id);
      fetch(IA_ENDPOINT, { method: "POST", body: formData }).catch(e => console.error(e));

    } catch (err: any) {
      alert("Error: " + err.message);
      setLoading(false);
    }
  };

  // 3. GUARDADO FINAL EN operaciones_refineria (PASO DE NEGOCIO)
  const handleConfirmarYGuardar = async () => {
    if (!datos || !fotoUrl) return;
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('operaciones_refineria')
        .insert([{
          tipo_operacion: 'SALIDA_RBD', // <--- Identificador de Salida
          valor_lectura: parseFloat(datos.totalizador), 
          foto_url: fotoUrl,
          observaciones: observaciones,
          masa_kg_h: parseFloat(datos.ia_raw.match(/(\d+\.\d+)/)?.[1] || "0"), // Extrae flujo si está en los logs
          temperatura_c: parseFloat(datos.temperatura),
          densidad_kg_l: 0.8862, // Densidad RBD
          es_reproceso: false, 
          usuario_registro: 'Operador Salida'
        }]);

      if (error) throw error;
      
      alert("✅ SALIDA DE RBD REGISTRADA EN SISTEMA");
      setDatos(null);
      setFotoUrl(null);
      setObservaciones('');
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarAlJefe = async () => {
    if (!datos) return;
    const mensaje = 
      `🚨 *REVISIÓN SALIDA RBD* 🚨\n\n` +
      `*Ticket:* #${datos.ticket_num}\n` +
      `*Lectura:* ${datos.totalizador} kg\n` +
      `*Temp:* ${datos.temperatura}°C\n\n` +
      `*FOTO:* ${datos.foto_url}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* HEADER COLOR VERDE */}
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-zinc-900 border border-white/10 p-3 rounded-2xl flex items-center active:scale-95">
            <span className="text-[10px] font-black text-zinc-400">VOLVER</span>
          </button>
          <h1 className="flex-1 text-green-500 font-black text-[10px] tracking-[0.3em] text-center">REFINERÍA OROJUEZ</h1>
        </header>

        {!datos ? (
          /* VISTA CAPTURA */
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20">
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={loading} 
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                loading ? 'bg-zinc-900 animate-pulse' : 'bg-green-600 shadow-2xl shadow-green-900/40 active:scale-90'
              }`}
            >
              {loading ? (
                <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span className="text-4xl">📸</span>
              )}
            </button>
            <p className="mt-8 text-zinc-600 text-[11px] font-black text-center tracking-widest leading-tight">
              {loading ? "IA ANALIZANDO SALIDA..." : "CAPTURAR SALIDA RBD"}
            </p>
          </div>
        ) : (
          /* VISTA RESULTADOS */
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-6 animate-in zoom-in shadow-2xl">
            <div className="text-center py-4 border-b border-white/5">
                <p className="text-[11px] text-zinc-500 font-black tracking-[.2em]">TOTALIZADOR SALIDA</p>
                <p className="text-6xl font-black text-green-400 tracking-tighter tabular-nums">{datos.totalizador}</p>
                <p className="text-[10px] text-zinc-600 font-bold uppercase">{datos.temperatura}°C</p>
            </div>

            <textarea 
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full bg-black/40 rounded-2xl p-4 text-[10px] text-white border border-white/5 focus:ring-1 focus:ring-green-500"
                placeholder="NOTAS DE SALIDA (LOTE, TANQUE)..."
            />

            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => {setDatos(null); setFotoUrl(null);}} className="py-5 bg-zinc-800 rounded-2xl font-black text-[9px] tracking-widest">RE-PROCESAR</button>
                <button onClick={handleEnviarAlJefe} className="py-5 bg-orange-600/20 text-orange-500 rounded-2xl font-black text-[9px] tracking-widest border border-orange-500/20">AVISAR JEFE</button>
            </div>

            <button 
                onClick={handleConfirmarYGuardar} 
                disabled={loading}
                className="w-full py-6 bg-green-600 rounded-2xl font-black text-xs tracking-[0.2em] shadow-lg active:scale-95 disabled:bg-zinc-700"
            >
                {loading ? "GUARDANDO..." : "CONFIRMAR Y REGISTRAR SALIDA"}
            </button>
          </div>
        )}

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}