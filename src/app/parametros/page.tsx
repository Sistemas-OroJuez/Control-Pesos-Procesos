'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ParametrosAdmin() {
  const router = useRouter();
  const [categoria, setCategoria] = useState('variedad');
  const [valor, setValor] = useState('');
  const [lista, setLista] = useState([]);

  useEffect(() => {
    cargarParametros();
  }, []);

  async function cargarParametros() {
    const { data } = await supabase.from('parametros').select('*').order('created_at', { ascending: false });
    if (data) setLista(data);
  }

  async function guardar() {
    if (!valor) return;
    const { error } = await supabase.from('parametros').insert([{ categoria, valor }]);
    if (!error) {
      setValor('');
      cargarParametros();
    }
  }

  async function eliminar(id) {
    await supabase.from('parametros').delete().eq('id', id);
    cargarParametros();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <nav className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/dashboard')} className="bg-white p-2 rounded-lg shadow-sm font-bold text-xs border">← VOLVER</button>
        <h1 className="text-red-700 font-black uppercase tracking-tighter text-xl">Configuración de Parámetros</h1>
      </nav>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 mb-6">
        <p className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Agregar Nuevo Parámetro</p>
        <div className="space-y-4">
          <select 
            className="w-full p-4 bg-gray-50 border rounded-2xl font-bold"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="variedad">Variedad de Producto</option>
            <option value="proveedor">Proveedor MP</option>
            <option value="area">Área / Departamento</option>
          </select>
          <input 
            type="text" 
            placeholder="Nombre (Ejem: Alto Oleico)" 
            className="w-full p-4 border rounded-2xl font-bold"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <button 
            onClick={guardar}
            className="w-full bg-gray-800 text-white p-4 rounded-2xl font-black uppercase text-xs"
          >
            Guardar en el Sistema
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Parámetros Activos</p>
        {lista.map((p) => (
          <div key={p.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border shadow-sm">
            <div>
              <p className="text-[8px] font-black text-red-700 uppercase">{p.categoria}</p>
              <p className="font-bold text-gray-800 uppercase">{p.valor}</p>
            </div>
            <button onClick={() => eliminar(p.id)} className="text-red-200 hover:text-red-600 transition-colors">🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}
