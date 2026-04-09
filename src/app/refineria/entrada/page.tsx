'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LectorIndustrial() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. EFECTO DE PERSISTENCIA: Al cargar la página, ver si había un proceso pendiente
  useEffect(() => {
    const savedTicket = localStorage.getItem('last_ticket_id');
    if (savedTicket) {
      console.log("Reanudando seguimiento de ticket:", savedTicket);
      setTicketId(savedTicket);
      setLoading(true); // Mostrar estado de carga mientras espera a Supabase
    }
  }, []);

  // 2. EFECTO REALTIME: Escuchar a Supabase cuando el ticketId cambie
  useEffect(() => {
    if (!ticketId) return;

    // Guardar en el navegador por si se refresca la página
    localStorage.setItem('last_ticket_id', ticketId);

    const channel = supabase
      .channel(`seguimiento-${ticketId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'lecturas_ia', 
          filter: `id=eq.${ticketId}` 
        },
        (payload) => {
          console.log('Cambio en base de datos:', payload.new);
          
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
            localStorage.removeItem('last_ticket_id'); // Proceso terminado, borrar ticket
          } else if (payload.new.status === 'error') {
            alert("Error en la lectura de IA. Intente con otra foto.");
            setLoading(false);
            setTicketId(null);
            localStorage.removeItem('last_ticket_id');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  // 3. ENVIAR FOTO A HUGGING FACE (ASÍNCRONO)
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Usamos el endpoint /upload que devuelve el ticket de inmediato
      const res = await fetch("https://orojuezsa-lector-ocr-industrial.hf.space/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Servidor no disponible");

      const data = await res.json();
      setTicketId(data.ticket_id); // Esto dispara el useEffect de Realtime
    } catch (err) {
      console.error(err);
      alert("Error al conectar con la IA. Verifique su conexión.");
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
        observaciones: `Confirmado - Tag: ${datos.tag}`
      }]);
      
      if (error) throw error;
      alert("✅ Datos registrados correctamente.");
      setDatos(null);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const regresarAlMenu = () => {
    // El proceso en el servidor NO se detiene si sales de aquí
    window.location.href = '/dashboard_principal'; 
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* HEADER CON BOTÓN SALIR SIEMPRE ACTIVO */}
        <header className="flex items-center justify-between py-4 border-b border-white/10 relative">
          <button 
            onClick={regresarAlMenu}
            className="absolute left-0 text-zinc-500 hover:text-white flex items-center gap-1.5 transition-colors z-50 p-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest">Salir</span>
          </button>

          <h1 className="text-blue-500 font-bold tracking-widest text-xs uppercase w-full text-center">
            Refinería OroJuez
          </h1>
        </header>

        {!datos ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[40px] p-16 bg-zinc-900/30 shadow-inner">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !!ticketId} 
              className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                (loading || ticketId) 
                ? 'bg-zinc-800 animate-pulse cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 active:scale-95'
              }`}
            >
              {ticketId ? (
                <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            <p className="mt-8 text-zinc-500 text-[10px] tracking-[0.2em] uppercase font-bold text-center leading-relaxed">
              {ticketId 
                ? "La IA está trabajando en segundo plano.\nPuedes salir; te avisaremos al volver." 
                : "Capturar Visor Masico"}
            </p>
          </div>
        ) : (
          /* PANTALLA DE RESULTADOS */
          <div className="bg-zinc-900 rounded-[32px] p-6 border border-white/5 space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Dispositivo</span>
              <span className="text-blue-400 font-mono text-xs font-bold">{datos.tag}</span>
            </div>

            <div className="text-center space-y-1 py-4">
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Totalizador</p>
              <p className="text-6xl font-black text-green-500 tracking-tighter">{datos.totalizador}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Masa (kg/h)', val: datos.masa },
                { label: 'Temp (°C)', val: datos.temp },
                { label: 'Dens (kg/l)', val: datos.dens }
              ].map((item, i) => (
                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-[9px] text-zinc-500 uppercase mb-1">{item.label}</p>
                  <p className="text-sm font-bold text-white">{item.val}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 space-y-3">
              <button 
                onClick={guardarEnDB}
                disabled={loading}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-sm tracking-widest transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50"
              >
                {loading ? "GUARDANDO..." : "CONFIRMAR LECTURA"}
              </button>
              <button 
                onClick={() => setDatos(null)}
                className="w-full py-2 text-[10px] text-zinc-600 hover:text-white font-bold uppercase tracking-widest transition-colors"
              >
                Descartar y repetir
              </button>
            </div>
          </div>
        )}

        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          onChange={handleCapture} 
          className="hidden" 
        />
      </div>
    </div>
  );
}