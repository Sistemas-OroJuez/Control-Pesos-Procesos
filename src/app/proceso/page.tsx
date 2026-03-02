'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
// Importamos la utilidad de subida (asegúrate de haber creado src/lib/storage-utils.ts)
import { subirImagen } from '@/lib/storage-utils';

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

  // MODIFICADO: Ahora incluimos el campo 'archivo' para guardar el File real
  const [fotos, setFotos] = useState({
    visor_cero: { url: '', hora: null as string | null, archivo: null as File | null },
    tanque_vacio: { url: '', hora: null as string | null, archivo: null as File | null },
    visor_lleno: { url: '', hora: null as string | null, archivo: null as File | null },
    incidencia: { url: '', archivo: null as File | null }
  });

  useEffect(() => {
    async function inicializar() {
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

      // Cargar parámetros de la base de datos
      const { data: params } = await supabase.from('parametros').select('*').eq('activo', true);
      if (params) {
        setListaVariedades(params.filter(p => p.categoria === 'variedad'));
        setListaProveedores(params.filter(p => p.categoria === 'proveedor'));
        setListaOperadores(params.filter(p => p.categoria === 'operador'));
      }
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
              archivo: file // Guardamos el archivo para la subida
            }
          }));
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // FUNCIÓN GUARDAR ACTUALIZADA (Arquitectura Híbrida)
  const guardarBatch = async () => {
    if (!fotos.visor_cero.archivo || !fotos.tanque_vacio.archivo || !fotos.visor_lleno.archivo) {
      alert("⚠️ Faltan fotos obligatorias: Visor 0, Tanque Vacío o Visor Lleno.");
      return;
    }

    if (!datos.peso_final || !datos.variedad || !datos.proveedor) {
      alert("⚠️ Complete los datos de selección y el peso final.");
      return;
    }

    setLoading(true);
    try {
      // 1. SUBIDA DE ARCHIVOS AL BUCKET (Storage)
      const urlV0 = await subirImagen(fotos.visor_cero.archivo, 'visor_cero');
      const urlTV = await subirImagen(fotos.tanque_vacio.archivo, 'tanque_vacio');
      const urlVL = await subirImagen(fotos.visor_lleno.archivo, 'visor_lleno');
      
      let urlInc = null;
      if (fotos.incidencia.archivo) {
        urlInc = await subirImagen(fotos.incidencia.archivo, 'incidencia');
      }

      // 2. GUARDADO DE DATOS EN TABLA (SQL)
      const { error } = await supabase.from('procesos_batch').insert([{
        batch_id: batchId,
        operador_email: datos.operador,
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

      alert("✅ Batch registrado exitosamente.");
      router.push('/dashboard');
    } catch (err: any) {
      alert("❌ Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="bg-red-700 p-4 text-white sticky top-0 z-10 shadow-lg">
        <div className="flex justify-between items-center">
          <button onClick={() => router.back()} className="text-2xl">←</button>
          <div className="text-center">
            <h1 className="font-bold text-sm tracking-widest">NUEVO BATCH</h1>
            <p className="text-[10px] opacity-80">{batchId}</p>
          </div>
          <div className="w-8"></div>
        </div>
      </header>

      <div className="p-5 space-y-6">
        {/* SELECCIÓN DE PARÁMETROS */}
        <section className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <select 
            className="w-full p-4 rounded-xl border-2 border-gray-100 text-sm font-bold outline-none focus:border-red-700"
            onChange={e => setDatos({...datos, variedad: e.target.value})}
          >
            <option value="">SELECCIONE VARIEDAD</option>
            {listaVariedades.map(v => <option key={v.id} value={v.valor}>{v.valor}</option>)}
          </select>

          <select 
            className="w-full p-4 rounded-xl border-2 border-gray-100 text-sm font-bold outline-none focus:border-red-700"
            onChange={e => setDatos({...datos, proveedor: e.target.value})}
          >
            <option value="">SELECCIONE PROVEEDOR</option>
            {listaProveedores.map(p => <option key={p.id} value={p.valor}>{p.valor}</option>)}
          </select>

          <div className="flex gap-2">
            {['T1', 'T2'].map(t => (
              <button 
                key={t}
                onClick={() => setDatos({...datos, turno: t})}
                className={`flex-1 p-3 rounded-xl font-bold text-xs transition-all ${datos.turno === t ? 'bg-red-700 text-white shadow-md' : 'bg-white text-gray-400 border-2 border-gray-100'}`}
              >
                TURNO {t}
              </button>
            ))}
          </div>
        </section>

        {/* EVIDENCIA DE INICIO */}
        <section className="grid grid-cols-2 gap-3">
          <button 
            type="button"
            onClick={() => abrirCamara('visor_cero')} 
            className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-2 transition-all ${fotos.visor_cero.url ? 'border-green-500 bg-green-50' : 'border-gray-300 text-gray-400'}`}
          >
            {fotos.visor_cero.url ? <img src={fotos.visor_cero.url} className="w-full h-full object-cover rounded-lg" /> : <>
              <span className="text-2xl mb-1">⚖️</span>
              <span className="text-[9px] font-bold text-center uppercase">Visor en Cero</span>
            </>}
          </button>

          <button 
            type="button"
            onClick={() => abrirCamara('tanque_vacio')} 
            className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-2 transition-all ${fotos.tanque_vacio.url ? 'border-green-500 bg-green-50' : 'border-gray-300 text-gray-400'}`}
          >
            {fotos.tanque_vacio.url ? <img src={fotos.tanque_vacio.url} className="w-full h-full object-cover rounded-lg" /> : <>
              <span className="text-2xl mb-1">🛢️</span>
              <span className="text-[9px] font-bold text-center uppercase">Tanque Vacío</span>
            </>}
          </button>
        </section>

        {/* EVIDENCIA DE CIERRE */}
        <section className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-4">
          <h3 className="text-[10px] font-black text-red-700 uppercase tracking-widest text-center">Finalización del Batch</h3>
          
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => abrirCamara('visor_lleno')} 
              className={`w-1/3 aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${fotos.visor_lleno.url ? 'border-red-500 bg-white' : 'border-red-200 text-red-300'}`}
            >
              {fotos.visor_lleno.url ? <img src={fotos.visor_lleno.url} className="w-full h-full object-cover rounded-lg" /> : <>
                <span className="text-xl">📸</span>
                <span className="text-[8px] font-bold uppercase">Visor Lleno</span>
              </>}
            </button>
            
            <input 
              type="number" 
              placeholder="PESO FINAL"
              className="w-2/3 bg-white p-4 rounded-xl border-2 border-red-100 text-2xl font-black text-red-700 outline-none placeholder:text-red-200"
              onChange={e => setDatos({...datos, peso_final: e.target.value})}
            />
          </div>
        </section>

        {/* OBSERVACIONES E INCIDENCIA */}
        <div className="space-y-3">
          <textarea 
            placeholder="Observaciones o novedades..." 
            className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-white h-24 text-sm font-semibold outline-none focus:border-red-700 transition-all"
            onChange={e=>setDatos({...datos, observaciones: e.target.value})}
          ></textarea>
          
          <button 
            type="button"
            onClick={() => abrirCamara('incidencia')} 
            className={`w-full p-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-[10px] font-bold transition-all ${fotos.incidencia.url ? 'bg-amber-100 border-amber-600 text-amber-700' : 'border-amber-300 text-amber-500 active:bg-amber-50'}`}
          >
            ⚠️ {fotos.incidencia.url ? 'EVIDENCIA DE NOVEDAD OK' : 'FOTO JUSTIFICACIÓN (OPCIONAL)'}
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 border-t border-gray-100 backdrop-blur-md">
        <button 
          onClick={guardarBatch} 
          disabled={loading} 
          className="w-full bg-red-700 text-white py-5 rounded-2xl font-black text-sm tracking-[3px] shadow-xl active:scale-95 transition-all disabled:bg-gray-400"
        >
          {loading ? 'ENVIANDO A NUBE...' : 'GUARDAR PROCESO'}
        </button>
      </div>
    </div>
  );
}