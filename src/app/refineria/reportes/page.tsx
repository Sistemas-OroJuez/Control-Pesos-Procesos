'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ReporteAvanzadoRefineria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]);
  
  // FILTROS
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [filtroProceso, setFiltroProceso] = useState('TODOS'); // NORMAL / REPROCESO
  const [filtroVariedad, setFiltroVariedad] = useState('TODOS'); // ALTO OLEICO / GUINENSIS
  const [filtroProducto, setFiltroProducto] = useState('TODOS'); // ENTRADA_ACP / ACIDO_GRASO / SALIDA_RBD

  const CLAVE_MAESTRA = "orj2026";

  useEffect(() => {
    fetchData();
  }, [fechaInicio, fechaFin, filtroProceso, filtroVariedad, filtroProducto]);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('operaciones_refineria')
      .select('*')
      .gte('created_at', `${fechaInicio}T00:00:00`)
      .lte('created_at', `${fechaFin}T23:59:59`)
      .order('created_at', { ascending: true });

    if (filtroProceso !== 'TODOS') {
      query = query.eq('es_reproceso', filtroProceso === 'REPROCESO');
    }
    if (filtroVariedad !== 'TODOS') {
      query = query.eq('variedad', filtroVariedad);
    }
    if (filtroProducto !== 'TODOS') {
      query = query.eq('tipo_operacion', filtroProducto);
    }

    const { data, error } = await query;
    if (!error) setRegistros(data || []);
    setLoading(false);
  };

  // --- LÓGICA DE BALANCE Y TOTALES ---
  const obtenerTotalesAgrupados = () => {
    return registros.reduce((acc: any, reg) => {
      const llave = `${reg.tipo_operacion} | ${reg.variedad} | ${reg.es_reproceso ? 'REPRO' : 'NORMAL'}`;
      acc[llave] = (acc[llave] || 0) + parseFloat(reg.valor_lectura || 0);
      return acc;
    }, {});
  };

  const calcularNetoMasico = (tipo: string) => {
    const filtrados = registros.filter(r => r.tipo_operacion === tipo);
    if (filtrados.length < 2) return filtrados.length === 1 ? parseFloat(filtrados[0].valor_lectura) : 0;
    
    // Lectura Final - Lectura Inicial (Para contadores que acumulan)
    const inicial = parseFloat(filtrados[0].valor_lectura);
    const final = parseFloat(filtrados[filtrados.length - 1].valor_lectura);
    return final - inicial;
  };

  const handleEdit = async (id: string, valorActual: string) => {
    const pass = prompt("CLAVE DE AUTORIZACIÓN:");
    if (pass !== CLAVE_MAESTRA) return alert("ACCESO DENEGADO");

    const nuevoValor = prompt("CORREGIR VALOR (KG):", valorActual);
    if (nuevoValor && !isNaN(parseFloat(nuevoValor))) {
      const { error } = await supabase
        .from('operaciones_refineria')
        .update({ valor_lectura: nuevoValor })
        .eq('id', id);
      if (!error) fetchData();
    }
  };

  const shareWhatsApp = () => {
    const totales = obtenerTotalesAgrupados();
    let texto = `*📊 RESUMEN REFINERÍA OROJUEZ*%0A`;
    texto += `*Periodo:* ${fechaInicio} al ${fechaFin}%0A%0A`;
    
    Object.entries(totales).forEach(([label, val]: any) => {
      texto += `• *${label}:* ${Number(val).toLocaleString()} KG%0A`;
    });

    const merma = calcularNetoMasico('ENTRADA_ACP') - (calcularNetoMasico('SALIDA_RBD') + (totales['ACIDO_GRASO | ALTO OLEICO | NORMAL'] || 0));
    texto += `%0A*MERMA ESTIMADA:* ${merma.toLocaleString()} KG`;

    window.open(`https://wa.me/?text=${texto}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[10px] tracking-wider">
      
      {/* PANEL DE CONTROL / FILTROS */}
      <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 mb-6 space-y-4">
        <h2 className="text-orange-500 font-black mb-2">Filtros de Auditoría</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[8px]">Desde</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-black border border-white/10 p-2 rounded-lg" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[8px]">Hasta</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-black border border-white/10 p-2 rounded-lg" />
          </div>
          <select value={filtroProceso} onChange={e => setFiltroProceso(e.target.value)} className="bg-black border border-white/10 p-2 rounded-lg mt-4">
            <option value="TODOS">TODOS LOS PROCESOS</option>
            <option value="NORMAL">PROCESO NORMAL</option>
            <option value="REPROCESO">REPROCESO</option>
          </select>
          <select value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)} className="bg-black border border-white/10 p-2 rounded-lg mt-4">
            <option value="TODOS">TODAS LAS VARIEDADES</option>
            <option value="ALTO OLEICO">ALTO OLEICO</option>
            <option value="GUINENSIS">GUINENSIS</option>
          </select>
          <select value={filtroProducto} onChange={e => setFiltroProducto(e.target.value)} className="bg-black border border-white/10 p-2 rounded-lg mt-4">
            <option value="TODOS">TODOS PRODUCTOS</option>
            <option value="ENTRADA_ACP">ENTRADA ACP</option>
            <option value="ACIDO_GRASO">ÁCIDO GRASO</option>
            <option value="SALIDA_RBD">SALIDA RBD</option>
          </select>
        </div>
      </div>

      {/* DASHBOARD DE TOTALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900 p-5 rounded-3xl border border-white/5">
          <p className="text-zinc-500 font-black">ACP ENTRADA (NETO)</p>
          <p className="text-2xl font-black text-white">{calcularNetoMasico('ENTRADA_ACP').toLocaleString()} KG</p>
        </div>
        <div className="bg-zinc-900 p-5 rounded-3xl border border-white/5">
          <p className="text-zinc-500 font-black text-orange-500">RESUMEN AGRUPADO</p>
          <div className="mt-2 space-y-1">
            {Object.entries(obtenerTotalesAgrupados()).map(([k, v]: any) => (
              <div key={k} className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-[8px]">{k}</span>
                <span className="font-bold">{Number(v).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={shareWhatsApp} className="bg-emerald-600 rounded-3xl font-black flex flex-col items-center justify-center p-4">
          <span className="text-xl">💬</span>
          <span>EXPORTAR TOTALES</span>
        </button>
      </div>

      {/* TABLA DE REGISTROS */}
      <div className="bg-zinc-900 rounded-[30px] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-zinc-500 border-b border-white/10">
                <th className="p-4">FECHA/HORA</th>
                <th className="p-4">PRODUCTO</th>
                <th className="p-4">VARIEDAD</th>
                <th className="p-4">PROCESO</th>
                <th className="p-4 text-right">LECTURA (KG)</th>
                <th className="p-4 text-center">FOTO</th>
                <th className="p-4 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center animate-pulse">CARGANDO DATOS...</td></tr>
              ) : registros.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 whitespace-nowrap text-zinc-400">
                    {new Date(r.created_at).toLocaleDateString()}<br/>
                    {new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="p-4 font-black">{r.tipo_operacion}</td>
                  <td className="p-4 font-bold text-orange-500">{r.variedad}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md ${r.es_reproceso ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                      {r.es_reproceso ? 'REPROCESO' : 'NORMAL'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-black tabular-nums">{Number(r.valor_lectura).toLocaleString()}</td>
                  <td className="p-4 text-center">
                    {r.foto_url && (
                      <a href={r.foto_url} target="_blank" className="bg-zinc-800 p-2 rounded-lg inline-block">📸</a>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleEdit(r.id, r.valor_lectura)} className="text-lg">✏️</button>
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