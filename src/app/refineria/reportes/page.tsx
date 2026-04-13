'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ReporteDiferencialRefineria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]);
  
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [filtroProducto, setFiltroProducto] = useState('TODOS');

  const CLAVE_MAESTRA = "orj2026";

  useEffect(() => {
    fetchData();
  }, [fechaInicio, fechaFin, filtroProducto]);

  const fetchData = async () => {
    setLoading(true);
    // Traemos un set de datos más amplio para poder encontrar la "lectura anterior" 
    // incluso si el primer registro del día depende del último del día anterior.
    let query = supabase
      .from('operaciones_refineria')
      .select('*')
      .order('created_at', { ascending: true });

    const { data: todosLosDatos, error } = await query;

    if (!error && todosLosDatos) {
      // Procesamos los datos para inyectar la "Lectura Anterior"
      const procesados = todosLosDatos.map((reg, index) => {
        // Buscamos el registro anterior del mismo tipo de operación
        const anterior = todosLosDatos
          .slice(0, index)
          .reverse()
          .find(r => r.tipo_operacion === reg.tipo_operacion);

        const lecturaAnterior = anterior ? parseFloat(anterior.valor_lectura) : 0;
        const lecturaActual = parseFloat(reg.valor_lectura);
        
        // El diferencial solo aplica para contadores (ACP y RBD)
        // Para Ácido Graso, el valor ya es el neto (visto en pasos anteriores)
        const esContador = reg.tipo_operacion === 'ENTRADA_ACP' || reg.tipo_operacion === 'SALIDA_RBD';
        const kgResultantes = esContador ? (lecturaActual - lecturaAnterior) : lecturaActual;

        return {
          ...reg,
          lecturaAnterior,
          kgResultantes: kgResultantes > 0 ? kgResultantes : 0
        };
      });

      // Filtramos por el rango de fechas seleccionado para la vista
      const filtrados = procesados.filter(r => {
        const fechaReg = r.created_at.split('T')[0];
        const matchFecha = fechaReg >= fechaInicio && fechaReg <= fechaFin;
        const matchProd = filtroProducto === 'TODOS' || r.tipo_operacion === filtroProducto;
        return matchFecha && matchProd;
      });

      setRegistros(filtrados.reverse()); // Mostrar más recientes arriba
    }
    setLoading(false);
  };

  const handleEdit = async (id: string, valorActual: string) => {
    const pass = prompt("CLAVE DE AUTORIZACIÓN:");
    if (pass !== CLAVE_MAESTRA) return alert("ACCESO DENEGADO");

    const nuevoValor = prompt("CORREGIR LECTURA ACTUAL (CONTADOR):", valorActual);
    if (nuevoValor) {
      await supabase.from('operaciones_refineria').update({ valor_lectura: nuevoValor }).eq('id', id);
      fetchData();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[10px] tracking-tighter">
      
      {/* FILTROS */}
      <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-zinc-500 text-[8px]">Desde</label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-black border border-white/10 p-2 rounded-lg text-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-zinc-500 text-[8px]">Hasta</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-black border border-white/10 p-2 rounded-lg text-white" />
        </div>
        <select value={filtroProducto} onChange={e => setFiltroProducto(e.target.value)} className="bg-black border border-white/10 p-2 rounded-lg h-[35px]">
          <option value="TODOS">TODOS LOS PRODUCTOS</option>
          <option value="ENTRADA_ACP">ENTRADA ACP</option>
          <option value="SALIDA_RBD">SALIDA RBD</option>
          <option value="ACIDO_GRASO">ÁCIDO GRASO</option>
        </select>
      </div>

      {/* TABLA DE DIFERENCIALES */}
      <div className="bg-zinc-900 rounded-[30px] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-zinc-500 border-b border-white/10">
                <th className="p-4">FECHA / HORA</th>
                <th className="p-4">PRODUCTO</th>
                <th className="p-4 text-right">L. ANTERIOR</th>
                <th className="p-4 text-right">L. ACTUAL</th>
                <th className="p-4 text-right bg-orange-500/10 text-orange-500">KG NETOS</th>
                <th className="p-4 text-center">FOTO</th>
                <th className="p-4 text-center">EDIT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center">PROCESANDO BALANCE...</td></tr>
              ) : registros.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 text-zinc-400">
                    {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                  </td>
                  <td className="p-4 font-black">
                    {r.tipo_operacion}
                    <div className="text-[7px] text-zinc-500">{r.variedad}</div>
                  </td>
                  <td className="p-4 text-right tabular-nums text-zinc-500">
                    {r.tipo_operacion === 'ACIDO_GRASO' ? '-' : r.lecturaAnterior.toLocaleString()}
                  </td>
                  <td className="p-4 text-right tabular-nums font-bold">
                    {parseFloat(r.valor_lectura).toLocaleString()}
                  </td>
                  <td className="p-4 text-right tabular-nums font-black text-orange-500 bg-orange-500/5">
                    {r.kgResultantes.toLocaleString()} KG
                  </td>
                  <td className="p-4 text-center">
                    <a href={r.foto_url} target="_blank" className="text-lg">📸</a>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleEdit(r.id, r.valor_lectura)} className="opacity-30 hover:opacity-100">✏️</button>
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