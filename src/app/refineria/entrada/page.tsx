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
  
  // ESTADOS QUE DEBEN PERSISTIR
  const [variedad, setVariedad] = useState('ALTO OLEICO');
  const [esReproceso, setEsReproceso] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. RECUPERAR DATOS SI SE SALIÓ POR ACCIDENTE (LocalStorage + Supabase Check)
  useEffect(() => {
    const backup = localStorage.getItem('backup_ingreso_acp');
    if (backup) {
      const parsed = JSON.parse(backup);
      setDatos(parsed.datos);
      setFotoUrl(parsed.fotoUrl);
      setVariedad(parsed.variedad);
      setEsReproceso(parsed.esReproceso);
      setObservaciones(parsed.observaciones || '');
      return;
    }

    const verificarProcesoPendiente = async () => {
      const hoy = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('lecturas_ia')
        .select('*')
        .eq('status', 'procesando')
        .eq('tipo_operacion', 'INGRESO_ACP')
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

  // 2. GUARDAR BACKUP LOCAL AUTOMÁTICAMENTE CUANDO HAY CAMBIOS
  useEffect(() => {
    if ((datos || ticketId) && fotoUrl) {
      localStorage.setItem('backup_ingreso_acp', JSON.stringify({
        datos, ticketId, fotoUrl, variedad, esReproceso, observaciones
      }));
    }
  }, [datos, ticketId, fotoUrl, variedad, esReproceso, observaciones]);

  // 3. ESCUCHA DE RESULTADOS DE LA IA
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
            resetTodo();
          }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const resetEstados = () => {
    localStorage.removeItem('backup_ingreso_acp'); 
    setLoading(false);
    setTicketId(null);
    setDatos(null);
    setFotoUrl(null);
    setObservaciones('');
  };

  const resetTodo = () => {
    resetEstados();
    setEsReproceso(false); 
    setVariedad('ALTO OLEICO');
  };

  const handleCancelar = async () => {
    if (ticketId) {
      await supabase.from('lecturas_ia').update({ status: 'error', ia_raw: 'Cancelado por usuario' }).eq('id', ticketId);
    }
    resetTodo();
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    resetTodo(); 
    setLoading(true);

    try {
      const hoy = new Date().toISOString().split('T')[0];
      const { count } = await supabase.from('lecturas_ia').select('*', { count: 'exact', head: true }).gte('created_at', hoy);
      const nuevoTicketNum = (count || 0) + 1;

      const fileName = `ingreso_${nuevoTicketNum}_${Date.now()}.jpg`; 
      const { error: upErr } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      setFotoUrl(publicUrl); // SE ASIGNA INMEDIATAMENTE PARA VISIBILIDAD

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
      resetTodo();
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
          densidad_kg_l: 0.8936, 
          usuario_registro: 'Operador Entrada',
          variedad: variedad,
          es_reproceso: esReproceso
      }]);

      if (error) throw error;
      alert(`✅ REGISTRADO: ${variedad}${esReproceso ? ' (REPROCESO)' : ''}`);
      resetTodo(); 
    } catch (err: any) { 
        alert("Error al guardar: " + err.message); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleEnviarAlJefe = async () => {
    if (!datos) return;
    const mensaje = `🚨 *REVISIÓN INGRESO ACP* 🚨\n\n*Variedad:* ${variedad}\n*Reproceso:* ${esReproceso ? 'SÍ' : 'NO'}\n*Lectura:* ${datos.totalizador} kg\n*Temp:* ${datos.temperatura}°C\n\n*FOTO:* ${fotoUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-zinc-900 border border-white/10 p-3 rounded-2xl flex items-center">
            <span className="text-[10px] font-black text-zinc-400">VOLVER</span>
          </button>
          <h1 className="flex-1 text-blue-500 font-black text-[10px] tracking-[0.3em] text-center">REFINERÍA OROJUEZ</h1>
        </header>

        {loading && !datos ? (
          <div className="flex flex-col items-center border-2 border-blue-900/30 rounded-[40px] p-10 bg-zinc-900/40">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-blue-500 font-black text-[11px] tracking-widest text-center">IA ANALIZANDO IMAGEN...</p>
            
            {/* LINK VISIBLE DURANTE PROCESAMIENTO */}
            {fotoUrl && (
              <a href={fotoUrl} target="_blank" className="mt-4 text-blue-400 text-[9px] font-black underline animate-pulse">
                VER FOTO DE RESPALDO (CAPTURADA)
              </a>
            )}

            <button onClick={handleCancelar} className="mt-8 px-6 py-3 bg-red-600/20 text-red-500 border border-red-500/20 rounded-xl text-[9px] font-black uppercase">CANCELAR</button>
          </div>
        ) : !datos ? (
          <div className="space-y-6">
            <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/5 space-y-4">
               <div>
                  <label className="text-[9px] font-black text-zinc-500 tracking-widest ml-2">VARIEDAD</label>
                  <select 
                    value={variedad} 
                    onChange={(e) => setVariedad(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 mt-2 text-xs font-bold text-white appearance-none focus:outline-none"
                  >
                    <option value="ALTO OLEICO">ALTO OLEICO</option>
                    <option value="GUINENSIS">GUINENSIS</option>
                  </select>
               </div>
               
               <button 
                onClick={() => setEsReproceso(!esReproceso)}
                className={`w-full p-4 rounded-2xl border transition-all flex justify-between items-center ${esReproceso ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-black'}`}
               >
                 <span className="text-[10px] font-black tracking-widest uppercase">{esReproceso ? 'ES REPROCESO ✅' : '¿ES REPROCESO?'}</span>
                 <div className={`w-4 h-4 rounded-full ${esReproceso ? 'bg-orange-500' : 'bg-zinc-800'}`}></div>
               </button>
            </div>

            <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20">
              <button onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-900/40">
                <span className="text-4xl">📸</span>
              </button>
              <p className="mt-8 text-zinc-600 text-[11px] font-black text-center tracking-widest uppercase">CAPTURAR TOTALIZADOR</p>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-6 animate-in zoom-in">
            {/* INDICADOR DE RECUPERACIÓN */}
            <div className="text-center -mb-4">
                <span className="text-[8px] font-black text-blue-500/50 tracking-tighter uppercase tracking-[0.2em]">Sincronizado con memoria local</span>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={() => setVariedad(variedad === 'ALTO OLEICO' ? 'GUINENSIS' : 'ALTO OLEICO')}
                    className="flex-1 py-2 bg-black border border-white/10 rounded-xl text-[8px] font-black text-zinc-400"
                >
                    CAMBIAR A {variedad === 'ALTO OLEICO' ? 'GUINENSIS' : 'ALTO OLEICO'}
                </button>
                <button 
                    onClick={() => setEsReproceso(!esReproceso)}
                    className={`flex-1 py-2 border rounded-xl text-[8px] font-black ${esReproceso ? 'bg-orange-500/10 border-orange-500 text-orange-500' : 'bg-black border-white/10 text-zinc-400'}`}
                >
                    {esReproceso ? 'QUITAR REPROCESO' : 'MARCAR REPROCESO'}
                </button>
            </div>

            <div className="text-center py-4 border-b border-white/5">
                <div className="flex justify-center gap-2 mb-2">
                  <span className="bg-blue-500/10 text-blue-500 text-[8px] font-black px-3 py-1 rounded-full border border-blue-500/20 uppercase">{variedad}</span>
                  {esReproceso && <span className="bg-orange-500/10 text-orange-500 text-[8px] font-black px-3 py-1 rounded-full border border-orange-500/20 uppercase">REPROCESO</span>}
                </div>
                <p className="text-[11px] text-zinc-500 font-black tracking-[.2em]">VALOR LEÍDO POR IA</p>
                <p className="text-6xl font-black text-blue-400 tracking-tighter tabular-nums">{datos.totalizador}</p>
                <p className="text-[10px] text-zinc-600 font-bold uppercase">{datos.temperatura}°C | {datos.densidad || '0.8936'} KG/L</p>
                <a href={fotoUrl} target="_blank" className="text-[9px] text-blue-500 underline block mt-2">Ver foto de respaldo</a>
            </div>
            
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full bg-black/40 rounded-2xl p-4 text-[10px] text-white border border-white/5" placeholder="NOTAS ADICIONALES..." />
            
            <div className="grid grid-cols-2 gap-3">
                <button onClick={resetTodo} className="py-5 bg-zinc-800 rounded-2xl font-black text-[9px] uppercase">REINTENTAR</button>
                <button onClick={handleEnviarAlJefe} className="py-5 bg-orange-600/20 text-orange-500 rounded-2xl font-black text-[9px] uppercase">AVISAR JEFE</button>
            </div>
            
            <button onClick={handleConfirmarYGuardar} className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xs tracking-[0.2em] shadow-lg uppercase">CONFIRMAR Y GUARDAR</button>
          </div>
        )}
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}