'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'refineria_assets'; 
const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";

export default function AcidoGraso() {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [datos, setDatos] = useState<any>(null); // Usado para manejar el estado de "foto capturada"
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const [vacioLectura, setVacioLectura] = useState<number>(0);
  const [tanque, setTanque] = useState<'T1' | 'T2'>('T1');
  const [variedad, setVariedad] = useState('ALTO OLEICO');
  const [esReproceso, setEsReproceso] = useState(false);
  const [observaciones, setObservaciones] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuración de Tanques
  const CONFIG_TANQUES = {
    T1: { factor: 107, alturaMax: 488 },
    T2: { factor: 211, alturaMax: 610 }
  };

  // Cálculo de KG automáticos
  const calcularKg = () => {
    const config = CONFIG_TANQUES[tanque];
    const alturaReal = config.alturaMax - vacioLectura;
    const kgResult = alturaReal * config.factor;
    return kgResult > 0 ? kgResult : 0;
  };

  // PERSISTENCIA
  useEffect(() => {
    const backup = localStorage.getItem('backup_acido_graso');
    if (backup) {
      const p = JSON.parse(backup);
      setDatos(p.datos);
      setFotoUrl(p.fotoUrl);
      setVacioLectura(p.vacioLectura || 0);
      setTanque(p.tanque || 'T1');
      setVariedad(p.variedad || 'ALTO OLEICO');
      setEsReproceso(p.esReproceso || false);
      setObservaciones(p.observaciones || '');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('backup_acido_graso', JSON.stringify({
      datos, fotoUrl, vacioLectura, tanque, variedad, esReproceso, observaciones
    }));
  }, [datos, fotoUrl, vacioLectura, tanque, variedad, esReproceso, observaciones]);

  const resetTodo = () => {
    localStorage.removeItem('backup_acido_graso'); 
    setLoading(false);
    setDatos(null);
    setFotoUrl(null);
    setVacioLectura(0);
    setObservaciones('');
    setStatusText('');
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusText('Subiendo Evidencia...');

    try {
      const fileName = `acido_graso_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      setFotoUrl(publicUrl);
      setDatos({ status: 'capturado' }); // Marca que ya hay una foto lista
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleConfirmarYGuardar = async () => {
    const kgFinales = calcularKg();
    setLoading(true);
    try {
      const { error } = await supabase.from('operaciones_refineria').insert([{
          tipo_operacion: 'ACIDO_GRASO',
          valor_lectura: kgFinales, 
          detalle_vacio: vacioLectura,
          tanque_id: tanque,
          foto_url: fotoUrl,
          observaciones: observaciones,
          usuario_registro: 'Operador Ácido Graso',
          variedad: variedad,
          es_reproceso: esReproceso
      }]);
      if (error) throw error;
      alert("✅ REGISTRO EXITOSO");
      resetTodo(); 
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleWhatsApp = () => {
    const kg = calcularKg();
    const msg = `*REPORTE ÁCIDO GRASO*%0A` +
                `*Tanque:* ${tanque}%0A` +
                `*Lectura Vacío:* ${vacioLectura} CM%0A` +
                `*Total Calculado:* ${kg.toLocaleString()} KG%0A` +
                `*Variedad:* ${variedad}%0A` +
                `*Proceso:* ${esReproceso ? 'REPROCESO' : 'NORMAL'}%0A` +
                `*Observaciones:* ${observaciones || 'Sin notas'}%0A` +
                `*Foto:* ${fotoUrl || 'No adjunta'}`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-zinc-900 border border-white/10 p-3 rounded-2xl">
            <span className="text-[10px] font-black text-zinc-400">VOLVER</span>
          </button>
          <h1 className="flex-1 text-orange-500 font-black text-[10px] tracking-[0.3em] text-center">ÁCIDO GRASO OROJUEZ</h1>
        </header>

        {/* SELECTORES DE CONFIGURACIÓN */}
        <div className={`bg-zinc-900 p-6 rounded-[30px] border border-white/5 space-y-4 ${(datos || loading) ? 'opacity-40 pointer-events-none' : ''}`}>
           <div className="grid grid-cols-2 gap-3">
             <button onClick={() => setTanque('T1')} className={`py-4 rounded-2xl font-black text-[10px] border ${tanque === 'T1' ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-white/5 bg-black'}`}>TANQUE T1</button>
             <button onClick={() => setTanque('T2')} className={`py-4 rounded-2xl font-black text-[10px] border ${tanque === 'T2' ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-white/5 bg-black'}`}>TANQUE T2</button>
           </div>
           
           <select value={variedad} onChange={(e) => setVariedad(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xs font-bold text-white focus:outline-none">
              <option value="ALTO OLEICO">ALTO OLEICO</option>
              <option value="GUINENSIS">GUINENSIS</option>
            </select>

           <button onClick={() => setEsReproceso(!esReproceso)} className={`w-full p-4 rounded-2xl border flex justify-between items-center ${esReproceso ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-black'}`}>
             <span className="text-[10px] font-black tracking-widest">{esReproceso ? 'ES REPROCESO ✅' : 'PROCESO NORMAL'}</span>
             <div className={`w-4 h-4 rounded-full ${esReproceso ? 'bg-red-500' : 'bg-zinc-800'}`}></div>
           </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center p-10 bg-zinc-900/40 rounded-[40px] border-2 border-orange-900/30">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-orange-500 font-black text-[11px] tracking-widest uppercase mb-4">{statusText}</p>
          </div>
        ) : !datos ? (
          <div className="flex flex-col items-center border-2 border-dashed border-zinc-800 rounded-[40px] p-10 bg-zinc-900/20">
            <button onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-full bg-orange-600 flex items-center justify-center shadow-2xl">
              <span className="text-4xl">📸</span>
            </button>
            <p className="mt-8 text-zinc-600 text-[11px] font-black tracking-widest uppercase">CAPTURAR EVIDENCIA VACÍO</p>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 space-y-6 animate-in zoom-in">
            <div className="text-center py-4 border-b border-white/5">
                <p className="text-[11px] text-zinc-500 font-black tracking-[.2em]">LECTURA VACÍO (CM)</p>
                <input 
                  type="number"
                  value={vacioLectura || ''}
                  onChange={(e) => setVacioLectura(Number(e.target.value))}
                  className="w-full bg-transparent text-6xl font-black text-orange-500 tracking-tighter tabular-nums text-center focus:outline-none"
                  placeholder="0"
                />
                <div className="mt-4 p-3 bg-black/50 rounded-2xl">
                  <p className="text-[9px] text-zinc-500 font-bold">PESO CALCULADO</p>
                  <p className="text-2xl font-black text-white">{calcularKg().toLocaleString()} KG</p>
                </div>
                <a href={fotoUrl!} target="_blank" className="text-[10px] text-orange-500 underline block mt-4 font-black tracking-widest uppercase">REVISAR EVIDENCIA</a>
            </div>
            
            <textarea 
              value={observaciones} 
              onChange={(e) => setObservaciones(e.target.value)} 
              className="w-full bg-black/40 rounded-2xl p-4 text-[10px] text-white border border-white/5" 
              placeholder="NOTAS ADICIONALES..." 
            />

            <button onClick={handleWhatsApp} className="w-full py-4 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-3">
              <span className="text-lg">💬</span>
              <span className="text-[10px] font-black text-emerald-400">ENVIAR REPORTE POR WHATSAPP</span>
            </button>
            
            <div className="grid grid-cols-2 gap-3">
                <button onClick={resetTodo} className="py-5 bg-zinc-800 rounded-2xl font-black text-[9px] text-red-400">REPROCESAR (FOTO)</button>
                <button onClick={handleConfirmarYGuardar} className="py-5 bg-orange-600 rounded-2xl font-black text-[9px]">GUARDAR REGISTRO</button>
            </div>
          </div>
        )}
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}