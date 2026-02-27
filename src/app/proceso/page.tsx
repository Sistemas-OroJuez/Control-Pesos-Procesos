'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ProcesoLlenado() {
  const router = useRouter();
  const [batchId, setBatchId] = useState('Cargando...');
  const [listaVariedades, setListaVariedades] = useState<any[]>([]);
  const [listaProveedores, setListaProveedores] = useState<any[]>([]);
  const [listaOperadores, setListaOperadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [datos, setDatos] = useState({
    operador: '', variedad: '', proveedor: '', turno: 'T1', peso_final: '', observaciones: ''
  });

  const [fotos, setFotos] = useState({
    visor_cero: { url: '', hora: null as string | null },
    tanque_vacio: { url: '', hora: null as string | null },
    visor_lleno: { url: '', hora: null as string | null },
    incidencia: { url: '' }
  });

  useEffect(() => {
    async function inicializar() {
      const hoy = new Date();
      const d = String(hoy.getDate()).padStart(2, '0');
      const m = String(hoy.getMonth() + 1).padStart(2, '0');
      const a = String(hoy.getFullYear()).slice(-2);
      const prefix = `EXT${d}${m}${a}`;
      
      const { count } = await supabase.from('procesos_batch').select('*', { count: 'exact', head: true }).filter('batch_id', 'ilike', `${prefix}%`);
      setBatchId(`${prefix}${String((count || 0) + 1).padStart(2, '0')}`);

      const { data: p } = await supabase.from('parametros').select('*').eq('activo', true);
      if (p) {
        setListaVariedades(p.filter((i: any) => i.categoria === 'variedad'));
        setListaProveedores(p.filter((i: any) => i.categoria === 'proveedor'));
        setListaOperadores(p.filter((i: any) => i.categoria === 'operador'));
      }
    }
    inicializar();
  }, []);

  const abrirCamara = async (campo: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const horaActual = new Date().toISOString();
        const linkFake = `https://github.com/OroJuez/img/raw/main/${batchId}_${campo}.jpg`;
        setFotos(prev => ({ ...prev, [campo]: { url: linkFake, hora: horaActual } }));
      }
    };
    input.click();
  };

  const guardarBatch = async () => {
    if (!datos.operador || !datos.peso_final || !fotos.visor_lleno.hora || !fotos.visor_cero.hora) {
      alert("⚠️ Error: Debe completar Operador, las fotos de inicio, foto de visor lleno y el peso final.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('procesos_batch').insert([{
      batch_id: batchId,
      turno: datos.turno,
      variedad: datos.variedad,
      proveedor: datos.proveedor,
      operador_email: datos.operador, // Aquí guardamos el nombre seleccionado
      peso_valor_operador: parseFloat(datos.peso_final),
      observaciones: datos.observaciones,
      foto_visor_cero_url: fotos.visor_cero.url,
      hora_foto_visor_cero: fotos.visor_cero.hora,
      foto_tanque_vacio_url: fotos.tanque_vacio.url,
      hora_foto_tanque_vacio: fotos.tanque_vacio.hora,
      foto_visor_lleno_url: fotos.visor_lleno.url,
      hora_foto_visor_lleno: fotos.visor_lleno.hora,
      foto_incidencia_url: fotos.incidencia.url,
      fecha_hora_inicio: fotos.visor_cero.hora,
      fecha_hora_fin: new Date().toISOString()
    }]);

    if (!error) {
      alert("✅ REGISTRO COMPLETO: " + batchId);
      router.push('/dashboard');
    } else {
      alert("Error: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-32">
      <nav className="bg-red-700 text-white p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
           <img src="/logo-orojuez.jpg" className="h-10 bg-white rounded p-1" />
           <span className="font-black text-sm tracking-tighter">ORO JUEZ SA</span>
        </div>
        <div className="text-right">
          <p className="text-lg font-black font-mono">{batchId}</p>
        </div>
      </nav>

      <div className="p-4 space-y-5">
        <section className="bg-white p-5 rounded-3xl shadow-sm space-y-4 border border-gray-200">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-red-700 mb-1">SELECCIONE EL OPERADOR</label>
            <select className="p-4 bg-gray-50 border-2 rounded-2xl font-bold text-sm" onChange={e=>setDatos({...datos, operador: e.target.value})}>
              <option value="">¿Quién está operando?</option>
              {listaOperadores.map((op: any) => <option key={op.id} value={op.valor}>{op.valor}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Turno</label>
                <select className="p-3 bg-gray-50 border rounded-xl font-bold" value={datos.turno} onChange={e=>setDatos({...datos, turno: e.target.value})}>
                  <option value="T1">T1</option>
                  <option value="T2">T2</option>
                </select>
             </div>
             <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Variedad</label>
                <select className="p-3 bg-gray-50 border rounded-xl font-bold" onChange={e=>setDatos({...datos, variedad: e.target.value})}>
                  <option value="">Producto...</option>
                  {listaVariedades.map((v: any) => <option key={v.id} value={v.valor}>{v.valor}</option>)}
                </select>
             </div>
          </div>
          <select className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm" onChange={e=>setDatos({...datos, proveedor: e.target.value})}>
            <option value="">Proveedor Materia Prima...</option>
            {listaProveedores.map((p: any) => <option key={p.id} value={p.valor}>{p.valor}</option>)}
          </select>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => abrirCamara('visor_cero')} className={`p-5 rounded-3xl border-2 flex flex-col items-center gap-2 ${fotos.visor_cero.hora ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-400'}`}>
            <span className="text-3xl">📷</span>
            <span className="text-[9px] font-black uppercase text-center">Inicio Visor<br/>Sin Peso (0)</span>
          </button>
          <button onClick={() => abrirCamara('tanque_vacio')} className={`p-5 rounded-3xl border-2 flex flex-col items-center gap-2 ${fotos.tanque_vacio.hora ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-400'}`}>
            <span className="text-3xl">🚜</span>
            <span className="text-[9px] font-black uppercase text-center">Foto<br/>Tanque Vacío</span>
          </button>
        </div>

        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 space-y-4">
          <button onClick={() => abrirCamara('visor_lleno')} className={`w-full p-4 rounded-2xl border-2 flex items-center justify-center gap-3 font-black text-xs uppercase ${fotos.visor_lleno.hora ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-700 bg-red-50 text-red-700'}`}>
            📸 Foto Visor Tanque Lleno
          </button>
          
          <div className="text-center">
            <label className="text-[10px] font-black text-gray-400 uppercase">Valor Kg (Digitado)</label>
            <input 
              type="number" 
              placeholder="0.00" 
              className="w-full p-5 bg-gray-50 border-4 border-gray-900 rounded-3xl text-center text-4xl font-black text-gray-800"
              onChange={e=>setDatos({...datos, peso_final: e.target.value})}
            />
          </div>
        </section>

        <div className="space-y-3">
          <textarea 
            placeholder="Observaciones de Novedades..." 
            className="w-full p-4 border-2 rounded-2xl bg-white h-24 text-sm font-semibold"
            onChange={e=>setDatos({...datos, observaciones: e.target.value})}
          ></textarea>
          
          <button onClick={() => abrirCamara('incidencia')} className={`w-full p-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-[10px] font-bold ${fotos.incidencia.url ? 'bg-amber-100 border-amber-600 text-amber-700' : 'border-amber-300 text-amber-500'}`}>
            ⚠️ {fotos.incidencia.url ? 'EVIDENCIA DE NOVEDAD OK' : 'FOTO JUSTIFICACIÓN (OPCIONAL)'}
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 border-t">
        <button onClick={guardarBatch} disabled={loading} className="w-full bg-red-700 text-white py-5 rounded-2xl font-black shadow-xl uppercase tracking-widest active:scale-95">
          {loading ? 'PROCESANDO...' : 'FINALIZAR BATCH'}
        </button>
      </div>
    </div>
  );
}
