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
  const [btDevice, setBtDevice] = useState<any>(null);
  
  // Estados para el Login del Visor
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [btUser, setBtUser] = useState('admin');
  const [btPass, setBtPass] = useState('0000');

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

  const agregarLog = (msj: string) => {
    setLogBT(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msj}`]);
  };

  const iniciarEscaneoBT = async () => {
    setBtStatus('SCANNING');
    setLogBT([
      "🔄 INICIANDO PROTOCOLO SMART-GATEWAY...",
      "Buscando servicios industriales (E+H / Emerson)...",
      "Asegúrate que el visor no esté conectado a otro celular."
    ]);

    try {
      // Solicitamos el dispositivo con el servicio estándar de SmartBlue (fee0)
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['0000fee0-0000-1000-8000-00805f9b34fb']
      });

      agregarLog(`Dispositivo encontrado: ${device.name}`);
      
      const server = await device.gatt.connect();
      setBtDevice(device);
      setBtStatus('CONNECTED');
      setMostrarLogin(true); // Activamos el formulario de credenciales
      
      agregarLog("✅ CONECTADO AL GATT SERVER");
      agregarLog("🔐 ESPERANDO CREDENCIALES DE ACCESO...");

    } catch (error: any) {
      console.error(error);
      setBtStatus('ERROR');
      agregarLog(`❌ ERROR: ${error.message}`);
    }
  };

  const desbloquearVisor = async () => {
    if (!btDevice) return;
    agregarLog(`Intentando login con usuario: ${btUser}...`);

    try {
      const server = await btDevice.gatt.connect();
      const service = await server.getPrimaryService('0000fee0-0000-1000-8000-00805f9b34fb');
      
      // Intentamos obtener las características de escritura (Login)
      const characteristics = await service.getCharacteristics();
      agregarLog(`Canales de datos detectados: ${characteristics.length}`);

      // Protocolo SmartBlue: Enviamos el User/Pass en formato binario
      const encoder = new TextEncoder();
      const authPayload = encoder.encode(`${btUser}:${btPass}`);
      
      // Normalmente la característica de escritura es la primera o segunda (fee1/fee2)
      // Esto varía según la versión del firmware del visor
      await characteristics[0].writeValue(authPayload);
      
      agregarLog("🚀 COMANDO DE AUTENTICACIÓN ENVIADO");
      agregarLog("Esperando respuesta del hardware...");
      
    } catch (err: any) {
      agregarLog(`❌ FALLO DE AUTENTICACIÓN: ${err.message}`);
    }
  };

  const desconectarBT = () => {
    if (btDevice && btDevice.gatt.connected) {
      btDevice.gatt.disconnect();
    }
    setBtStatus('IDLE');
    setBtDevice(null);
    setMostrarLogin(false);
    agregarLog("🔌 DISPOSITIVO DESCONECTADO");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* CABECERA CON BOTÓN BT */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-800 italic">GESTIÓN DE EQUIPOS</h1>
            <p className="text-slate-400 text-xs font-bold uppercase mt-1 tracking-widest">Configuración y Enlace Industrial</p>
          </div>
          
          <div className="flex gap-2 mt-4 md:mt-0">
            {btStatus === 'CONNECTED' ? (
              <button onClick={desconectarBT} className="bg-rose-500 text-white px-8 py-4 rounded-2xl font-black text-xs shadow-lg hover:bg-rose-600 transition-all">
                DESCONECTAR
              </button>
            ) : (
              <button 
                onClick={iniciarEscaneoBT}
                className={`px-8 py-4 rounded-2xl font-black text-xs transition-all shadow-xl ${
                  btStatus === 'SCANNING' ? 'bg-amber-500 text-white animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {btStatus === 'SCANNING' ? '🔍 BUSCANDO...' : '⚡ CONECTAR VISOR BT'}
              </button>
            )}
          </div>
        </div>

        {/* PANEL DE CONTROL BT (CONSOLA Y LOGIN) */}
        {(btStatus !== 'IDLE' || logBT.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* CONSOLA DE LOGS */}
            <div className="bg-slate-900 rounded-[30px] p-6 font-mono text-[11px] text-cyan-400 shadow-2xl border-4 border-slate-800">
              <div className="flex justify-between border-b border-slate-700 pb-3 mb-3 text-slate-500 uppercase font-bold">
                <span>Smart_Interface_Log</span>
                <button onClick={() => {setLogBT([]); setBtStatus('IDLE');}} className="text-rose-400 hover:underline">Limpiar</button>
              </div>
              <div className="h-48 overflow-y-auto space-y-1 custom-scrollbar">
                {logBT.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-600">[{i}]</span>
                    <span>{`> ${line}`}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* FORMULARIO DE LOGIN INDUSTRIAL */}
            {mostrarLogin && (
              <div className="bg-white rounded-[30px] p-8 border-2 border-blue-500 shadow-xl flex flex-col justify-center space-y-4">
                <div className="text-center">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Acceso Nivel 2 Requerido</span>
                  <h3 className="text-xl font-black text-slate-800">DESBLOQUEO SMARTBLUE</h3>
                </div>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Usuario (ej: admin)" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 ring-blue-500"
                    value={btUser}
                    onChange={(e) => setBtUser(e.target.value)}
                  />
                  <input 
                    type="password" 
                    placeholder="Clave (ej: 0000)" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 ring-blue-500"
                    value={btPass}
                    onChange={(e) => setBtPass(e.target.value)}
                  />
                  <button 
                    onClick={desbloquearVisor}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-xs hover:bg-blue-700 shadow-lg active:scale-95 transition-all"
                  >
                    🔓 INICIAR TRANSMISIÓN
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LISTADO DE EQUIPOS (TABLA ACTUAL) */}
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
             <span className="font-black text-xs text-slate-500 uppercase tracking-widest">Catálogo de Activos</span>
             <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black">{equipos.length} REGISTROS</span>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-slate-400 font-black uppercase tracking-tighter border-b border-slate-50">
                <th className="p-6">TAG / ID</th>
                <th className="p-6">Nombre del Equipo</th>
                <th className="p-6">Sección</th>
                <th className="p-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {equipos.map((eq) => (
                <tr key={eq.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-6 font-black text-blue-600">{eq.tag_id}</td>
                  <td className="p-6 text-slate-700">{eq.nombre}</td>
                  <td className="p-6">
                    <span className="bg-slate-100 text-slate-500 text-[9px] px-2 py-1 rounded-md font-bold uppercase">{eq.seccion}</span>
                  </td>
                  <td className="p-6 text-right">
                    <button className="text-slate-300 hover:text-blue-600 font-bold text-xs uppercase tracking-widest">Detalles</button>
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