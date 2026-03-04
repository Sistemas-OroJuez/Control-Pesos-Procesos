'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ParametrosAdmin() {
  const router = useRouter();
  const [tab, setTab] = useState<'proveedor' | 'variedad' | 'turno'>('proveedor');
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nuevoValor, setNuevoValor] = useState('');

  useEffect(() => {
    cargarParametros();
  }, [tab]);

  async function cargarParametros() {
    setLoading(true);
    // Filtramos la tabla 'parametros' por la categoría de la pestaña activa
    const { data } = await supabase
      .from('parametros')
      .select('*')
      .eq('categoria', tab)
      .order('valor');
    if (data) setLista(data);
    setLoading(false);
  }

  async function guardar() {
    if (!nuevoValor) return;
    
    if (editandoId) {
      await supabase.from('parametros')
        .update({ valor: nuevoValor.toUpperCase() })
        .eq('id', editandoId);
      setEditandoId(null);
    } else {
      await supabase.from('parametros').insert([{ 
        valor: nuevoValor.toUpperCase(), 
        categoria: tab,
        activo: true 
      }]);
    }
    setNuevoValor('');
    cargarParametros();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar?")) return;
    await supabase.from('parametros').delete().eq('id', id);
    cargarParametros();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <nav className="bg-slate-900 p-4 shadow-xl border-b-8 border-red-700 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-white font-black uppercase italic text-xl tracking-tighter">Configuración ORJ</h1>
          <button onClick={() => router.push('/dashboard')} className="text-[10px] font-black text-red-500 bg-white/10 px-4 py-2 rounded-xl">VOLVER</button>
        </div>
        <div className="flex gap-1 mt-6 max-w-4xl mx-auto bg-slate-800 p-1 rounded-2xl">
          {['proveedor', 'variedad', 'turno'].map((t) => (
            <button 
              key={t} 
              onClick={() => { setTab(t as any); setEditandoId(null); }} 
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${tab === t ? 'bg-red-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              {t}s
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-4xl mx-auto space-y-6">
        {/* FORMULARIO ÚNICO ADAPTATIVO */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-red-50 space-y-4">
          <p className="text-[10px] font-black text-red-700 uppercase">
            {editandoId ? `✏️ Editando ${tab}` : `➕ Nuevo ${tab}`}
          </p>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={`NOMBRE DEL ${tab.toUpperCase()}`}
              className="flex-1 p-4 border-2 rounded-2xl font-black uppercase text-sm focus:border-red-500 outline-none"
              value={nuevoValor} 
              onChange={(e) => setNuevoValor(e.target.value)} 
            />
            <button onClick={guardar} className="bg-red-700 text-white px-8 rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-red-800 transition-all">
              {editandoId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* LISTADO DINÁMICO */}
        <div className="grid grid-cols-1 gap-2">
          {loading ? (
            <p className="text-center font-black text-slate-300 py-10 animate-pulse">CARGANDO...</p>
          ) : (
            lista.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <span className="font-black text-slate-700 uppercase text-xs">{item.valor}</span>
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setEditandoId(item.id); setNuevoValor(item.valor); }} 
                    className="text-blue-600 font-black text-[10px] uppercase hover:underline"
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => eliminar(item.id)} 
                    className="text-red-300 hover:text-red-600 font-black text-[10px] uppercase transition-colors"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}