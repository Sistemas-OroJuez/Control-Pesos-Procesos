'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function GestionEquipos() {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [tempEdit, setTempEdit] = useState<any>(null);

  // --- ESTADOS PARA BLUETOOTH Y SEGURIDAD ---
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

  // --- FUNCIÓN PARA FORZAR LOGIN (USUARIO/CLAVE) ---
  const iniciarEscaneoBT = async () => {
    setBtStatus('SCANNING');
    setLogBT([
      "Buscando dispositivos...",
      "1. Selecciona tu visor Micro Motion en la lista.",
      "2. Al conectar, el sistema te pedirá USUARIO y CLAVE."
    ]);

    try {
      // Usamos acceptAllDevices para que el equipo no se oculte por filtros
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '00001101-0000-1000-8000-00805f9b34fb', // Serial Port (Handshake industrial)
          '0000180a-0000-1000-8000-00805f9b34fb', // Device Info
          '0000ffe0-0000-1000-8000-00805f9b34fb'  // Emerson/Custom
        ]
      });

      setLogBT(prev => [...prev, `📦 Equipo seleccionado: ${device.name || 'Desconocido'}`]);
      setLogBT(prev => [...prev, "🔐 SOLICITANDO ACCESO SEGURO..."]);

      // CRÍTICO: .connect() es lo que dispara la ventana de credenciales del OS
      const server = await device.gatt.connect();
      
      setBtStatus('CONNECTED');
      setLogBT(prev => [...prev, "✅ AUTENTICACIÓN EXITOSA", "Conexión establecida con éxito."]);

      // Listamos servicios para confirmar el acceso
      const services = await server.getPrimaryServices();
      setLogBT(prev => [...prev, `📊 Servicios autorizados: ${services.length}`]);

      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('IDLE');
        setLogBT(prev => [...prev, "⚠️ El equipo se ha desconectado."]);
      });

    } catch (error: any) {
      console.error(error);
      setBtStatus('ERROR');
      let errorMsg = error.message;
      
      if (errorMsg.includes("User cancelled")) {
        errorMsg = "Cancelado por el usuario.";
      } else if (errorMsg.includes("SecurityError")) {
        errorMsg = "Error de Seguridad: Credenciales incorrectas o rechazadas.";
      }
      
      setLogBT(prev => [...prev, `❌ ERROR: ${errorMsg}`]);
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
        
        <div className="flex justify-between items-center bg-white p-6 rounded-[35px] shadow-sm border border-slate-100">
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
            {btStatus === 'SCANNING' ? '🔍 ESCANEANDO...' : '⚡ TEST CONEXIÓN SEGURA'}
          </button>
        </div>

        {/* CONSOLA DE SEGURIDAD BT */}
        {(btStatus !== 'IDLE' || logBT.length > 0) && (
          <div className="bg-slate-900 rounded-[30px] p-6 font-mono text-[11px] text-blue-300 shadow-2xl border-4 border-slate-800">
            <div className="flex justify-between border-b border-slate-700 pb-3 mb-3">
              <span className="text-slate-500 font-bold uppercase tracking-widest">BT_Security_Log</span>
              <button onClick={() => {setLogBT([]); setBtStatus('IDLE');}} className="text-rose-400 font-bold hover:text-rose-300">REINICIAR</button>
            </div>
            <div className="h-40 overflow-y-auto space-y-1 scrollbar-hide">
              {logBT.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-600">[{i}]</span>
                  <span className={line.startsWith('✅') ? 'text-emerald-400' : line.startsWith('❌') ? 'text-rose-400' : ''}>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FORMULARIO AGREGAR */}
        <div className="grid md:grid-cols-4 gap-4 bg-white p-6 rounded-[30px] shadow-sm border border-slate-200">
          <input type="text" placeholder="TAG ID" className="p-3 bg-slate-50 rounded-xl border-none text-xs font-bold" value={nuevo.tag_id} onChange={e => setNuevo({...nuevo, tag_id: e.target.value})} />
          <input type="text" placeholder="NOMBRE" className="p-3 bg-slate-50 rounded-xl border-none text-xs font-bold" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
          <select className="p-3 bg-slate-50 rounded-xl border-none text-xs font-bold uppercase" value={nuevo.seccion} onChange={e => setNuevo({...nuevo, seccion: e.target.value})}>
            <option value="REFINERIA">REFINERÍA</option>
            <option value="EXTRACTORA">EXTRACTORA</option>
          </select>
          <div className="flex gap-2">
            <label className="flex-1 bg-slate-100 p-3 rounded-xl text-[10px] font-black text-center cursor-pointer hover:bg-slate-200 transition-colors">
              {loading ? "..." : "📸 FOTO"}
              <input type="file" hidden onChange={handleFileUpload} />
            </label>
            <button onClick={agregarEquipo} className="flex-1 bg-slate-900 text-white p-3 rounded-xl text-[10px] font-black hover:bg-black transition-all">GUARDAR</button>
          </div>
        </div>

        {/* TABLA DE EQUIPOS */}
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Referencia</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tag ID</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium text-slate-700">
              {equipos.map((eq) => (
                <tr key={eq.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    {eq.foto_url ? (
                      <img src={eq.foto_url} className="w-14 h-14 rounded-2xl object-cover shadow-md" />
                    ) : <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 text-[10px]">N/A</div>}
                  </td>
                  <td className="p-4"><span className="font-black text-slate-900 text-sm uppercase">{eq.tag_id}</span></td>
                  <td className="p-4 uppercase">{eq.nombre}</td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-4 text-xl">
                      <button onClick={() => { setEditandoId(eq.id); setTempEdit(eq); }} className="text-blue-500 hover:scale-125 transition-transform">✏️</button>
                      <button onClick={async () => { if(confirm(`¿Eliminar ${eq.tag_id}?`)) { await supabase.from('cat_equipos').delete().eq('id', eq.id); cargarEquipos(); } }} className="text-rose-400 hover:scale-125 transition-transform">🗑️</button>
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