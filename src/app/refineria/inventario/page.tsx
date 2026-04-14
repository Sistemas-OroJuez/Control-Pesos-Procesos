'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'refineria_assets'; 
const DASHBOARD_URL = "https://produccionorj23.vercel.app/dashboard";

export default function InventarioRefineria() {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [valorKg, setValorKg] = useState<string>('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); 
  const [observaciones, setObservaciones] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // PERSISTENCIA LOCAL
  useEffect(() => {
    const backup = localStorage.getItem('backup_inv_ds3');
    if (backup) {
      const p = JSON.parse(backup);
      setValorKg(p.valorKg || '');
      setFotoUrl(p.fotoUrl || null);
      setObservaciones(p.observaciones || '');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('backup_inv_ds3', JSON.stringify({
      valorKg, fotoUrl, observaciones
    }));
  }, [valorKg, fotoUrl, observaciones]);

  const resetTodo = () => {
    localStorage.removeItem('backup_inv_ds3'); 
    setValorKg('');
    setFotoUrl(null);
    setObservaciones('');
    setLoading(false);
    setStatusText('');
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatusText('Subiendo Evidencia Opcional...');
    try {
      const fileName = `inv_refineria_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      setFotoUrl(publicUrl);
    } catch (err: any) {
      alert("Error al subir foto: " + err.message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const ejecutarGuardado = async () => {
    if (!valorKg || parseFloat(valorKg) < 0) {
      alert("Por favor, ingrese el valor de ACP en KG.");
      return null;
    }
    const { error } = await supabase.from('operaciones_refineria').insert([{
        tipo_operacion: 'INVENTARIO_REFINERIA', // Vinculado a DS3 en el balance
        valor_lectura: parseFloat(valorKg),
        foto_url: fotoUrl,
        observaciones: observaciones,
        usuario_registro: 'Jefe de Área Refinería'
    }]);
    if (error) throw error;
    return true;
  };

  const handleConfirmarSoloGuardar = async () => {
    setLoading(true);
    try {
      await ejecutarGuardado();
      alert("✅ INVENTARIO REGISTRADO EN SISTEMA");
      resetTodo();
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleWhatsApp = async () => {
    setLoading(true);
    setStatusText('Guardando en base de datos...');
    try {
      const exito = await ejecutarGuardado();
      if (!exito) return;

      const msg = `*REPORTE INVENTARIO REFINERÍA (DS3)*%0A` +
                  `*Producto:* ACEITE CRUDO DE PALMA (ACP)%0A` +
                  `*Cantidad:* ${parseFloat(valorKg).toLocaleString()} KG%0A` +
                  `*Observaciones:* ${observaciones || 'Sin notas'}%0A` +
                  `*Evidencia:* ${fotoUrl || 'No adjunta'}%0A%0A` +
                  `✅ _VALOR ACTUALIZADO PARA BALANCE DE MASA_`;

      window.open(`https://wa.me/?text=${msg}`, '_blank');
      resetTodo();
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex items-center py-4 border-b border-white/10 gap-4">
          <button onClick={() => window.location.href = DASHBOARD_URL} className="bg-zinc-900 border border-white/10 p-3 rounded-2xl text-[10px] font-black text-zinc-400">
            VOLVER
          </button>
          <h1 className="flex-1 text-blue-500 font-black text-[10px] tracking-[0.3em] text-center">INVENTARIO REFINERÍA (DS3)</h1>
        </header>

        {loading ? (
          <div className="flex flex-col items-center p-10 bg-zinc-900/40 rounded-[40px] border-2 border-blue-900/30">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-blue-500 font-black text-[11px] tracking-widest uppercase">{statusText}</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* INPUT DE VALOR PRINCIPAL */}
            <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/5 text-center">
                <p className="text-[11px] text-zinc-500 font-black tracking-[.2em] mb-4">INGRESE ACP EN CIRCULACIÓN (KG)</p>
                <input 
                  type="number"
                  inputMode="decimal"
                  value={valorKg}
                  onChange={(e) => setValorKg(e.target.value)}
                  className="w-full bg-transparent text-6xl font-black text-blue-400 tracking-tighter tabular-nums text-center focus:outline-none"
                  placeholder="0"
                />
            </div>

            {/* FOTO OPCIONAL */}
            <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-3xl border border-white/5">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${fotoUrl ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  {fotoUrl ? '✅' : '📸'}
                </button>
                <div className="flex-1">
                    <p className="text-[10px] font-black text-white">FOTO DE EVIDENCIA</p>
                    <p className="text-[9px] text-zinc-500">{fotoUrl ? 'IMAGEN CARGADA' : 'OPCIONAL (CLICK PARA CAPTURAR)'}</p>
                </div>
                {fotoUrl && <button onClick={() => setFotoUrl(null)} className="text-[9px] font-black text-red-500">QUITAR</button>}
            </div>

            <textarea 
              value={observaciones} 
              onChange={(e) => setObservaciones(e.target.value)} 
              className="w-full bg-zinc-900/40 rounded-2xl p-4 text-[10px] text-white border border-white/5 outline-none focus:border-blue-500/50" 
              placeholder="OBSERVACIONES DEL JEFE DE ÁREA..." 
              rows={3}
            />

            <div className="space-y-3">
                <button onClick={handleWhatsApp} className="w-full py-4 bg-emerald-600 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-emerald-900/20">
                  <span className="text-lg">💬</span>
                  <span className="text-[10px] font-black text-white">GUARDAR Y NOTIFICAR WHATSAPP</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                    <button onClick={resetTodo} className="py-5 bg-zinc-800 rounded-2xl font-black text-[9px] text-zinc-400 active:scale-95 transition-all">LIMPIAR</button>
                    <button onClick={handleConfirmarSoloGuardar} className="py-5 bg-blue-600 rounded-2xl font-black text-[9px] text-white active:scale-95 transition-all">SOLO GUARDAR</button>
                </div>
            </div>
          </div>
        )}
        
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>
    </div>
  );
}