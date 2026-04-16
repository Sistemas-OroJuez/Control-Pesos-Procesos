'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function GestionEquipos() {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [tempEdit, setTempEdit] = useState<any>(null);

  // --- ESTADOS PARA PRUEBAS BLUETOOTH ---
  const [btStatus, setBtStatus] = useState<'IDLE' | 'SCANNING' | 'CONNECTED' | 'ERROR'>('IDLE');
  const [logBT, setLogBT] = useState<string[]>([]);
  
  const [nuevo, setNuevo] = useState({ 
    tag_id: '', 
    nombre: '', 
    seccion: 'REFINERIA',
    foto_url: '' 
  });

  useEffect(() => { 
    cargarEquipos(); 
  }, []);

  const cargarEquipos = async () => {
    const { data } = await supabase.from('cat_equipos').select('*').order('created_at', { ascending: false });
    if (data) setEquipos(data);
  };

  // --- FUNCIÓN DE ESCANEO Y CONEXIÓN BT ---
  const iniciarEscaneoBT = async () => {
    setBtStatus('SCANNING');
    setLogBT(["Iniciando búsqueda de Micro Motion..."]);

    try {
      // Solicitamos el dispositivo. 
      // Nota: El navegador pedirá la clave/PIN después de seleccionar el equipo.
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '00001101-0000-1000-8000-00805f9b34fb', // Serial Port (Suele pedir credenciales)
          '0000ffe0-0000-1000-8000-00805f9b34fb'  // Custom Emerson/MicroMotion
        ]
      });

      setLogBT(prev => [...prev, `📦 Dispositivo seleccionado: ${device.name || 'Desconocido'}`]);
      setLogBT(prev => [...prev, "🔐 Vinculando... (Introduce usuario/clave si el sistema lo solicita)"]);

      const server = await device.gatt.connect();
      setBtStatus('CONNECTED');
      setLogBT(prev => [...prev, "✅ CONEXIÓN ESTABLECIDA"]);

      // Intentamos descubrir los servicios para identificar dónde están los 4 datos
      const services = await server.getPrimaryServices();
      setLogBT(prev => [...prev, `📊 Se detectaron ${services.length} servicios disponibles.`]);

      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('IDLE');
        setLogBT(prev => [...prev, "⚠️ Dispositivo desconectado."]);
      });

    } catch (error: any) {
      console.error(error);
      setBtStatus('ERROR');
      setLogBT(prev => [...prev, `❌ ERROR: ${error.message}`]);
    }
  };

  const handleFileUpload = async (e: any, isEdit: boolean = false) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `referencias/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('evidencias')
      .upload(filePath, file);

    if (uploadError) {
      alert("Error al subir foto");
    } else {
      const { data } = supabase.storage.from('evidencias').getPublicUrl(filePath);
      if (isEdit) setTempEdit({ ...tempEdit, foto_url: data.publicUrl });
      else setNuevo({ ...nuevo, foto_url: data.publicUrl });
    }
    setLoading(false);
  };

  const agregarEquipo = async () => {
    if (!nuevo.tag_id || !nuevo.nombre) return alert("Completa los campos");
    const { error } = await supabase.from('cat_equipos').insert([nuevo]);
    if (!error) {
      setNuevo({ tag_id: '', nombre: '', seccion: 'REFINERIA', foto_url: '' });
      cargarEquipos();
    }
  };

  const actualizarEquipo = async () => {
    const { error } = await supabase.from('cat_equipos').update(tempEdit).eq('id', editandoId);
    if (!error) {
      setEditandoId(null);
      cargarEquipos();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Gestión de Equipos</h1>
            <p className="text-slate-500 font-medium">Configuración y Test de Comunicación BT</p>
          </div>
          
          {/* BOTÓN DE ESCANEO */}
          <button 
            onClick={iniciarEscaneoBT}
            className={`px-6 py-3 rounded-2xl font-black text-xs transition-all shadow-lg flex items-center gap-2 ${
              btStatus === 'CONNECTED' ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {btStatus === 'SCANNING' ? 'BUSCANDO...' : '⚡ ESCANEAR BLUETOOTH'}
          </button>
        </div>

        {/* CONSOLA DE LOGS BLUETOOTH */}
        {(btStatus !== 'IDLE' || logBT.length > 0) && (
          <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[10px] text-blue-300 shadow-2xl border-4 border-slate-800">
            <div className="flex justify-between border-b border-slate-700 pb-2 mb-2">
              <span className="text-slate-500">BT_DEBUG_CONSOLE_V1</span>
              <button onClick={() => {setLogBT([]); setBtStatus('IDLE');}} className="text-red-400 hover:text-red-300">LIMPIAR</button>
            </div>
            <div className="h-32 overflow-y-auto space-y-1">
              {logBT.map((line, i) => (
                <div key={i}>{`> ${line}`}</div>
              ))}
            </div>
          </div>
        )}

        {/* FORMULARIO AGREGAR */}
        <div className="grid md:grid-cols-4 gap-4 bg-white p-6 rounded-[30px] shadow-sm border border-slate-200">
          <input type="text" placeholder="TAG ID (ej. CPO-01)" className="p-3 bg-slate-50 rounded-xl border-none text-xs font-bold" value={nuevo.tag_id} onChange={e => setNuevo({...nuevo, tag_id: e.target.value})} />
          <input type="text" placeholder="NOMBRE DEL EQUIPO" className="p-3 bg-slate-50 rounded-xl border-none text-xs font-bold" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
          <select className="p-3 bg-slate-50 rounded-xl border-none text-xs font-bold uppercase" value={nuevo.seccion} onChange={e => setNuevo({...nuevo, seccion: e.target.value})}>
            <option value="REFINERIA">REFINERÍA</option>
            <option value="EXTRACTORA">EXTRACTORA</option>
          </select>
          <div className="flex gap-2">
            <label className="flex-1 bg-slate-100 p-3 rounded-xl text-[10px] font-black text-center cursor-pointer hover:bg-slate-200 transition-colors">
              {loading ? "..." : "📸 FOTO REF"}
              <input type="file" hidden onChange={handleFileUpload} />
            </label>
            <button onClick={agregarEquipo} className="flex-1 bg-slate-900 text-white p-3 rounded-xl text-[10px] font-black hover:bg-black transition-all">GUARDAR</button>
          </div>
        </div>

        {/* TABLA DE EQUIPOS */}
        <div className="bg-white rounded-[35px] shadow-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Referencia</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Tag ID</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Nombre</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Sección</th>
                <th className="p-4 text-center text-[10px] font-black text-slate-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium text-slate-700">
              {equipos.map((eq) => (
                <tr key={eq.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    {eq.foto_url ? (
                      <div className="relative group">
                        <img src={eq.foto_url} className="w-12 h-12 rounded-xl object-cover shadow-md group-hover:scale-110 transition-transform" />
                        {editandoId === eq.id && (
                          <label className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center cursor-pointer">
                            <span className="text-[8px] text-white">🔄</span>
                            <input type="file" hidden onChange={(e) => handleFileUpload(e, true)} />
                          </label>
                        )}
                      </div>
                    ) : <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300">N/A</div>}
                  </td>
                  <td className="p-4">
                    {editandoId === eq.id ? (
                      <input className="border-b-2 border-blue-500 outline-none w-full bg-transparent p-1 font-bold" value={tempEdit.tag_id} onChange={e => setTempEdit({...tempEdit, tag_id: e.target.value})} />
                    ) : <span className="font-black text-slate-900">{eq.tag_id}</span>}
                  </td>
                  <td className="p-4">
                    {editandoId === eq.id ? (
                      <input className="border-b-2 border-blue-500 outline-none w-full bg-transparent p-1" value={tempEdit.nombre} onChange={e => setTempEdit({...tempEdit, nombre: e.target.value})} />
                    ) : eq.nombre}
                  </td>
                  <td className="p-4">
                    {editandoId === eq.id ? (
                      <select className="border-b-2 border-blue-500 outline-none bg-transparent p-1 w-full" value={tempEdit.seccion} onChange={e => setTempEdit({...tempEdit, seccion: e.target.value})}>
                        <option value="REFINERIA">REFINERÍA</option>
                        <option value="EXTRACTORA">EXTRACTORA</option>
                      </select>
                    ) : <span className="bg-slate-100 px-3 py-1 rounded-full text-[9px] font-black uppercase">{eq.seccion}</span>}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-3 text-lg">
                      {editandoId === eq.id ? (
                        <>
                          <button onClick={actualizarEquipo} className="text-green-600">💾</button>
                          <button onClick={() => setEditandoId(null)} className="text-gray-400">❌</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditandoId(eq.id); setTempEdit(eq); }} className="text-blue-500 hover:scale-110 transition-transform">✏️</button>
                          <button onClick={async () => { if(confirm(`¿Eliminar ${eq.tag_id}?`)) { await supabase.from('cat_equipos').delete().eq('id', eq.id); cargarEquipos(); } }} className="text-red-400 hover:scale-110 transition-transform">🗑️</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}