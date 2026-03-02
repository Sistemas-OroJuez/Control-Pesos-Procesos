'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { subirImagen } from '@/lib/storage-utils';

export default function ProcesoLlenado() {
  const router = useRouter();
  const [batchId, setBatchId] = useState('Cargando...');
  const [listaVariedades, setListaVariedades] = useState<any[]>([]);
  const [listaProveedores, setListaProveedores] = useState<any[]>([]);
  const [listaTurnos, setListaTurnos] = useState<any[]>([]);
  const [listaOperadores, setListaOperadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [datos, setDatos] = useState({
    operador_id: '',
    variedad: '',
    proveedor: '',
    turno: '',
    peso_final: '',
    observaciones: ''
  });

  const [fotos, setFotos] = useState({
    visor_cero: { url: '', hora: null as string | null, archivo: null as File | null },
    tanque_vacio: { url: '', hora: null as string | null, archivo: null as File | null },
    visor_lleno: { url: '', hora: null as string | null, archivo: null as File | null },
    incidencia: { url: '', archivo: null as File | null }
  });

  useEffect(() => {
    async function inicializar() {
      // 1. Generar ID de Batch
      const hoy = new Date();
      const d = String(hoy.getDate()).padStart(2, '0');
      const m = String(hoy.getMonth() + 1).padStart(2, '0');
      const a = String(hoy.getFullYear()).slice(-2);
      const prefix = `EXT${d}${m}${a}`;
      
      const { count } = await supabase
        .from('procesos_batch')
        .select('*', { count: 'exact', head: true })
        .like('batch_id', `${prefix}%`);

      const sequence = String((count || 0) + 1).padStart(2, '0');
      setBatchId(`${prefix}${sequence}`);

      // 2. Cargar parámetros y operadores desde las nuevas tablas
      const [resParams, resOps] = await Promise.all([
        supabase.from('parametros').select('*').eq('activo', true),
        supabase.from('operadores').select('*').eq('activo', true).order('nombre')
      ]);

      if (resParams.data) {
        setListaVariedades(resParams.data.filter(p => p.categoria === 'variedad'));
        setListaProveedores(resParams.data.filter(p => p.categoria === 'proveedor'));
        setListaTurnos(resParams.data.filter(p => p.categoria === 'turno'));
      }
      if (resOps.data) setListaOperadores(resOps.data);
    }
    inicializar();
  }, []);

  const abrirCamara = async (tipo: keyof typeof fotos) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          setFotos(prev => ({
            ...prev,
            [tipo]: { 
              url: reader.result as string, 
              hora: new Date().toISOString(),
              archivo: file 
            }
          }));
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const guardarBatch = async () => {
    if (!fotos.visor_cero.archivo || !fotos.tanque_vacio.archivo || !fotos.visor_lleno.archivo) {
      alert("⚠️ Faltan fotos obligatorias.");
      return;
    }
    if (!datos.operador_id || !datos.variedad || !datos.proveedor || !datos.turno || !datos.peso_final) {
      alert("⚠️ Todos los selectores y el peso son obligatorios.");
      return;
    }

    setLoading(true);
    try {
      const urlV0 = await subirImagen(fotos.visor_cero.archivo, 'visor_cero');
      const urlTV = await subirImagen(fotos.tanque_vacio.archivo, 'tanque_vacio');
      const urlVL = await subirImagen(fotos.visor_lleno.archivo, 'visor_lleno');
      let urlInc = fotos.incidencia.archivo ? await subirImagen(fotos.incidencia.archivo, 'incidencia') : null;

      const { error } = await supabase.from('procesos_batch').insert([{
        batch_id: batchId,
        operador_id: datos.operador_id, // Usamos ID para integridad
        variedad: datos.variedad,
        proveedor: datos.proveedor,
        turno: datos.turno,
        foto_visor_cero_url: urlV0,
        hora_foto_visor_cero: fotos.visor_cero.hora,
        foto_tanque_vacio_url: urlTV,
        hora_foto_tanque_vacio: fotos.tanque_vacio.hora,
        foto_visor_lleno_url: urlVL,
        hora_foto_visor_lleno: fotos.visor_lleno.hora,
        foto_justificacion_url: urlInc,
        peso_final_digitado: parseFloat(datos.peso_final),
        observaciones: datos.observaciones,
        fecha_hora_inicio: fotos.visor_cero.hora,
        fecha_hora_fin: new Date().toISOString()
      }]);

      if (error) throw error;
      alert("✅ Registro guardado con éxito.");
      router.push('/dashboard');
    } catch (err: any) {
      alert("❌ Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-red-700 p-4 text-white sticky top-0 z-10 shadow-lg flex justify-between items-center">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <div className="text-center">
          <h1 className="font-black text-xs tracking-widest uppercase">Proceso de Pesado</h1>
          <p className="text-[10px] font-bold opacity-70">{batchId}</p>
        </div>
        <div className="w-6"></div>
      </header>

      <div className="p-5 space-y-5">
        
        {/* FORMULARIO DE SELECCIÓN */}
        <section className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
          
          <div>
            <label className="text-[10px] font-black text-red-700 uppercase ml-1">1. Seleccione Operador</label>
            <select 
              className="w-full p-4 mt-1 rounded-2xl border-2 border-gray-100 font-bold text-sm bg-gray-50 outline-none focus:border-red-700"
              onChange={e => setDatos({...datos, operador_id: e.target.value})}
            >
              <option value="">ELIJA UN NOMBRE...</option>
              {listaOperadores.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[10px] font-black text-red-700 uppercase ml-1">2. Variedad de Palma</label>
              <select 
                className="w-full p-4 mt-1 rounded-2xl border-2 border-gray-100 font-bold text-sm bg-gray-50 outline-none focus:border-red-700"
                onChange={e => setDatos({...datos, variedad: e.target.value})}
              >
                <option value="">SELECCIONE...</option>
                {listaVariedades.map(v => <option key={v.id} value={v.valor}>{v.valor}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-red-700 uppercase ml-1">3. Proveedor MP</label>
              <select 
                className="w-full p-4 mt-1 rounded-2xl border-2 border-gray-100 font-bold text-sm bg-gray-50 outline-none focus:border-red-700"
                onChange={e => setDatos({...datos, proveedor: e.target.value})}
              >
                <option value="">SELECCIONE...</option>
                {listaProveedores.map(p => <option key={p.id} value={p.valor}>{p.valor}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-red-700 uppercase ml-1">4. Turno de Trabajo</label>
              <select 
                className="w-full p-4 mt-1 rounded-2xl border-2 border-gray-100 font-bold text-sm bg-gray-50 outline-none focus:border-red-700"
                onChange={e => setDatos({...datos, turno: e.target.value})}
              >
                <option value="">SELECCIONE TURNO...</option>
                {listaTurnos.map(t => <option key={t.id} value={t.valor}>{t.valor}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* FOTOS DE INICIO */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => abrirCamara('visor_cero')} 
            className={`aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-2 transition-all ${fotos.visor_cero.url ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white text-gray-400'}`}
          >
            {fotos.visor_cero.url ? <img src={fotos.visor_cero.url} className="w-full h-full object-cover rounded-2xl" /> : <>
              <span className="text-3xl mb-1">⚖️</span>
              <span className="text-[9px] font-black uppercase">Visor en Cero</span>
            </>}
          </button>

          <button 
            onClick={() => abrirCamara('tanque_vacio')} 
            className={`aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-2 transition-all ${fotos.tanque_vacio.url ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white text-gray-400'}`}
          >
            {fotos.tanque_vacio.url ? <img src={fotos.tanque_vacio.url} className="w-full h-full object-cover rounded-2xl" /> : <>
              <span className="text-3xl mb-1">🛢️</span>
              <span className="text-[9px] font-black uppercase">Tanque Vacío</span>
            </>}
          </button>
        </div>

        {/* PESO Y FOTO FINAL */}
        <section className="bg-red-50 p-5 rounded-3xl border border-red-100 space-y-3">
          <label className="text-[10px] font-black text-red-700 uppercase ml-1">5. Cierre de Batch</label>
          <div className="flex gap-3">
            <button 
              onClick={() => abrirCamara('visor_lleno')} 
              className={`w-1/3 aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center ${fotos.visor_lleno.url ? 'border-red-500 bg-white' : 'border-red-200 text-red-300'}`}
            >
              {fotos.visor_lleno.url ? <img src={fotos.visor_lleno.url} className="w-full h-full object-cover rounded-xl" /> : <span className="text-2xl">📸</span>}
            </button>
            <input 
              type="number" 
              placeholder="PESO FINAL"
              className="w-2/3 p-4 rounded-2xl border-2 border-red-100 text-3xl font-black text-red-700 outline-none placeholder:text-red-200 text-center"
              onChange={e => setDatos({...datos, peso_final: e.target.value})}
            />
          </div>
        </section>

        {/* OBSERVACIONES */}
        <div className="space-y-3">
          <textarea 
            placeholder="Observaciones..." 
            className="w-full p-4 border-2 rounded-3xl bg-white h-20 text-sm font-semibold outline-none focus:border-red-700"
            onChange={e=>setDatos({...datos, observaciones: e.target.value})}
          ></textarea>
          
          <button 
            onClick={() => abrirCamara('incidencia')} 
            className={`w-full p-4 rounded-2xl border-2 border-dashed text-[10px] font-black transition-all ${fotos.incidencia.url ? 'bg-amber-100 border-amber-500 text-amber-700' : 'border-amber-200 text-amber-400 bg-white'}`}
          >
            {fotos.incidencia.url ? '✓ EVIDENCIA DE NOVEDAD LISTA' : '+ FOTO JUSTIFICACIÓN / NOVEDAD'}
          </button>
        </div>
      </div>

      {/* BOTÓN FLOTANTE */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100">
        <button 
          onClick={guardarBatch} 
          disabled={loading} 
          className="w-full bg-red-700 text-white py-5 rounded-2xl font-black text-sm tracking-[4px] shadow-2xl active:scale-95 transition-all disabled:bg-gray-400"
        >
          {loading ? 'SINCRONIZANDO...' : 'GUARDAR PESADA'}
        </button>
      </div>
    </div>
  );
}