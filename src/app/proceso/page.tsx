'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ProcesoLlenado() {
  const router = useRouter();
  const [batchId, setBatchId] = useState('Cargando...');
  const [listaVariedades, setListaVariedades] = useState([]);
  const [listaProveedores, setListaProveedores] = useState([]);
  const [loading, setLoading] = useState(false);

  const [datos, setDatos] = useState({
    variedad: '', proveedor: '', turno: 'T1', peso_final: '', observaciones: ''
  });

  const [fotos, setFotos] = useState({
    visor_cero: { url: '', hora: null },
    tanque_vacio: { url: '', hora: null },
    visor_lleno: { url: '', hora: null },
    incidencia: { url: '' }
  });

  useEffect(() => {
    async function inicializarModulo() {
      const hoy = new Date();
      const d = String(hoy.getDate()).padStart(2, '0');
      const m = String(hoy.getMonth() + 1).padStart(2, '0');
      const a = String(hoy.getFullYear()).slice(-2);
      const prefix = `EXT${d}${m}${a}`;
      
      const { count } = await supabase
        .from('procesos_batch')
        .select('*', { count: 'exact', head: true })
        .filter('batch_id', 'ilike', `${prefix}%`);
      
      setBatchId(`${prefix}${String((count || 0) + 1).padStart(2, '0')}`);

      const { data: params } = await supabase.from('parametros').select('*').eq('activo', true);
      if (params) {
        setListaVariedades(params.filter(p => p.categoria === 'variedad'));
        setListaProveedores(params.filter(p => p.categoria === 'proveedor'));
      }
    }
    inicializarModulo();
  }, []);

  const capturarFoto = (campo) => {
    const horaActual = new Date().toISOString();
    const linkSimulado = `https://github.com/OroJuez/app/raw/main/fotos/${batchId}_${campo}.jpg`;
    setFotos(prev => ({ ...prev, [campo]: { url: linkSimulado, hora: horaActual } }));
  };

  const guardarBatch = async () => {
    if (!datos.peso_final || !fotos.visor_lleno.hora || !datos.variedad) {
      alert("⚠️ Error: Complete variedad, peso y foto del visor lleno.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('procesos_batch').insert([{
      batch_id: batchId,
      turno: datos.turno,
      variedad: datos.variedad,
      proveedor: datos.proveedor,
      peso_valor_operador: parseFloat(datos.peso_final),
      observaciones: datos.observaciones,
      foto_visor_cero_url: fotos.visor_cero.url,
      hora_foto_visor_cero: fotos.visor_cero.hora,
      foto_tanque_vacio_url: fotos.tanque_vacio.url,
      hora_foto_tanque_vacio: fotos.tanque_vacio.hora,
      foto_visor_lleno_url: fotos.visor_lleno.url,
      hora_foto_visor_lleno: fotos.visor_lleno.hora,
      foto_incidencia_url: fotos.incidencia.url,
      fecha_hora_inicio: fotos.visor_cero.hora || new Date().toISOString(),
      fecha_hora_fin: new Date().toISOString()
    }]);

    if (!error) {
      alert("✅ BATCH GUARDADO CORRECTAMENTE");
      router.push('/dashboard');
    } else {
      alert("❌ Error: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <nav className="bg-red-700 text-white p-4 sticky top-0 z-50 flex items-center justify-between shadow-lg">
        <img src="/logo-orojuez.jpg" className="h-12 bg-white rounded p-1" />
        <div className="text-right">
          <p className="text-[10px] font-bold opacity-70 tracking-tighter uppercase">Identificador Batch</p>
          <p className="text-xl font-black font-mono">{batchId}</p>
        </div>
      </nav>

      <div className="p-4 space-y-6">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200 space-y-4">
          <div className="grid grid-cols-2 gap-3">
             <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 ml-1 mb-1 uppercase">Turno</label>
                <select className="p-3 bg-gray-100 rounded-xl font-bold text-sm" value={datos.turno} onChange={e=>setDatos({...datos, turno: e.target.value})}>
                  <option value="T1">T1 (Mañana)</option>
                  <option value="T2">T2 (Noche)</option>
                </select>
             </div>
             <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 ml-1 mb-1 uppercase">Variedad</label>
                <select className="p-3 bg-gray-100 rounded-xl font-bold text-sm" onChange={e=>setDatos({...datos, variedad: e.target.value})}>
                  <option value="">Seleccione...</option>
                  {listaVariedades.map(v => <option key={v.id} value={v.valor}>{v.valor}</option>)}
                </select>
             </div>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-gray-400 ml-1 mb-1 uppercase">Proveedor Materia Prima</label>
            <select className="p-3 bg-gray-100 rounded-xl font-bold text-sm w-full" onChange={e=>setDatos({...datos, proveedor: e.target.value})}>
              <option value="">Seleccione Proveedor...</option>
              {listaProveedores.map(p => <option key={p.id} value={p.valor}>{p.valor}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => capturarFoto('visor_cero')} className={`p-5 rounded-3xl border-2 flex flex-col items-center gap-2 ${fotos.visor_cero.hora ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white'}`}>
            <span className="text-3xl">⚖️</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Visor 0</span>
          </button>
          <button onClick={() => capturarFoto('tanque_vacio')} className={`p-5 rounded-3xl border-2 flex flex-col items-center gap-2 ${fotos.tanque_vacio.hora ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white'}`}>
            <span className="text-3xl">🗑️</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Tanque Vacío</span>
          </button>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-inner border border-gray-200 space-y-4">
          <button onClick={() => capturarFoto('visor_lleno')} className={`w-full p-4 rounded-2xl border-2 flex items-center justify-center gap-3 font-black text-xs uppercase ${fotos.visor_lleno.hora ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-600 bg-red-50 text-red-700'}`}>
            📸 FOTO VISOR LLENO
          </button>
          <input 
            type="number" 
            placeholder="0.00" 
            className="w-full p-6 bg-gray-50 border-4 border-gray-900 rounded-3xl text-center text-5xl font-black"
            onChange={e=>setDatos({...datos, peso_final: e.target.value})}
          />
        </div>

        <div className="space-y-3">
          <textarea 
            placeholder="Observaciones de este batch..." 
            className="w-full p-4 border rounded-2xl bg-white h-24 text-sm font-medium shadow-sm"
            onChange={e=>setDatos({...datos, observaciones: e.target.value})}
          ></textarea>
          <button onClick={() => capturarFoto('incidencia')} className={`w-full p-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-[10px] font-bold ${fotos.incidencia.url ? 'bg-amber-100 border-amber-500 text-amber-700' : 'border-amber-300 text-amber-500'}`}>
            ⚠️ {fotos.incidencia.url ? 'FOTO DE INCIDENCIA REGISTRADA' : 'TOMAR FOTO DE NOVEDAD (OPCIONAL)'}
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200">
        <button 
          onClick={guardarBatch}
          disabled={loading}
          className="w-full bg-red-700 text-white py-5 rounded-2xl font-black shadow-xl uppercase tracking-widest active:scale-95 disabled:opacity-50 transition-all"
        >
          {loading ? 'PROCESANDO...' : 'FINALIZAR BATCH'}
        </button>
      </div>
    </div>
  );
}
