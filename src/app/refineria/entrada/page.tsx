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
  
  // ESTADOS CRÍTICOS
  const [variedad, setVariedad] = useState('ALTO OLEICO');
  const [esReproceso, setEsReproceso] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. RECUPERAR DATOS (LocalStorage)
  useEffect(() => {
    const backup = localStorage.getItem('backup_ingreso_acp');
    if (backup) {
      const p = JSON.parse(backup);
      if (p.datos) setDatos(p.datos);
      if (p.fotoUrl) setFotoUrl(p.fotoUrl);
      if (p.variedad) setVariedad(p.variedad);
      if (p.esReproceso !== undefined) setEsReproceso(p.esReproceso);
      if (p.observaciones) setObservaciones(p.observaciones);
    }
  }, []);

  // 2. MANTENER EL BACKUP ACTUALIZADO SIEMPRE
  useEffect(() => {
    if (fotoUrl || datos) {
      localStorage.setItem('backup_ingreso_acp', JSON.stringify({
        datos, fotoUrl, variedad, esReproceso, observaciones
      }));
    }
  }, [datos, fotoUrl, variedad, esReproceso, observaciones]);

  // 3. ESCUCHA DE IA (Sin resetear estados de selección)
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
          }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const resetTodo = () => {
    localStorage.removeItem('backup_ingreso_acp');
    setLoading(false);
    setTicketId(null);
    setDatos(null);
    setFotoUrl(null);
    setObservaciones('');
    setEsReproceso(false);
    setVariedad('ALTO OLEICO');
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // No reseteamos variedad ni esReproceso aquí para que se mantengan
    setLoading(true);
    setDatos(null);

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
      await fetch(IA_ENDPOINT, { method: "POST", body: formData });

    } catch (err: any) {
      alert("Error: " + err.message);
      setLoading(false);
    }
  };

  const handleConfirmarYGuardar = async () => {
    if (!datos || !fotoUrl) return;
    
    setLoading(true);
    try {
      // USAMOS LOS VALORES DIRECTOS DEL ESTADO ACTUAL
      const { error } = await supabase.from('operaciones_refineria').insert([{
          tipo_operacion: 'INGRESO_ACP',
          valor_lectura: parseFloat(datos.totalizador), 
          foto_url: fotoUrl,
          observaciones: observaciones,
          temperatura_c: parseFloat(datos.temperatura || 0),
          densidad_kg_l: 0.8936, 
          usuario_registro: 'Operador Entrada',
          variedad: variedad,
          es_reproceso: esReproceso
      }]);

      if (error) throw error;
      alert(`✅ GUARDADO: ${variedad} ${esReproceso ? '(REPROCESO)' : ''}`);
      resetTodo();
    } catch (err: any) { 
        alert("Error al guardar: " + err.message); 
    } finally { 
        setLoading(false); 
    }
  };

  const SelectorVariedad = () => (
    <div className="bg-zinc-900 p-4 rounded-2xl border border-white/5 space-y-3">
      <div className="flex gap-2">
        <button 
          onClick={() => setVariedad('ALTO OLEICO')}
          className={`flex-1 py-3 rounded-xl text-[9px] font-black border transition-all ${variedad === 'ALTO OLEICO' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-white/10 text-zinc-500'}`}
        >
          ALTO OLEICO
        </button>
        <button 
          onClick={() => setVariedad('GUINENSIS')}
          className={`flex-1 py-3 rounded-xl text-[9px] font-black border transition-all ${variedad === 'GUINENSIS' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-white/10 text-zinc-500'}`}
        >
          GUINENSIS
        </button>
      </div>
      <button 
        onClick={() => setEsReproceso(!esReproceso)}
        className={`w-full py-4 rounded-xl border font-black text-[9px] tracking-widest transition-all ${esReproceso ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-white/10 text-zinc-500'}`}
      >
        {esReproceso ? '✅ MODO REPROCESO ACTIVADO' : '¿ES REPROCESO?'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-zinc-900 border border-white/10 p-3 rounded-2xl">
            <span className="text-[10px] font-black text-zinc-400">VOLVER</span>
          </button>
          <h1 className="flex-1 text-blue-500 font-black text-[10px] tracking-[0.3em] text-center">REFINERÍA OROJUEZ</h1>
        </header>

        {!datos && !loading ? (
          /* MODO INICIAL */
          <div className="space-y-6">
            <SelectorVariedad />
            <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20">
              <button onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-900/40">
                <span className="text-4xl">📸</span>
              </button>
              <p className="mt-8 text-zinc-600 text-[11px] font-black text-center tracking-widest">CAPTURAR TOTALIZADOR</p>
            </div>
          </div>
        ) : loading && !datos ? (
          /* MODO PROCESANDO */
          <div className="flex flex-col items-center border-2 border-blue-900/30 rounded-[40px] p-10 bg-zinc-900/40">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-blue-500 font-black text-[11px] tracking-widest text-center uppercase">Analizando Foto...</p>
            {fotoUrl && (
              <a href={fotoUrl} target="_blank" className="mt-4 text-blue-400 text-[9px] font-black underline animate-pulse">VER FOTO DE RESPALDO</a>
            )}
          </div>
        ) : (
          /* RESULTADOS DE IA */
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-6 animate-in zoom-in">
            <SelectorVariedad />
            
            <div className="text-center py-4 border-b border-white/5">
                <p className="text-[11px] text-zinc-500 font-black tracking-[.2em]">VALOR LEÍDO</p>
                <p className="text-6xl font-black text-blue-400 tracking-tighter tabular-nums">{datos.totalizador}</p>
                <p className="text-[10px] text-zinc-600 font-bold">{datos.temperatura}°C | {datos.densidad || '0.8936'} KG/L</p>
                <a href={fotoUrl} target="_blank" className="text-[9px] text-blue-500 underline block mt-2">Ver foto de respaldo</a>
            </div>
            
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full bg-black/40 rounded-2xl p-4 text-[10px] border border-white/5" placeholder="NOTAS ADICIONALES..." />
            
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setDatos(null)} className="py-5 bg-zinc-800 rounded-2xl font-black text-[9px]">REINTENTAR</button>
                <button onClick={handleConfirmarYGuardar} className="py-5 bg-blue-600 rounded-2xl font-black text-[9px] tracking-widest">CONFIRMAR</button>
            </div>
          </div>
        )}
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}