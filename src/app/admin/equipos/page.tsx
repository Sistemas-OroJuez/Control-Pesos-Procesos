'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function GestionEquipos() {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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

  const handleFileUpload = async (e: any) => {
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
      setNuevo({ ...nuevo, foto_url: data.publicUrl });
      alert("Foto de referencia cargada");
    }
    setLoading(false);
  };

  const guardar = async () => {
    if (!nuevo.tag_id || !nuevo.nombre) return alert("Completa los campos obligatorios");
    setLoading(true);
    const { error } = await supabase.from('cat_equipos').insert([nuevo]);
    if (!error) {
      alert("Lector registrado con éxito en la base de datos");
      setNuevo({ tag_id: '', nombre: '', seccion: 'REFINERIA', foto_url: '' });
      cargarEquipos();
    } else {
      alert("Error al guardar: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black uppercase italic border-b-4 border-blue-600 inline-block text-slate-800">
            Configuración de Lectores IDs
          </h1>
          <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Base de datos para anclaje de OCR</p>
        </header>

        {/* Formulario de Registro */}
        <div className="bg-white p-6 rounded-3xl shadow-xl mb-8 border-2 border-slate-900">
          <h2 className="text-xs font-black text-blue-600 mb-6 uppercase tracking-tighter">Registrar Nuevo Dispositivo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Tag ID (Debe ser exacto al visor)</label>
                <input 
                  placeholder="EJ: EH_8KBB_XB05A1" 
                  className="w-full p-3 border-2 rounded-xl font-mono text-blue-600 uppercase focus:border-blue-400 outline-none"
                  value={nuevo.tag_id}
                  onChange={(e) => setNuevo({...nuevo, tag_id: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Nombre Descriptivo</label>
                <input 
                  placeholder="EJ: Medidor ACP Entrada" 
                  className="w-full p-3 border-2 rounded-xl focus:border-blue-400 outline-none"
                  value={nuevo.nombre}
                  onChange={(e) => setNuevo({...nuevo, nombre: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Sección de Planta</label>
                <select 
                  className="w-full p-3 border-2 rounded-xl font-bold bg-gray-50 outline-none"
                  value={nuevo.seccion}
                  onChange={(e) => setNuevo({...nuevo, seccion: e.target.value})}
                >
                  <option value="REFINERIA">REFINERÍA</option>
                  <option value="EXTRACTORA">EXTRACTORA</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col justify-between space-y-4">
              <div className="flex-1 border-dashed border-4 border-gray-100 rounded-2xl flex flex-col items-center justify-center p-4 bg-gray-50">
                {nuevo.foto_url ? (
                  <img src={nuevo.foto_url} alt="Referencia" className="h-32 w-full object-cover rounded-xl shadow-md" />
                ) : (
                  <div className="text-center">
                    <span className="text-4xl">📸</span>
                    <p className="text-[9px] font-black text-gray-400 uppercase mt-2">Tomar foto de referencia</p>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  onChange={handleFileUpload}
                  className="mt-4 text-xs font-bold"
                />
              </div>
              <button 
                onClick={guardar} 
                disabled={loading}
                className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:bg-gray-300"
              >
                {loading ? 'Procesando...' : 'Guardar en Catálogo'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de Lectores Activos */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-widest">
                <tr>
                  <th className="p-4">Referencia</th>
                  <th className="p-4">Tag ID / OCR Anchor</th>
                  <th className="p-4">Nombre del Equipo</th>
                  <th className="p-4">Ubicación</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm bg-white">
                {equipos.map(eq => (
                  <tr key={eq.id} className="hover:bg-blue-50 transition-colors">
                    <td className="p-4">
                      {eq.foto_url ? (
                        <img src={eq.foto_url} className="h-10 w-10 rounded-lg object-cover border-2 border-white shadow-sm" />
                      ) : <span className="text-gray-300 italic text-[10px]">Sin foto</span>}
                    </td>
                    <td className="p-4 font-mono font-black text-blue-600 tracking-tighter">{eq.tag_id}</td>
                    <td className="p-4 font-bold text-slate-700">{eq.nombre}</td>
                    <td className="p-4">
                      <span className="bg-slate-100 px-3 py-1 rounded-full text-[9px] font-black text-slate-600">{eq.seccion}</span>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        className="text-red-400 hover:text-red-700 transition-colors"
                        onClick={async () => {
                          if(confirm(`¿Desea eliminar el lector ${eq.tag_id}?`)) {
                            await supabase.from('cat_equipos').delete().eq('id', eq.id);
                            cargarEquipos();
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}