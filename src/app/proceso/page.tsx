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
  const [batchId, setBatchId] = useState('Cargando...');
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

  useEffect(() => {
    setIsClient(true);
    
    async function inicializar() {
      const borradorDatos = localStorage.getItem('draft_datos');
      const borradorFotos = localStorage.getItem('draft_fotos');
      const borradorBatch = localStorage.getItem('draft_batchId');

      if (borradorBatch && (borradorBatch.includes('NaN') || borradorBatch === 'undefined')) {
        localStorage.removeItem('draft_batchId');
        window.location.reload();
        return;
      }

      if (borradorDatos) setDatos(JSON.parse(borradorDatos));
      if (borradorFotos) setFotos(JSON.parse(borradorFotos));

      if (borradorBatch) {
        setBatchId(borradorBatch);
      } else {
        const hoy = new Date();
        const d = String(hoy.getDate()).padStart(2, '0');
        const m = String(hoy.getMonth() + 1).padStart(2, '0');
        const a = String(hoy.getFullYear()).slice(-2);
        const prefix = `EXT${d}${m}${a}`;
        
        const { data: ultimos } = await supabase
          .from('procesos_batch')
          .select('batch_id')
          .like('batch_id', `${prefix}%`)
          .order('batch_id', { ascending: false })
          .limit(1);

        let siguienteSecuencia = 1;
        if (ultimos && ultimos.length > 0) {
          const match = ultimos[0].batch_id.match(/\d+$/);
          if (match) siguienteSecuencia = parseInt(match[0]) + 1;
        }

        let registroExitoso = false;
        let idFinal = "";

        while (!registroExitoso) {
          idFinal = `${prefix}${String(siguienteSecuencia).padStart(2, '0')}`;
          const { error: insertError } = await supabase
            .from('procesos_batch')
            .insert([{ 
              batch_id: idFinal,
              fecha_hora_inicio: new Date().toISOString() 
            }]);

          if (!insertError) {
            registroExitoso = true;
          } else if (insertError.code === '23505') { 
            siguienteSecuencia++;
          } else {
            break;
          }
        }
        setBatchId(idFinal);
        localStorage.setItem('draft_batchId', idFinal);
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

  useEffect(() => {
    if (isClient && batchId !== 'Cargando...' && !batchId.includes('NaN')) {
      localStorage.setItem('draft_datos', JSON.stringify(datos));
      localStorage.setItem('draft_batchId', batchId);
      localStorage.setItem('draft_fotos', JSON.stringify(fotos));
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
          setFotos(prev => ({ ...prev, [tipo]: { url: urlNube, hora: new Date().toISOString() } }));
        } catch (error) {
          alert("Error al subir imagen");
        } finally {
          setSubiendoFoto(null);
        }
      }
    };
    input.click();
  };

  const guardarBatch = async () => {
    if (!datos.operador_id || !datos.variedad || !datos.proveedor || !datos.turno || !datos.peso_final) {
      alert("Faltan datos obligatorios.");
      return;
    }

    setLoading(true);

    const getFmtFecha = (iso?: string | null) => {
      const d = iso ? new Date(iso) : new Date();
      const pad = (n: number) => n < 10 ? '0' + n : n;
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // EL PAYLOAD: Aquí mandamos todo para que deje de estar NULL
    const payload = {
      operador_id: datos.operador_id,
      variedad: datos.variedad,
      proveedor: datos.proveedor,
      turno: datos.turno,
      peso_final_digitado: parseFloat(datos.peso_final),
      observaciones: datos.observaciones,
      fecha_hora_inicio: getFmtFecha(fotos.visor_cero.hora),
      fecha_hora_fin: getFmtFecha(),
      foto_visor_cero_url: fotos.visor_cero.url,
      foto_tanque_vacio_url: fotos.tanque_vacio.url,
      foto_visor_lleno_url: fotos.visor_lleno.url,
      foto_justificacion_url: fotos.incidencia.url,
      hora_foto_visor_cero: getFmtFecha(fotos.visor_cero.hora),
      hora_foto_tanque_vacio: getFmtFecha(fotos.tanque_vacio.hora),
      hora_foto_visor_lleno: getFmtFecha()
    };

    // USAMOS UPDATE para llenar la fila que reservamos al inicio
    const { error } = await supabase
      .from('procesos_batch')
      .update(payload)
      .eq('batch_id', batchId);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("✅ GUARDADO EXITOSO");
      localStorage.clear();
      window.location.reload();
    }
    setLoading(false);
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-red-700 p-4 text-white sticky top-0 z-10 flex justify-between items-center shadow-lg">
        <button onClick={() => router.back()}>←</button>
        <div className="text-center">
          <h1 className="font-black text-xs uppercase tracking-widest">Pesado de Batch</h1>
          <p className="text-[10px] font-bold opacity-70">{batchId}</p>
        </div>
        <div className="w-6"></div>
      </header>

      <div className="p-5 space-y-5">
        <section className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
          <select 
            className="w-full p-4 rounded-2xl border-2 border-gray-100 font-bold bg-gray-50 outline-none focus:border-red-700"
            value={datos.operador_id}
            onChange={e => setDatos({...datos, operador_id: e.target.value})}
          >
            <option value="">OPERADOR...</option>
            {listaOperadores.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>

          <select 
            className="w-full p-4 rounded-2xl border-2 border-gray-100 font-bold bg-gray-50"
            value={datos.variedad}
            onChange={e => setDatos({...datos, variedad: e.target.value})}
          >
            <option value="">VARIEDAD...</option>
            {listaVariedades.map(v => <option key={v.id} value={v.valor}>{v.valor}</option>)}
          </select>

          <select 
            className="w-full p-4 rounded-2xl border-2 border-gray-100 font-bold bg-gray-50"
            value={datos.proveedor}
            onChange={e => setDatos({...datos, proveedor: e.target.value})}
          >
            <option value="">PROVEEDOR...</option>
            {listaProveedores.map(p => <option key={p.id} value={p.valor}>{p.valor}</option>)}
          </select>

          <select 
            className="w-full p-4 rounded-2xl border-2 border-gray-100 font-bold bg-gray-50"
            value={datos.turno}
            onChange={e => setDatos({...datos, turno: e.target.value})}
          >
            <option value="">TURNO...</option>
            {listaTurnos.map(t => <option key={t.id} value={t.valor}>{t.valor}</option>)}
          </select>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => abrirCamara('visor_cero')} className={`aspect-square rounded-3xl border-2 border-dashed flex items-center justify-center overflow-hidden ${fotos.visor_cero.url ? 'border-green-500' : 'border-gray-200 bg-white text-gray-400'}`}>
            {subiendoFoto === 'visor_cero' ? '...' : fotos.visor_cero.url ? <img src={fotos.visor_cero.url} className="w-full h-full object-cover" /> : '⚖️ Visor Cero'}
          </button>
          <button onClick={() => abrirCamara('tanque_vacio')} className={`aspect-square rounded-3xl border-2 border-dashed flex items-center justify-center overflow-hidden ${fotos.tanque_vacio.url ? 'border-green-500' : 'border-gray-200 bg-white text-gray-400'}`}>
            {subiendoFoto === 'tanque_vacio' ? '...' : fotos.tanque_vacio.url ? <img src={fotos.tanque_vacio.url} className="w-full h-full object-cover" /> : '🛢️ Tanque Vacío'}
          </button>
        </div>

        <section className="bg-red-50 p-5 rounded-3xl border border-red-100 flex gap-3">
          <button onClick={() => abrirCamara('visor_lleno')} className="w-1/3 aspect-square bg-white border-2 border-dashed rounded-2xl flex items-center justify-center overflow-hidden">
            {fotos.visor_lleno.url ? <img src={fotos.visor_lleno.url} className="w-full h-full object-cover" /> : '📸'}
          </button>
          <input 
            type="number" placeholder="PESO" 
            className="w-2/3 p-4 rounded-2xl text-3xl font-black text-center text-red-700 outline-none"
            value={datos.peso_final}
            onChange={e => setDatos({...datos, peso_final: e.target.value})}
          />
        </section>

        <textarea 
          placeholder="Observaciones..." 
          className="w-full p-4 border-2 rounded-3xl h-20 outline-none"
          value={datos.observaciones}
          onChange={e=>setDatos({...datos, observaciones: e.target.value})}
        ></textarea>
        
        <button onClick={() => abrirCamara('incidencia')} className={`w-full p-4 rounded-2xl border-2 border-dashed text-[10px] font-black ${fotos.incidencia.url ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-white text-amber-400'}`}>
          {fotos.incidencia.url ? '✓ EVIDENCIA LISTA' : '+ FOTO JUSTIFICACIÓN'}
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t">
        <button 
          onClick={guardarBatch} disabled={loading || !!subiendoFoto}
          className="w-full bg-red-700 text-white py-5 rounded-2xl font-black tracking-widest shadow-xl disabled:bg-gray-400"
        >
          {loading ? 'GUARDANDO...' : 'GUARDAR PESADA'}
        </button>
      </div>
    </div>
  );
}