'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function GestionEquipos() {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [tempEdit, setTempEdit] = useState<any>(null);

  // --- ESTADOS PARA BLUETOOTH MODO SMARTBLUE ---
  const [btStatus, setBtStatus] = useState<'IDLE' | 'SCANNING' | 'CONNECTED' | 'ERROR'>('IDLE');
  const [logBT, setLogBT] = useState<string[]>([]);
  
  const [nuevo, setNuevo] = useState({ 
    tag_id: '', 
    nombre: '', 
    seccion: 'REFINERIA',
    foto_url: '' 
  });

  useEffect(() => { cargarEquipos(); }, []);

  const cargarEquipos = async () => {
    const { data } = await supabase.from('cat_equipos').select('*').order('created_at', { ascending: false });
    if (data) setEquipos(data);
  };

  const iniciarEscaneoBT = async () => {
    setBtStatus('SCANNING');
    setLogBT([
      "🔄 INICIANDO PROTOCOLO SMART-GATEWAY...",
      "Buscando UUIDs industriales de Endress+Hauser/Emerson...",
      "Asegúrate de cerrar SmartBlue en tu celular antes de probar aquí."
    ]);

    try {
      // 1. Solicitamos el dispositivo permitiendo los servicios que usa SmartBlue
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '0000fee0-0000-1000-8000-00805f9b34fb', // Servicio principal SmartBlue/Endress
          '0000fee1-0000-1000-8000-00805f9b34fb', // Configuración segura
          '0000180a-0000-1000-8000-00805f9b34fb', // Device Info
          '00001101-0000-1000-8000-00805f9b34fb'  // Serial Port
        ]
      });

      setLogBT(prev => [...prev, `📦 Equipo detectado: ${device.name}`]);
      setLogBT(prev => [...prev, "🔐 Forzando emparejamiento GATT..."]);

      // 2. Intentamos la conexión. 
      // Al incluir los servicios FEE0 y FEE1, el visor debería aceptar el handshake.
      const server = await device.gatt.connect();
      
      setBtStatus('CONNECTED');
      setLogBT(prev => [...prev, "✅ CONEXIÓN ESTABLECIDA", "Ahora el sistema debería pedirte el login."]);

      const services = await server.getPrimaryServices();
      setLogBT(prev => [...prev, `Servicios disponibles: ${services.length}`]);

    } catch (error: any) {
      console.error(error);
      setBtStatus('ERROR');
      setLogBT(prev => [...prev, `❌ FALLO: ${error.message}`]);
    }
  };

  // ... (Resto de tus funciones de Supabase se mantienen igual)
  const handleFileUpload = async (e: any, isEdit: boolean = false) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `referencias/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('evidencias').upload(filePath, file);
    if (!uploadError) {
      const { data } = supabase.storage.from('evidencias').getPublicUrl(filePath);
      if (isEdit) setTempEdit({ ...tempEdit, foto_url: data.publicUrl });
      else setNuevo({ ...nuevo, foto_url: data.publicUrl });
    }
    setLoading(false);
  };

  const agregarEquipo = async () => {
    if (!nuevo.tag_id || !nuevo.nombre) return alert("Completa los campos");
    const { error } = await supabase.from('cat_equipos').insert([nuevo]);
    if (!error) { setNuevo({ tag_id: '', nombre: '', seccion: 'REFINERIA', foto_url: '' }); cargarEquipos(); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-[35px] shadow-sm border border-slate-200">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase">Gestión de Equipos</h1>
            <p className="text-slate-500 font-medium tracking-tight">Protocolo Industrial BT (SmartBlue Compatible)</p>
          </div>
          
          <button 
            onClick={iniciarEscaneoBT}
            className={`px-8 py-4 rounded-2xl font-black text-xs transition-all shadow-xl ${
              btStatus === 'CONNECTED' ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {btStatus === 'SCANNING' ? '🔍 BUSCANDO...' : '⚡ CONECTAR AL VISOR'}
          </button>
        </div>

        {/* CONSOLA DE LOGS */}
        {(btStatus !== 'IDLE' || logBT.length > 0) && (
          <div className="bg-slate-900 rounded-[30px] p-6 font-mono text-[11px] text-cyan-400 shadow-2xl border-4 border-slate-800">
            <div className="flex justify-between border-b border-slate-700 pb-3 mb-3 text-slate-500 uppercase font-bold">
              <span>Smart_Interface_Log</span>
              <button onClick={() => {setLogBT([]); setBtStatus('IDLE');}} className="text-rose-400">Limpiar</button>
            </div>
            <div className="h-40 overflow-y-auto space-y-1">
              {logBT.map((line, i) => (
                <div key={i}>{`> ${line}`}</div>
              ))}
            </div>
          </div>
        )}

        {/* ... (Tu tabla de equipos debajo) */}
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden p-6">
            <p className="text-xs text-slate-400 mb-4">Lista de equipos registrados para auditoría</p>
            {/* Aquí va tu tabla actual */}
        </div>
      </div>
    </div>
  );
}