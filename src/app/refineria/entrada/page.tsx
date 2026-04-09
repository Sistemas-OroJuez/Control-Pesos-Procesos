'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
// Importa un icono de flecha si usas una librería, si no, usaré texto plano
// import { ArrowLeftIcon } from '@heroicons/react/24/outline'; 

export default function LectorIndustrial() {
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null); // Nuevo estado para el ticket
  const [datos, setDatos] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- NUEVA LÓGICA: Suscripción en Tiempo Real ---
  useEffect(() => {
    // Si no tenemos ID de ticket, no hacemos nada
    if (!ticketId) return;

    console.log(`📡 Escuchando cambios para el ticket: ${ticketId}`);

    // Crear el canal de Supabase Realtime
    const channel = supabase
      .channel(`seguimiento-lectura-${ticketId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', // Solo nos interesan las actualizaciones
          schema: 'public', 
          table: 'lecturas_ia', // Asegúrate de que el nombre de tabla sea el mismo del SQL
          filter: `id=eq.${ticketId}` // Filtrar solo por nuestro ticket
        },
        (payload) => {
          console.log('🔄 Cambio detectado en Supabase:', payload.new);
          
          if (payload.new.status === 'completado') {
            // La IA terminó con éxito, mapeamos los datos para UI
            setDatos({
              tag: payload.new.tag_id,
              totalizador: payload.new.totalizador,
              masa: payload.new.masa,
              temp: payload.new.temperatura,
              dens: payload.new.densidad
            });
            setLoading(false);
            setTicketId(null); // Limpiamos el ticket ya procesado
          } else if (payload.new.status === 'error') {
            console.error('❌ Error en IA:', payload.new.ia_raw);
            alert(`Error al procesar la imagen: ${payload.new.ia_raw || 'Intente nuevamente con mejor luz.'}`);
            setLoading(false);
            setTicketId(null);
          }
        }
      )
      .subscribe();

    // Limpieza al desmontar el componente
    return () => {
      console.log('🔇 Desconectando radar Realtime');
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  // --- FUNCIÓN DE ENVÍO ASÍNCRONO (NUEVA) ---
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log("Enviando imagen para procesamiento en segundo plano...");
      
      // CAMBIO DE ENDPOINT A /upload (Instantáneo)
      const res = await fetch("https://orojuezsa-lector-ocr-industrial.hf.space/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Error en la respuesta del servidor");

      const data = await res.json();
      console.log("Ticket generado con éxito:", data.ticket_id); 
      
      // Guardamos el ticket ID para activar el radar Realtime
      setTicketId(data.ticket_id); 

    } catch (err) {
      console.error("ERROR AL SUBIR:", err);
      alert("Error de conexión con el servidor. Verifique internet.");
      setLoading(false);
    }
  };

  const guardarEnDB = async () => {
    if (!datos) return;
    setLoading(true);
    try {
      // Usando tu tabla original operaciones_refineria para el guardado final
      const { error } = await supabase.from('operaciones_refineria').insert([{
        valor_lectura: parseFloat(datos.totalizador),
        masa_kg_h: parseFloat(datos.masa),
        temperatura_c: parseFloat(datos.temp),
        densidad_kg_l: parseFloat(datos.dens),
        observaciones: `Registro Confirmado IA - Tag: ${datos.tag}`
      }]);
      
      if (error) throw error;
      alert("✅ Datos guardados en Supabase");
      setDatos(null);
    } catch (e: any) {
      alert("Error al guardar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para resetear todo y volver al estado inicial de escaneo
  const volverAIntentar = () => {
    setDatos(null);
    setTicketId(null);
    setLoading(false);
  };

  // Función para salir completamente (Regresar al menú principal)
  const regresarAlMenu = () => {
    volverAIntentar();
    // Reemplaza '/' por la ruta de tu menú principal
    window.location.href = '/dashboard_principal'; 
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="flex items-center justify-between py-4 border-b border-white/10 relative">
          {/* BOTÓN REGRESAR (NUEVO) */}
          <button 
            onClick={regresarAlMenu}
            disabled={loading} // No dejar salir si está subiendo la imagen inicial
            className="absolute left-0 text-zinc-500 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            {/* Reemplazar ArrowLeftIcon por SVG si no tienes librería */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest">Salir</span>
          </button>

          <h1 className="text-blue-500 font-bold tracking-widest text-xs uppercase w-full text-center">
            Refinería OroJuez - Lector v2
          </h1>
        </header>

        {/* --- PANTALLA INICIAL: Escanear o Esperando Ticket --- */}
        {!datos ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[40px] p-16 bg-zinc-900/30">
            <button 
              onClick={() => fileInputRef.current?.click()}
              // No dejar presionar si ya está en proceso
              disabled={loading || !!ticketId} 
              className={`w-28 h-28 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-900/40 active:scale-95 transition-transform ${(loading || !!ticketId) ? 'animate-pulse opacity-50' : 'hover:bg-blue-500'}`}
            >
              {ticketId ? (
                // Icono de reloj esperando
                <svg className="w-12 h-12 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                // Icono de cámara original
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            <p className="mt-6 text-zinc-500 text-[10px] tracking-[0.2em] uppercase font-bold text-center">
              {ticketId 
                ? "Imagen recibida. Procesando en refinería (5-10 min aprox)..." 
                : (loading ? "Iniciando proceso..." : "Escanear Medidor")}
            </p>
          </div>
        ) : (
          // --- PANTALLA DE RESULTADOS (IA TERMINÓ) ---
          <div className="bg-zinc-900 rounded-[32px] p-6 border border-white/5 space-y-6">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Tag</span>
              <span className="text-blue-400 font-mono text-xs font-bold">{datos.tag}</span>
            </div>

            <div className="text-center space-y-1">
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Totalizador Principal</p>
              <p className="text-6xl font-black text-green-500 tracking-tighter">{datos.totalizador}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Masa', val: datos.masa },
                { label: 'Temp', val: datos.temp },
                { label: 'Dens', val: datos.dens }
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
                disabled={loading} // Bloquear mientras guarda en DB
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-sm tracking-widest transition-all shadow-lg shadow-blue-900/20 disabled:opacity-30 disabled:pointer-events-none active:scale-95"
              >
                {loading ? "GUARDANDO..." : "CONFIRMAR Y GUARDAR"}
              </button>
              <button 
                onClick={volverAIntentar}
                className="w-full py-2 text-[10px] text-zinc-600 hover:text-zinc-300 font-bold uppercase tracking-widest transition-colors"
              >
                Escanear otra foto
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