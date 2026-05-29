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

  // --- COMPRESIÓN OPTIMIZADA ---
  const comprimirImagen = async (file: File): Promise<Blob> => {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const maxWidth = 800; // Un poco más de resolución para legibilidad
    const scale = maxWidth / bitmap.width;
    canvas.width = maxWidth;
    canvas.height = bitmap.height * scale;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    
    // Devolvemos el blob comprimido
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.5));
  };

  useEffect(() => {
    setIsClient(true);
    async function inicializar() {
      const guardadoBatchId = localStorage.getItem('pending_batch_id');
      if (guardadoBatchId) {
        setBatchId(guardadoBatchId);
        const guardadoDatos = localStorage.getItem('pending_datos');
        const guardadoFotos = localStorage.getItem('pending_fotos');
        if (guardadoDatos) setDatos(JSON.parse(guardadoDatos));
        if (guardadoFotos) setFotos(JSON.parse(guardadoFotos));
      } else {
        const ahora = getEcuadorDate();
        const nuevoId = `${String(ahora.getDate()).padStart(2, '0')}${String(ahora.getMonth() + 1).padStart(2, '0')}${ahora.getFullYear()}${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}${String(ahora.getSeconds()).padStart(2, '0')}`;
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
          const blobComprimido = await comprimirImagen(file);
          // Convertimos el blob a File para que cumpla con la firma de subirImagen
          const fileComprimido = new File([blobComprimido], `${tipo}.jpg`, { type: 'image/jpeg' });
          const urlNube = await subirImagen(fileComprimido, tipo);
          
          const nuevaInfoFoto = { url: urlNube, hora: getEcuadorDate().toISOString() };
          setFotos(prev => ({ ...prev, [tipo]: nuevaInfoFoto }));
        } catch (error) {
          console.error(error);
          alert("Error al subir imagen.");
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
      localStorage.removeItem('pending_batch_id');
      localStorage.removeItem('pending_datos');
      localStorage.removeItem('pending_fotos');
      alert("✅ PROCESO GUARDADO EXITOSAMENTE");
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
          <h1 className="font-black text-xs tracking-widest uppercase">Proceso de Pesado v2.0</h1>
          <p className="text-[10px] font-bold opacity-70">{batchId || 'Generando...'}</p>
        </div>
        <div className="w-6"></div>
      </header>
      {/* ...resto del JSX igual... */}
    </div>
  );
}