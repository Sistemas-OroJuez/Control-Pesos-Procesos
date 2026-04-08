'use client';
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function InventarioDS3() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [producto, setProducto] = useState<'ACP' | 'RBD'>('ACP'); // Selector de producto
  const [valorManual, setValorManual] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileName = `${Date.now()}_inventario_${producto.toLowerCase()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('refineria_assets')
        .upload(fileName, file);

      if (uploadError) throw new Error("Error al subir foto");

      const { data: urlData } = supabase.storage
        .from('refineria_assets')
        .getPublicUrl(fileName);

      setFotoUrl(urlData.publicUrl);
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardar = async () => {
    if (!valorManual || isNaN(Number(valorManual))) {
      alert("Por favor, ingrese un valor válido.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('operaciones_refineria')
        .insert([{
          tipo_operacion: 'INVENTARIO_PROCESO',
          valor_lectura: parseFloat(valorManual), 
          foto_url: fotoUrl || null, // Foto opcional
          observaciones: `Inventario de ${producto}. ${observaciones}`,
          usuario_registro: 'Operador Inventario',
          metadata: { producto_inventariado: producto }, // Guardamos qué producto es
          masa_kg_h: 0,
          temperatura_c: 0,
          densidad_kg_l: 0
        }]);

      if (error) throw error;
      alert(`✅ Inventario de ${producto} guardado.`);
      setValorManual('');
      setFotoUrl(null);
      setObservaciones('');
    } catch (error: any) {
      alert("Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-md mx-auto bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-800">
        
        {/* HEADER: Color Gris/Plata para Inventario */}
        <div className="p-6 bg-slate-700 text-white text-center border-b-4 border-slate-900">
          <h2 className="text-[10px] font-black uppercase tracking-widest opacity-70">Control de Existencias</h2>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">INVENTARIO DS3</h1>
        </div>

        <div className="p-5 space-y-6">
          
          {/* SELECTOR DE PRODUCTO (ACP / RBD) */}
          <div className="flex bg-gray-900 p-1 rounded-2xl border border-gray-800">
            <button 
              onClick={() => setProducto('ACP')}
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${producto === 'ACP' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}
            >
              EXISTENCIA ACP
            </button>
            <button 
              onClick={() => setProducto('RBD')}
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${producto === 'RBD' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500'}`}
            >
              EXISTENCIA RBD
            </button>
          </div>

          {/* INPUT MANUAL */}
          <div className={`bg-gray-900 p-6 rounded-2xl border-2 transition-colors ${producto === 'ACP' ? 'border-blue-900/30' : 'border-green-900/30'}`}>
            <label className={`text-[10px] font-black uppercase mb-2 block text-center tracking-widest ${producto === 'ACP' ? 'text-blue-400' : 'text-green-400'}`}>
              Lectura en Tanques ({producto})
            </label>
            <input 
              type="number" 
              inputMode="decimal"
              value={valorManual}
              onChange={(e) => setValorManual(e.target.value)}
              placeholder="0.00"
              className="bg-transparent text-5xl font-black text-white w-full text-center outline-none placeholder:text-gray-800"
            />
            <span className="block text-center text-gray-600 text-[10px] mt-2 font-bold uppercase">Kilogramos Totales</span>
          </div>

          {/* FOTO OPCIONAL */}
          <div className="text-center">
            {fotoUrl ? (
              <div className="relative">
                <img src={fotoUrl} className="w-full h-40 object-cover rounded-xl border-2 border-slate-500" />
                <button onClick={() => setFotoUrl(null)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-8 h-8 font-bold border-2 border-[#1a1a1a]">✕</button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-full py-6 border-2 border-dashed border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:border-slate-500 transition-all"
              >
                <span className="text-3xl mb-1">📸</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Foto de Nivel / Regleta</span>
                <span className="text-[8px] opacity-40 mt-1">(Opcional)</span>
              </button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleCapture} />
          </div>

          <textarea 
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-gray-900 rounded-xl p-3 text-white text-[10px] border-none h-20"
            placeholder="Especificar tanques (ej: Tanque 1 y 4)..."
          />

          <button 
            onClick={handleGuardar}
            disabled={loading || !valorManual}
            className={`w-full py-4 rounded-xl font-black text-white text-xs tracking-[0.2em] shadow-lg transition-all ${
              loading || !valorManual 
                ? 'bg-gray-700' 
                : 'bg-slate-600 hover:bg-slate-500 shadow-slate-900/40'
            }`}
          >
            {loading ? 'PROCESANDO...' : `REGISTRAR INVENTARIO ${producto}`}
          </button>
        </div>
      </div>
    </div>
  );
}