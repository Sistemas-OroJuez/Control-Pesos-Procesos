'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LectorIndustrial() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Cargar estado persistente (por si refresca la página)
  useEffect(() => {
    const savedTicket = localStorage.getItem('last_ticket_id');
    const savedFoto = localStorage.getItem('last_foto_url');
    if (savedTicket) { setTicketId(savedTicket); setLoading(true); }
    if (savedFoto) setFotoUrl(savedFoto);
  }, []);

  // 2. Escuchar la respuesta de la IA en Realtime
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
            // No borramos la fotoUrl aquí para mostrarla junto a los resultados
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      // SUBIR A BUCKET (Evidencia)
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

      // ENVIAR A IA
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

  const guardarEnDB = async () => {
    if (!datos) return;
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
      alert("✅ Registro guardado exitosamente");
      setDatos(null);
      setFotoUrl(null);
      localStorage.removeItem('last_foto_url');
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans tracking-tight">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="flex items-center justify-between py-4 border-b border-white/10 relative">
          <button onClick={() => window.location.href='/dashboard_principal'} className="absolute left-0 text-zinc-500 p-2 active:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="text-blue-500 font-bold text-[11px] uppercase w-full text-center tracking-[0.2em]">Refinería OroJuez</h1>
        </header>

        {!datos ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[40px] p-8 bg-zinc-900/30">
            
            {/* LINK DE EVIDENCIA SI YA SE SUBIÓ FOTO */}
            {fotoUrl && (
              <div className="mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="relative inline-block group">
                  <img src={fotoUrl} className="w-44 h-44 object-cover rounded-[30px] border-2 border-blue-500/20 shadow-2xl shadow-blue-900/20" alt="Captura" />
                  <a 
                    href={fotoUrl} 
                    target="_blank" 
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-zinc-800 text-[9px] px-4 py-2 rounded-full font-bold border border-white/10 flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                  >
                    <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    VERIFICAR FOTO EN SUPABASE
                  </a>
                </div>
              </div>
            )}

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !!ticketId} 
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                (loading || ticketId) ? 'bg-zinc-800 animate-pulse' : 'bg-blue-600 shadow-xl shadow-blue-900/40 active:scale-90'
              }`}
            >
              {ticketId ? (
                <svg className="w-10 h-10 text-blue-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeWidth="2" strokeLinecap="round"/></svg>
              ) : (
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
              )}
            </button>
            <p className="mt-8 text-zinc-600 text-[10px] font-bold text-center leading-relaxed px-4">
              {ticketId 
                ? "LA IA ESTÁ ANALIZANDO LOS DATOS...\nEL PROCESO SEGUIRÁ AUNQUE SALGAS." 
                : "TOME UNA FOTO CLARA DEL VISOR PARA INICIAR EL PROCESO."}
            </p>
          </div>
        ) : (
          /* PANTALLA DE RESULTADOS */
          <div className="bg-zinc-900 rounded-[35px] p-6 border border-white/5 space-y-6">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">TAG: {datos.tag}</span>
              <a href={fotoUrl || '#'} target="_blank" className="text-blue-500 text-[9px] font-bold underline decoration-blue-500/30">VER EVIDENCIA</a>
            </div>

            <div className="text-center py-4">
              <p className="text-[10px] text-zinc-500 font-bold mb-2 uppercase tracking-[0.2em]">Totalizador</p>
              <p className="text-7xl font-black text-green-500 tracking-tighter">{datos.totalizador}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'MASA', v: datos.masa }, { l: 'TEMP', v: datos.temp }, { l: 'DENS', v: datos.dens }
              ].map((it, i) => (
                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-[8px] text-zinc-500 mb-1 font-bold">{it.l}</p>
                  <p className="text-sm font-black">{it.v}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 space-y-3">
              <button onClick={guardarEnDB} disabled={loading} className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-xs tracking-widest transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98]">
                {loading ? "GUARDANDO..." : "CONFIRMAR REGISTRO"}
              </button>
              <button onClick={() => {setDatos(null); setFotoUrl(null); localStorage.removeItem('last_foto_url');}} className="w-full text-[9px] text-zinc-600 font-bold uppercase tracking-widest py-2">
                Descartar y repetir
              </button>
            </div>
          </div>
        )}

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}