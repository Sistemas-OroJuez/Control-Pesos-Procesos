'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// CONFIGURACIÓN GLOBAL
const BUCKET_NAME = 'refineria_assets'; 
const IA_ENDPOINT = "https://orojuezsa-lector-ocr-industrial.hf.space/upload";

export default function LectorIndustrial() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. PERSISTENCIA: Recuperar estado si el operador refresca la pantalla
  useEffect(() => {
    const savedTicket = localStorage.getItem('last_ticket_id');
    const savedFoto = localStorage.getItem('last_foto_url');
    if (savedTicket) { setTicketId(savedTicket); setLoading(true); }
    if (savedFoto) setFotoUrl(savedFoto);
  }, []);

  // 2. REALTIME: Escuchar cuando la IA actualiza la fila en Supabase
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
          } else if (payload.new.status === 'error') {
            alert("La IA detectó un error en la imagen. Intente de nuevo.");
            cancelarProceso();
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  // 3. CAPTURA Y PROCESAMIENTO
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      // PASO A: Subida al Bucket refineria_assets
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `lecturas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file);

      if (uploadError) throw new Error(`Error en Storage: ${uploadError.message}`);

      // Obtener URL Pública
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
      
      setFotoUrl(publicUrl);
      localStorage.setItem('last_foto_url', publicUrl);

      // PASO B: Enviar a Hugging Face
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(IA_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Servidor de IA fuera de línea");

      const data = await res.json();
      setTicketId(data.ticket_id);
      localStorage.setItem('last_ticket_id', data.ticket_id);

    } catch (err: any) {
      alert("Error: " + err.message);
      setLoading(false);
    }
  };

  // 4. CANCELAR PROCESO
  const cancelarProceso = () => {
    if (confirm("¿Deseas cancelar la espera? Podrás tomar una nueva foto inmediatamente.")) {
      setTicketId(null);
      setFotoUrl(null);
      setLoading(false);
      localStorage.removeItem('last_ticket_id');
      localStorage.removeItem('last_foto_url');
    }
  };

  // 5. GUARDADO FINAL EN HISTORIAL
  const guardarFinal = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('operaciones_refineria').insert([{
        valor_lectura: parseFloat(datos.totalizador),
        masa_kg_h: parseFloat(datos.masa),
        temperatura_c: parseFloat(datos.temp),
        densidad_kg_l: parseFloat(datos.dens),
        observaciones: `IA OK - Foto: ${fotoUrl}`
      }]);
      
      if (error) throw error;
      alert("✅ Registro guardado en el historial.");
      setDatos(null);
      setFotoUrl(null);
    } catch (e: any) {
      alert("Error al guardar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans tracking-tight uppercase">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="flex justify-between items-center py-4 border-b border-white/10 relative">
          <button onClick={() => window.location.href='/dashboard_principal'} className="text-zinc-500 p-2 active:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 className="text-blue-500 font-black text-[10px] tracking-[0.2em] w-full text-center">Ingreso ACP IA</h1>
          <div className="w-10"></div>
        </header>

        {!datos ? (
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20 shadow-inner">
            
            {/* EVIDENCIA EN PANTALLA DE ESPERA */}
            {fotoUrl && (
              <div className="mb-8 text-center animate-in fade-in duration-700">
                <div className="relative inline-block group">
                  <img src={fotoUrl} className="w-40 h-40 object-cover rounded-[32px] border-2 border-blue-600/30 shadow-2xl" alt="Preview" />
                  <a 
                    href={fotoUrl} 
                    target="_blank" 
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-zinc-800 text-[8px] px-3 py-1.5 rounded-full font-black border border-white/10 flex items-center gap-2"
                  >
                    <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    VER EN BUCKET
                  </a>
                </div>
              </div>
            )}

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !!ticketId} 
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                (loading || ticketId) ? 'bg-zinc-900' : 'bg-blue-600 shadow-xl shadow-blue-900/40 active:scale-90'
              }`}
            >
              {ticketId ? (
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>
            
            <div className="mt-8 text-center space-y-4">
              <p className="text-zinc-600 text-[10px] font-bold leading-relaxed">
                {ticketId 
                  ? "ANALIZANDO IMAGEN...\nEL RESULTADO APARECERÁ AQUÍ." 
                  : "CAPTURE EL VISOR PARA PROCESAR"}
              </p>

              {(ticketId || loading) && (
                <button 
                  onClick={cancelarProceso}
                  className="px-6 py-2 bg-red-900/10 text-red-500 border border-red-900/30 rounded-full text-[9px] font-black tracking-widest active:bg-red-900/30"
                >
                  Cancelar proceso
                </button>
              )}
            </div>
          </div>
        ) : (
          /* RESULTADOS FINALES */
          <div className="bg-zinc-900 rounded-[40px] p-6 border border-white/5 space-y-6 animate-in zoom-in duration-300">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
              <span className="text-[10px] text-zinc-500 font-bold">TAG ID: {datos.tag}</span>
              <a href={fotoUrl || '#'} target="_blank" className="text-blue-500 text-[9px] font-black underline">VER FOTO</a>
            </div>

            <div className="text-center py-4">
              <p className="text-[10px] text-zinc-500 font-bold mb-2 tracking-[0.3em]">Totalizador</p>
              <p className="text-7xl font-black text-green-500 tracking-tighter tabular-nums">{datos.totalizador}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'MASA', v: datos.masa }, { l: 'TEMP', v: datos.temp }, { l: 'DENS', v: datos.dens }
              ].map((it, i) => (
                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-[8px] text-zinc-500 mb-1 font-black">{it.l}</p>
                  <p className="text-sm font-black text-white">{it.v}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 space-y-3">
              <button 
                onClick={guardarFinal} 
                disabled={loading}
                className="w-full py-5 bg-blue-600 rounded-3xl font-black text-xs tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-transform"
              >
                {loading ? "GUARDANDO..." : "CONFIRMAR LECTURA"}
              </button>
              <button onClick={() => {setDatos(null); setFotoUrl(null);}} className="w-full text-zinc-600 text-[9px] font-black py-2">
                Descartar registro
              </button>
            </div>
          </div>
        )}

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}