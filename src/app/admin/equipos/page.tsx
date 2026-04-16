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

  // --- FUNCIÓN DE ESCANEO CON FILTROS INDUSTRIALES ---
  const iniciarEscaneoBT = async () => {
    setBtStatus('SCANNING');
    setLogBT(["Buscando visor Micro Motion...", "Nota: Si no aparece, asegúrate que esté en modo visible."]);

    try {
      // Aplicamos filtros por nombre y servicios para forzar el handshake de seguridad
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { namePrefix: 'MMI' },
          { namePrefix: 'Micro' },
          { namePrefix: 'Emerson' }
        ],
        optionalServices: [
          '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Service (SPP)
          '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
          '0000ffe0-0000-1000-8000-00805f9b34fb'  // Emerson Custom Service
        ]
      });

      setLogBT(prev => [...prev, `📦 Dispositivo: ${device.name || 'Sin nombre'}`]);
      setLogBT(prev => [...prev, "🔐 Solicitando conexión segura..."]);

      // Al conectar al servidor GATT, el navegador debería pedir el PIN/Clave
      const server = await device.gatt.connect();
      
      setBtStatus('CONNECTED');
      setLogBT(prev => [...prev, "✅ CONEXIÓN EXITOSA CON EL EQUIPO"]);

      // Intentamos listar los servicios disponibles para identificar la trama de datos
      const services = await server.getPrimaryServices();
      setLogBT(prev => [...prev, `📊 Servicios detectados: ${services.length}`]);
      
      services.forEach((s: any) => {
        setLogBT(prev => [...prev, `-> UUID: ${s.uuid}`]);
      });

      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('IDLE');
        setLogBT(prev => [...prev, "⚠️ Conexión terminada por el dispositivo."]);
      });

    } catch (error: any) {
      console.error(error);
      setBtStatus('ERROR');
      setLogBT(prev => [...prev, `❌ ERROR: ${error.message}`]);
      if (error.message.includes("User cancelled")) {
        setLogBT(prev => [...prev, "Tip: El usuario canceló la selección."]);
      }
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
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-[30px] shadow-sm border border-slate-100">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">Gestión de Equipos</h1>
            <p className="text-slate-500 font-medium">Configuración de Lectores e Interfaz BT</p>
          </div>
          
          <button 
            onClick={iniciarEscaneoBT}
            className={`px-6 py-4 rounded-2xl font-black text-xs transition-all shadow-xl flex items-center gap-2 ${
              btStatus === 'CONNECTED' ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {btStatus === 'SCANNING' ? 'BUSCANDO...' : '⚡ ESCANEAR VISOR BT'}
          </button>
        </div>

        {/* CONSOLA DE LOGS */}
        {(btStatus !== 'IDLE' || logBT.length > 0) && (
          <div className="bg-slate-900 rounded-3xl p-5 font-mono text-[11px] text-blue-300 shadow-2xl border-4 border-slate-800">
            <div className="flex justify-between border-b border-slate-700 pb-3 mb-3">
              <span className="text-slate-500 font-bold uppercase">BT_Status_Monitor</span>
              <button onClick={() => {setLogBT([]); setBtStatus('IDLE');}} className="text-rose-400 hover:text-rose-300 font-bold">CERRAR</button>
            </div>
            <div className="h-40 overflow-y-auto space-y-1 scrollbar-hide">
              {logBT.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                  <span>{`> ${line}`}</span>
                </div>
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
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase">Referencia</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase">Tag ID</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase">Nombre</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase">Sección</th>
                <th className="p-5 text-center text-[10px] font-black text-slate-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium">
              {equipos.map((eq) => (
                <tr key={eq.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                  <td className="p-4">
                    {eq.foto_url ? (
                      <div className="relative group">
                        <img src={eq.foto_url} className="w-14 h-14 rounded-2xl object-cover shadow-md group-hover:scale-110 transition-transform duration-300" />
                        {editandoId === eq.id && (
                          <label className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center cursor-pointer">
                            <span className="text-[10px] text-white">🔄</span>
                            <input type="file" hidden onChange={(e) => handleFileUpload(e, true)} />
                          </label>
                        )}
                      </div>
                    ) : <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300">N/A</div>}
                  </td>
                  <td className="p-4">
                    {editandoId === eq.id ? (
                      <input className="border-b-2 border-blue-500 outline-none w-full bg-transparent p-1 font-bold" value={tempEdit.tag_id} onChange={e => setTempEdit({...tempEdit, tag_id: e.target.value})} />
                    ) : <span className="font-black text-slate-900 text-sm">{eq.tag_id}</span>}
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
                    ) : <span className="bg-slate-100 px-4 py-1 rounded-full text-[9px] font-black uppercase text-slate-600">{eq.seccion}</span>}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-4 text-xl">
                      {editandoId === eq.id ? (
                        <>
                          <button onClick={actualizarEquipo} className="text-emerald-600">💾</button>
                          <button onClick={() => setEditandoId(null)} className="text-slate-400">❌</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditandoId(eq.id); setTempEdit(eq); }} className="text-blue-500 hover:scale-125 transition-transform">✏️</button>
                          <button onClick={async () => { if(confirm(`¿Eliminar ${eq.tag_id}?`)) { await supabase.from('cat_equipos').delete().eq('id', eq.id); cargarEquipos(); } }} className="text-rose-400 hover:scale-125 transition-transform">🗑️</button>
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