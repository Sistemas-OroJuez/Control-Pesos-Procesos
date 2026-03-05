'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { subirImagen } from '@/lib/storage-utils';

export default function ProcesoLlenado() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [listaVariedades, setListaVariedades] = useState<any[]>([]);
  const [listaProveedores, setListaProveedores] = useState<any[]>([]);
  const [listaTurnos, setListaTurnos] = useState<any[]>([]);
  const [listaOperadores, setListaOperadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null);

  const [datos, setDatos] = useState({
    operador_id: '',
    variedad: '',
    proveedor: '',
    turno: '',
    peso_final: '',
    observaciones: ''
  });

  const [fotos, setFotos] = useState({
    visor_cero: { url: '', hora: null as string | null },
    tanque_vacio: { url: '', hora: null as string | null },
    visor_lleno: { url: '', hora: null as string | null },
    incidencia: { url: '' }
  });

  const getEcuadorDate = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guayaquil" }));
  };

  // --- 1. CARGA INICIAL Y RECUPERACIÓN DE DATOS ---
  useEffect(() => {
    setIsClient(true);
    
    async function inicializar() {
      // Intentar recuperar sesión anterior del localStorage
      const guardadoBatchId = localStorage.getItem('pending_batch_id');
      const guardadoDatos = localStorage.getItem('pending_datos');
      const guardadoFotos = localStorage.getItem('pending_fotos');

      if (guardadoBatchId) {
        setBatchId(guardadoBatchId);
        if (guardadoDatos) setDatos(JSON.parse(guardadoDatos));
        if (guardadoFotos) setFotos(JSON.parse(guardadoFotos));
      } else {
        // Si no hay nada guardado, generar nuevo ID (Solo la primera vez)
        const ahora = getEcuadorDate();
        const dd = String(ahora.getDate()).padStart(2, '0');
        const mm = String(ahora.getMonth() + 1).padStart(2, '0');
        const aaaa = ahora.getFullYear();
        const hh = String(ahora.getHours()).padStart(2, '0');
        const min = String(ahora.getMinutes()).padStart(2, '0');
        const ss = String(ahora.getSeconds()).padStart(2, '0');
        const nuevoId = `${dd}${mm}${aaaa}${hh}${min}${ss}`;
        setBatchId(nuevoId);
        localStorage.setItem('pending_batch_id', nuevoId);
      }

      const [resParams, resOps] = await Promise.all([
        supabase.from('parametros').select('*').eq('activo', true),
        supabase.from('operadores').select('*').eq('activo', true).order('nombre')
      ]);

      if (resParams.data) {
        setListaVariedades(resParams.data.filter((p: any) => p.categoria === 'variedad'));
        setListaProveedores(resParams.data.filter((p: any) => p.categoria === 'proveedor'));
        setListaTurnos(resParams.data.filter((p: any) => p.categoria === 'turno'));
      }
      if (resOps.data) setListaOperadores(resOps.data);
    }
    inicializar();
  }, []);

  // --- 2. AUTOGUARDADO EN TIEMPO REAL ---
  useEffect(() => {
    if (isClient && batchId) {
      localStorage.setItem('pending_datos', JSON.stringify(datos));
      localStorage.setItem('pending_fotos', JSON.stringify(fotos));
    }
  }, [datos, fotos, batchId, isClient]);


  const abrirCamara = async (tipo: keyof typeof fotos) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        setSubiendoFoto(tipo);
        try {
          const urlNube = await subirImagen(file, tipo);
          const nuevaInfoFoto = { url: urlNube, hora: getEcuadorDate().toISOString() };
          setFotos(prev => ({ ...prev, [tipo]: nuevaInfoFoto }));
        } catch (error) {
          alert("Error al subir la imagen.");
        } finally {
          setSubiendoFoto(null);
        }
      }
    };
    input.click();
  };

  const guardarBatch = async () => {
    if (!datos.operador_id || !datos.variedad || !datos.proveedor || !datos.turno || !datos.peso_final || !fotos.visor_cero.url || !fotos.tanque_vacio.url || !fotos.visor_lleno.url) {
      alert("Por favor complete todos los campos y tome las fotos requeridas");
      return;
    }

    setLoading(true);

    const formatEcuadorSQL = (fechaISO: string | null) => {
      if (!fechaISO) return null;
      const d = new Date(fechaISO);
      const pad = (n: number) => n < 10 ? '0' + n : n;
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const payload = {
      batch_id: batchId,
      operador_id: datos.operador_id,
      variedad: datos.variedad,
      proveedor: datos.proveedor,
      turno: datos.turno,
      peso_final_digitado: parseFloat(datos.peso_final),
      observaciones: datos.observaciones,
      foto_visor_cero_url: fotos.visor_cero.url,
      foto_tanque_vacio_url: fotos.tanque_vacio.url,
      foto_visor_lleno_url: fotos.visor_lleno.url,
      foto_justificacion_url: fotos.incidencia.url,
      fecha_hora_inicio: formatEcuadorSQL(fotos.visor_cero.hora),
      fecha_hora_fin: formatEcuadorSQL(getEcuadorDate().toISOString()),
      hora_foto_visor_cero: formatEcuadorSQL(fotos.visor_cero.hora),
      hora_foto_tanque_vacio: formatEcuadorSQL(fotos.tanque_vacio.hora),
      hora_foto_visor_lleno: formatEcuadorSQL(getEcuadorDate().toISOString())
    };

    const { error } = await supabase.from('procesos_batch').insert([payload]);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      // --- 3. LIMPIEZA DE MEMORIA LOCAL TRAS ÉXITO ---
      localStorage.removeItem('pending_batch_id');
      localStorage.removeItem('pending_datos');
      localStorage.removeItem('pending_fotos');
      
      alert("✅ PROCESO " + batchId + " GUARDADO EXITOSAMENTE");
      window.location.reload();
    }
    setLoading(false);
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-red-700 p-4 text-white sticky top-0 z-10 shadow-lg flex justify-between items-center">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <div className="text-center">
          <h1 className="font-black text-xs tracking-widest uppercase">Proceso de Pesado</h1>
          <p className="text-[10px] font-bold opacity-70">{batchId || 'Generando...'}</p>
        </div>
        <div className="w-6"></div>
      </header>

      <div className="p-5 space-y-5">
        {/* Banner de aviso de recuperación */}
        {localStorage.getItem('pending_batch_id') && (
            <div className="bg-amber-100 text-amber-800 text-[10px] p-2 rounded-lg text-center font-bold animate-pulse">
                ⚠️ PROCESO EN CURSO RECUPERADO
            </div>
        )}

        <section className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
          <div>
            <label className="text-[10px] font-black text-red-700 uppercase ml-1">1. Seleccione Operador</label>
            <select 
              className="w-full p-4 mt-1 rounded-2xl border-2 border-gray-100 font-bold text-sm bg-gray-50 outline-none focus:border-red-700"
              value={datos.operador_id}
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
                value={datos.variedad}
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
                value={datos.proveedor}
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
                value={datos.turno}
                onChange={e => setDatos({...datos, turno: e.target.value})}
              >
                <option value="">SELECCIONE TURNO...</option>
                {listaTurnos.map(t => <option key={t.id} value={t.valor}>{t.valor}</option>)}
              </select>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button 
            type="button"
            disabled={!!subiendoFoto}
            onClick={() => abrirCamara('visor_cero')} 
            className={`aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-2 transition-all ${fotos.visor_cero.url ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white text-gray-400'}`}
          >
            {subiendoFoto === 'visor_cero' ? <span className="text-[10px] animate-pulse">...</span> : 
             fotos.visor_cero.url ? <img src={fotos.visor_cero.url} className="w-full h-full object-cover rounded-2xl" /> : <>
              <span className="text-3xl mb-1">⚖️</span>
              <span className="text-[9px] font-black uppercase">Visor en Cero</span>
            </>}
          </button>

          <button 
            type="button"
            disabled={!!subiendoFoto}
            onClick={() => abrirCamara('tanque_vacio')} 
            className={`aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-2 transition-all ${fotos.tanque_vacio.url ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white text-gray-400'}`}
          >
            {subiendoFoto === 'tanque_vacio' ? <span className="text-[10px] animate-pulse">...</span> :
             fotos.tanque_vacio.url ? <img src={fotos.tanque_vacio.url} className="w-full h-full object-cover rounded-2xl" /> : <>
              <span className="text-3xl mb-1">🛢️</span>
              <span className="text-[9px] font-black uppercase">Tanque Vacío</span>
            </>}
          </button>
        </div>

        <section className="bg-red-50 p-5 rounded-3xl border border-red-100 space-y-3">
          <label className="text-[10px] font-black text-red-700 uppercase ml-1">5. Cierre de Batch</label>
          <div className="flex gap-3">
            <button 
              type="button"
              disabled={!!subiendoFoto}
              onClick={() => abrirCamara('visor_lleno')} 
              className={`w-1/3 aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center ${fotos.visor_lleno.url ? 'border-red-500 bg-white' : 'border-red-200 text-red-300'}`}
            >
              {subiendoFoto === 'visor_lleno' ? <span className="text-[10px] animate-pulse">...</span> :
               fotos.visor_lleno.url ? <img src={fotos.visor_lleno.url} className="w-full h-full object-cover rounded-xl" /> : <span className="text-2xl">📸</span>}
            </button>
            <input 
              type="number" 
              placeholder="PESO FINAL"
              value={datos.peso_final}
              className="w-2/3 p-4 rounded-2xl border-2 border-red-100 text-3xl font-black text-red-700 outline-none placeholder:text-red-200 text-center"
              onChange={e => setDatos({...datos, peso_final: e.target.value})}
            />
          </div>
        </section>

        <div className="space-y-3">
          <textarea 
            placeholder="Observaciones..." 
            value={datos.observaciones}
            className="w-full p-4 border-2 rounded-3xl bg-white h-20 text-sm font-semibold outline-none focus:border-red-700"
            onChange={e=>setDatos({...datos, observaciones: e.target.value})}
          ></textarea>
          
          <button 
            type="button"
            disabled={!!subiendoFoto}
            onClick={() => abrirCamara('incidencia')} 
            className={`w-full p-4 rounded-2xl border-2 border-dashed text-[10px] font-black transition-all ${fotos.incidencia.url ? 'bg-amber-100 border-amber-500 text-amber-700' : 'border-amber-200 text-amber-400 bg-white'}`}
          >
            {subiendoFoto === 'incidencia' ? 'CARGANDO...' : 
             fotos.incidencia.url ? '✓ EVIDENCIA DE NOVEDAD LISTA' : '+ FOTO JUSTIFICACIÓN / NOVEDAD'}
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100">
        <button 
          onClick={guardarBatch} 
          disabled={loading || !!subiendoFoto} 
          className="w-full bg-red-700 text-white py-5 rounded-2xl font-black text-sm tracking-[4px] shadow-2xl active:scale-95 transition-all disabled:bg-gray-400"
        >
          {loading ? 'SINCRONIZANDO...' : 'GUARDAR PESADA'}
        </button>
      </div>
    </div>
  );
}