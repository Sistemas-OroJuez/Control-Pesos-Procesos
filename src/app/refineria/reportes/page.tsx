'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ReporteMaestroRefineria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]);
  
  // FILTROS AVANZADOS
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [filtroProceso, setFiltroProceso] = useState('TODOS');
  const [filtroVariedad, setFiltroVariedad] = useState('TODOS');
  const [filtroProducto, setFiltroProducto] = useState('TODOS');

  const CLAVE_MAESTRA = "orj2026";

  useEffect(() => {
    fetchData();
  }, [fechaInicio, fechaFin, filtroProceso, filtroVariedad, filtroProducto]);

  const fetchData = async () => {
    setLoading(true);
    const { data: todos, error } = await supabase
      .from('operaciones_refineria')
      .select('*')
      .order('tipo_operacion', { ascending: true }) // Ordenar para facilitar subtotales
      .order('created_at', { ascending: true });

    if (!error && todos) {
      const procesados = todos.map((reg, index) => {
        const anterior = todos.slice(0, index).reverse().find(r => r.tipo_operacion === reg.tipo_operacion);
        const lecturaActual = parseFloat(reg.valor_lectura);
        const lecturaAnterior = anterior ? parseFloat(anterior.valor_lectura) : lecturaActual;
        
        const esContador = reg.tipo_operacion === 'ENTRADA_ACP' || reg.tipo_operacion === 'SALIDA_RBD';
        const kg = esContador ? (lecturaActual - lecturaAnterior) : lecturaActual;

        return { ...reg, lecturaAnterior, kgResultantes: kg };
      });

      // Filtrado según selección
      const filtrados = procesados.filter(r => {
        const f = r.created_at.split('T')[0];
        return f >= fechaInicio && f <= fechaFin &&
               (filtroProceso === 'TODOS' || r.es_reproceso === (filtroProceso === 'REPROCESO')) &&
               (filtroVariedad === 'TODOS' || r.variedad === filtroVariedad) &&
               (filtroProducto === 'TODOS' || r.tipo_operacion === filtroProducto);
      });

      setRegistros(filtrados);
    }
    setLoading(false);
  };

  // --- LÓGICA DE WHATSAPP (SIN MERMA) ---
  const enviarWhatsApp = () => {
    const totales: any = {};
    registros.forEach(r => {
      const key = `${r.tipo_operacion} (${r.variedad})`;
      totales[key] = (totales[key] || 0) + r.kgResultantes;
    });

    let msg = `*📊 RESUMEN DE PRODUCCIÓN OROJUEZ*%0A`;
    msg += `*Periodo:* ${fechaInicio} al ${fechaFin}%0A%0A`;
    Object.entries(totales).forEach(([label, kg]: any) => {
      msg += `• *${label}:* ${kg.toLocaleString()} KG%0A`;
    });
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  // --- RENDERIZADO CON SUBTOTALES ---
  const renderFilasConSubtotales = () => {
    const filas: any[] = [];
    let subtotalGrupo = 0;
    let ultimoGrupo = "";

    registros.forEach((r, i) => {
      const grupoActual = `${r.tipo_operacion} - ${r.variedad}`;
      
      // Si cambia el grupo y no es el primero, insertamos fila de subtotal
      if (ultimoGrupo !== "" && ultimoGrupo !== grupoActual) {
        filas.push(
          <tr key={`sub-${i}`} className="bg-orange-500/10 font-black text-orange-500">
            <td colSpan={4} className="p-2 text-right text-[8px]">SUBTOTAL {ultimoGrupo}:</td>
            <td className="p-2 text-right border-t border-orange-500/30">{subtotalGrupo.toLocaleString()} KG</td>
            <td colSpan={2}></td>
          </tr>
        );
        subtotalGrupo = 0;
      }

      subtotalGrupo += r.kgResultantes;
      ultimoGrupo = grupoActual;

      filas.push(
        <tr key={r.id} className="border-b border-white/5 text-zinc-400">
          <td className="p-3">{new Date(r.created_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</td>
          <td className="p-3 font-bold text-white">{r.tipo_operacion}</td>
          <td className="p-3 text-right tabular-nums">{r.tipo_operacion === 'ACIDO_GRASO' ? '-' : r.lecturaAnterior.toLocaleString()}</td>
          <td className="p-3 text-right tabular-nums text-white">{parseFloat(r.valor_lectura).toLocaleString()}</td>
          <td className="p-3 text-right tabular-nums font-black text-white">{r.kgResultantes.toLocaleString()}</td>
          <td className="p-3 text-center"><a href={r.foto_url} target="_blank">📸</a></td>
          <td className="p-3 text-center">
            <button onClick={() => {/* logic edit */}} className="opacity-20 hover:opacity-100">✏️</button>
          </td>
        </tr>
      );

      // Si es el último registro de la lista, poner el último subtotal
      if (i === registros.length - 1) {
        filas.push(
          <tr key={`sub-final`} className="bg-orange-500/10 font-black text-orange-500">
            <td colSpan={4} className="p-2 text-right text-[8px]">SUBTOTAL {ultimoGrupo}:</td>
            <td className="p-2 text-right border-t border-orange-500/30">{subtotalGrupo.toLocaleString()} KG</td>
            <td colSpan={2}></td>
          </tr>
        );
      }
    });
    return filas;
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[9px] tracking-tighter">
      
      {/* PANEL DE FILTROS */}
      <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 mb-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-black border border-white/10 p-2 rounded-xl" />
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-black border border-white/10 p-2 rounded-xl" />
          <select value={filtroProducto} onChange={e => setFiltroProducto(e.target.value)} className="bg-black border border-white/10 p-2 rounded-xl">
            <option value="TODOS">TODOS PRODUCTOS</option>
            <option value="ENTRADA_ACP">ENTRADA ACP</option>
            <option value="ACIDO_GRASO">ACIDO GRASO</option>
            <option value="SALIDA_RBD">SALIDA RBD</option>
          </select>
          <select value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)} className="bg-black border border-white/10 p-2 rounded-xl">
            <option value="TODOS">TODAS VARIEDADES</option>
            <option value="ALTO OLEICO">ALTO OLEICO</option>
            <option value="GUINENSIS">GUINENSIS</option>
          </select>
          <select value={filtroProceso} onChange={e => setFiltroProceso(e.target.value)} className="bg-black border border-white/10 p-2 rounded-xl">
            <option value="TODOS">TODOS PROCESOS</option>
            <option value="NORMAL">NORMAL</option>
            <option value="REPROCESO">REPROCESO</option>
          </select>
        </div>

        {/* BOTONES EXPORTACIÓN */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button className="flex-1 py-3 bg-zinc-800 rounded-xl font-black border border-white/5 hover:bg-zinc-700">📄 PDF</button>
          <button className="flex-1 py-3 bg-zinc-800 rounded-xl font-black border border-white/5 hover:bg-zinc-700">📊 EXCEL</button>
          <button onClick={enviarWhatsApp} className="flex-[2] py-3 bg-emerald-600 rounded-xl font-black shadow-lg shadow-emerald-900/20">💬 ENVIAR RESUMEN WHATSAPP</button>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA */}
      <div className="bg-zinc-900 rounded-[30px] border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-zinc-500 font-black border-b border-white/10">
            <tr>
              <th className="p-4">FECHA / HORA</th>
              <th className="p-4">PRODUCTO</th>
              <th className="p-4 text-right">L. ANTERIOR</th>
              <th className="p-4 text-right">L. ACTUAL</th>
              <th className="p-4 text-right">KG NETOS</th>
              <th className="p-4 text-center">FOTO</th>
              <th className="p-4 text-center">EDIT</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-20 text-center animate-pulse text-orange-500 font-black">GENERANDO REPORTE...</td></tr>
            ) : renderFilasConSubtotales()}
          </tbody>
        </table>
      </div>
    </div>
  );
}