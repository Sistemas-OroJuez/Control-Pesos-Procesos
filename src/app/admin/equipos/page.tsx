'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function GestionEquipos() {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [tempEdit, setTempEdit] = useState<any>(null);
  
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
      if (isEdit) {
        setTempEdit({ ...tempEdit, foto_url: data.publicUrl });
      } else {
        setNuevo({ ...nuevo, foto_url: data.publicUrl });
      }
      alert("Foto cargada correctamente");
    }
    setLoading(false);
  };

  const guardarNuevo = async () => {
    if (!nuevo.tag_id || !nuevo.nombre) return alert("Completa los campos obligatorios");
    setLoading(true);
    const { error } = await supabase.from('cat_equipos').insert([nuevo]);
    if (!error) {
      setNuevo({ tag_id: '', nombre: '', seccion: 'REFINERIA', foto_url: '' });
      cargarEquipos();
    }
    setLoading(false);
  };

  const actualizarEquipo = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('cat_equipos')
      .update({
        tag_id: tempEdit.tag_id,
        nombre: tempEdit.nombre,
        seccion: tempEdit.seccion,
        foto_url: tempEdit.foto_url
      })
      .eq('id', tempEdit.id);

    if (!error) {
      setEditandoId(null);
      cargarEquipos();
      alert("Equipo actualizado");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black uppercase italic border-b-4 border-blue-600 inline-block text-slate-800">
            Configuración de Lectores IDs
          </h1>
        </header>

        {/* Formulario de Registro */}
        <div className="bg-white p-6 rounded-3xl shadow-xl mb-8 border-2 border-slate-900">
          <h2 className="text-xs font-black text-blue-600 mb-6 uppercase tracking-tighter">Registrar Nuevo Dispositivo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <input 
                placeholder="TAG ID (Ej: EH_8KBB_XB05A1)" 
                className="w-full p-3 border-2 rounded-xl font-mono text-blue-600 uppercase outline-none"
                value={nuevo.tag_id}
                onChange={(e) => setNuevo({...nuevo, tag_id: e.target.value.toUpperCase()})}
              />
              <input 
                placeholder="Nombre descriptivo" 
                className="w-full p-3 border-2 rounded-xl outline-none"
                value={nuevo.nombre}
                onChange={(e) => setNuevo({...nuevo, nombre: e.target.value})}
              />
              <select 
                className="w-full p-3 border-2 rounded-xl font-bold bg-gray-50 outline-none"
                value={nuevo.seccion}
                onChange={(e) => setNuevo({...nuevo, seccion: e.target.value})}
              >
                <option value="REFINERIA">REFINERÍA</option>
                <option value="EXTRACTORA">EXTRACTORA</option>
              </select>
            </div>

            <div className="flex flex-col space-y-4">
              <div className="flex-1 border-dashed border-4 border-gray-200 rounded-2xl flex flex-col items-center justify-center p-4 bg-gray-50 relative overflow-hidden min-h-[150px]">
                {nuevo.foto_url ? (
                  <img src={nuevo.foto_url} alt="Referencia" className="h-full w-full object-cover rounded-xl" />
                ) : (
                  <div className="text-center"><span className="text-4xl">📸</span><p className="text-[9px] font-black text-gray-400 uppercase">Foto de referencia</p></div>
                )}
                <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileUpload(e)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <button onClick={guardarNuevo} disabled={loading} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase shadow-lg disabled:bg-gray-300">
                {loading ? 'Guardando...' : 'Guardar Lector'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de Lectores */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-widest text-center">
              <tr>
                <th className="p-4">Foto</th>
                <th className="p-4">Tag ID</th>
                <th className="p-4">Nombre</th>
                <th className="p-4">Sección</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm bg-white">
              {equipos.map(eq => (
                <tr key={eq.id} className="hover:bg-blue-50 transition-colors">
                  <td className="p-4 w-24">
                    {editandoId === eq.id ? (
                      <div className="relative h-16 w-16 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden">
                        <img src={tempEdit.foto_url} className="object-cover h-full w-full" />
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileUpload(e, true)} className="absolute inset-0 opacity-0" />
                      </div>
                    ) : (
                      <img src={eq.foto_url} className="h-16 w-16 rounded-lg object-cover border shadow-sm" />
                    )}
                  </td>
                  <td className="p-4 font-mono font-black text-blue-600">
                    {editandoId === eq.id ? (
                      <input className="border p-2 w-full rounded" value={tempEdit.tag_id} onChange={e => setTempEdit({...tempEdit, tag_id: e.target.value.toUpperCase()})} />
                    ) : eq.tag_id}
                  </td>
                  <td className="p-4 font-bold">
                    {editandoId === eq.id ? (
                      <input className="border p-2 w-full rounded" value={tempEdit.nombre} onChange={e => setTempEdit({...tempEdit, nombre: e.target.value})} />
                    ) : eq.nombre}
                  </td>
                  <td className="p-4">
                    {editandoId === eq.id ? (
                      <select className="border p-2 w-full rounded" value={tempEdit.seccion} onChange={e => setTempEdit({...tempEdit, seccion: e.target.value})}>
                        <option value="REFINERIA">REFINERÍA</option>
                        <option value="EXTRACTORA">EXTRACTORA</option>
                      </select>
                    ) : <span className="bg-slate-100 px-3 py-1 rounded-full text-[9px] font-black">{eq.seccion}</span>}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-3">
                      {editandoId === eq.id ? (
                        <>
                          <button onClick={actualizarEquipo} className="text-green-600 font-bold">💾</button>
                          <button onClick={() => setEditandoId(null)} className="text-gray-400 font-bold">❌</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditandoId(eq.id); setTempEdit(eq); }} className="text-blue-500 hover:scale-125 transition-transform text-xl">✏️</button>
                          <button onClick={async () => { if(confirm(`¿Eliminar ${eq.tag_id}?`)) { await supabase.from('cat_equipos').delete().eq('id', eq.id); cargarEquipos(); } }} className="text-red-400 hover:scale-125 transition-transform text-xl">🗑️</button>
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