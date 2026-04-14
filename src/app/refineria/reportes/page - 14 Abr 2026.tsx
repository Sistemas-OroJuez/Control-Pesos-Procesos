'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]);
  
  // FILTROS DE ESTADO
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
      .order('created_at', { ascending: true });

    if (!error && todos) {
      const procesados = todos.map((reg, index) => {
        // --- LÓGICA PARA IDENTIFICAR EL TIPO REAL DE INVENTARIO ---
        let tipoCalculado = reg.tipo_operacion;
        
        if (reg.tipo_operacion === 'INVENTARIO_PROCESO' && reg.metadata) {
          try {
            const meta = typeof reg.metadata === 'string' ? JSON.parse(reg.metadata) : reg.metadata;
            if (meta.producto_inventariado === 'RBD') tipoCalculado = 'INVENTARIO_RBD_PROCESO';
            if (meta.producto_inventariado === 'ACP') tipoCalculado = 'INVENTARIO_ACP_PROCESO';
          } catch (e) {
            console.error("Error al identificar producto en metadata", e);
          }
        }

        const anterior = todos.slice(0, index).reverse().find(r => r.tipo_operacion === reg.tipo_operacion);
        const lecturaActual = parseFloat(reg.valor_lectura) || 0;
        const lecturaAnterior = anterior ? parseFloat(anterior.valor_lectura) : lecturaActual;
        
        const esContador = reg.tipo_operacion === 'ENTRADA_ACP' || reg.tipo_operacion === 'SALIDA_RBD';
        const kg = esContador ? (lecturaActual - lecturaAnterior) : lecturaActual;

        return { 
          ...reg, 
          tipo_operacion_display: tipoCalculado, // Usamos esta para filtrar y mostrar
          lecturaAnterior, 
          kgResultantes: kg 
        };
      });

      const filtrados = procesados.filter(r => {
        const f = r.created_at.split('T')[0];
        const cumpleProducto = filtroProducto === 'TODOS' || r.tipo_operacion_display === filtroProducto;
        
        return f >= fechaInicio && f <= fechaFin &&
               (filtroProceso === 'TODOS' || r.es_reproceso === (filtroProceso === 'REPROCESO')) &&
               (filtroVariedad === 'TODOS' || r.variedad === filtroVariedad) &&
               cumpleProducto;
      });

      setRegistros(filtrados);
    }
    setLoading(false);
  };

  // --- ACCIONES DE EXPORTACIÓN ---

  const exportarExcel = () => {
    if (registros.length === 0) return alert("No hay datos para exportar");

    const dataExcel = registros.map(r => ({
      'FECHA': new Date(r.created_at).toLocaleDateString(),
      'HORA': new Date(r.created_at).toLocaleTimeString(),
      'OPERACIÓN': r.tipo_operacion_display.replace(/_/g, ' '),
      'VARIEDAD': r.variedad,
      'PROCESO': r.es_reproceso ? 'REPROCESO' : 'NORMAL',
      'L. ANTERIOR': r.lecturaAnterior,
      'L. ACTUAL': parseFloat(r.valor_lectura),
      'KG RESULTANTES': r.kgResultantes
    }));

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, `Reporte_Produccion_${fechaInicio}_al_${fechaFin}.xlsx`);
  };

  const exportarPDF = () => { window.print(); };

  const enviarWhatsApp = () => {
    const totales: any = {};
    registros.forEach(r => {
      const key = `${r.tipo_operacion_display} (${r.variedad})`;
      totales[key] = (totales[key] || 0) + r.kgResultantes;
    });

    let msg = `*📊 REPORTE DE PRODUCCIÓN REFINERÍA*%0A`;
    msg += `*PERIODO:* ${fechaInicio} AL ${fechaFin}%0A%0A`;
    
    Object.entries(totales).forEach(([label, kg]: any) => {
      msg += `• *${label.replace(/_/g, ' ')}:* ${Number(kg).toLocaleString()} KG%0A`;
    });

    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleEdit = async (id: string, valor: any) => {
    const p = prompt("CLAVE DE AUDITORÍA:");
    if (p === CLAVE_MAESTRA) {
      const n = prompt("CORREGIR LECTURA / VALOR:", valor);
      if (n !== null) {
        await supabase.from('operaciones_refineria').update({ valor_lectura: n }).eq('id', id);
        fetchData();
      }
    }
  };

  const renderCuerpoTabla = () => {
    const elementos: any[] = [];
    let subtotal = 0;
    let grupoAnterior = "";

    registros.forEach((r, i) => {
      const grupoActual = `${r.tipo_operacion_display} (${r.variedad})`;

      if (grupoAnterior !== "" && grupoAnterior !== grupoActual) {
        elementos.push(
          <tr key={`sub-${i}`} className="bg-orange-500/10 text-orange-500 font-black border-y border-orange-500/20">
            <td colSpan={4} className="p-3 text-right">TOTAL {grupoAnterior.replace(/_/g, ' ')}:</td>
            <td className="p-3 text-right">{subtotal.toLocaleString()} KG</td>
            <td colSpan={2}></td>
          </tr>
        );
        subtotal = 0;
      }

      subtotal += r.kgResultantes;
      grupoAnterior = grupoActual;

      elementos.push(
        <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
          <td className="p-3 text-zinc-500">{new Date(r.created_at).toLocaleString([], {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
          <td className="p-3 font-bold">{r.tipo_operacion_display.replace(/_/g, ' ')}<br/><span className="text-[7px] text-zinc-600">{r.es_reproceso ? 'REPROCESO' : 'NORMAL'}</span></td>
          <td className="p-3 text-right tabular-nums text-zinc-500">
            {r.tipo_operacion_display.includes('INVENTARIO') || r.tipo_operacion === 'ACIDO_GRASO' ? '-' : r.lecturaAnterior.toLocaleString()}
          </td>
          <td className="p-3 text-right tabular-nums text-white font-bold">{parseFloat(r.valor_lectura).toLocaleString()}</td>
          <td className="p-3 text-right tabular-nums font-black text-white">{r.kgResultantes.toLocaleString()}</td>
          <td className="p-3 text-center">
            {r.foto_url && <a href={r.foto_url} target="_blank" className="text-sm">📸</a>}
          </td>
          <td className="p-3 text-center">
            <button onClick={() => handleEdit(r.id, r.valor_lectura)} className="opacity-20 hover:opacity-100">✏️</button>
          </td>
        </tr>
      );

      if (i === registros.length - 1) {
        elementos.push(
          <tr key="sub-final" className="bg-orange-500/10 text-orange-500 font-black border-y border-orange-500/20">
            <td colSpan={4} className="p-3 text-right">TOTAL {grupoAnterior.replace(/_/g, ' ')}:</td>
            <td className="p-3 text-right">{subtotal.toLocaleString()} KG</td>
            <td colSpan={2}></td>
          </tr>
        );
      }
    });
    return elementos;
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[9px] tracking-tight">
      
      <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 mb-6 space-y-6">
        <h1 className="text-orange-500 font-black tracking-[0.2em] text-center mb-4">AUDITORÍA Y BALANCE DE PRODUCCIÓN</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-zinc-600 text-[7px] font-bold">FECHA INICIO</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full bg-black border border-white/10 p-3 rounded-xl" />
          </div>
          <div className="space-y-1">
            <label className="text-zinc-600 text-[7px] font-bold">FECHA FIN</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full bg-black border border-white/10 p-3 rounded-xl" />
          </div>
          <div className="space-y-1">
            <label className="text-zinc-600 text-[7px] font-bold">PRODUCTO</label>
            <select value={filtroProducto} onChange={e => setFiltroProducto(e.target.value)} className="w-full bg-black border border-white/10 p-3 rounded-xl">
              <option value="TODOS">TODOS</option>
              <option value="ENTRADA_ACP">ENTRADA ACP</option>
              <option value="ACIDO_GRASO">ACIDO GRASO</option>
              <option value="SALIDA_RBD">SALIDA RBD</option>
              <option value="INVENTARIO_ACP_PROCESO">INV. ACP PROCESO</option>
              <option value="INVENTARIO_RBD_PROCESO">INV. RBD PROCESO</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-zinc-600 text-[7px] font-bold">VARIEDAD</label>
            <select value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)} className="w-full bg-black border border-white/10 p-3 rounded-xl">
              <option value="TODOS">TODOS</option>
              <option value="ALTO OLEICO">ALTO OLEICO</option>
              <option value="GUINENSIS">GUINENSIS</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-zinc-600 text-[7px] font-bold">PROCESO</label>
            <select value={filtroProceso} onChange={e => setFiltroProceso(e.target.value)} className="w-full bg-black border border-white/10 p-3 rounded-xl">
              <option value="TODOS">TODOS</option>
              <option value="NORMAL">NORMAL</option>
              <option value="REPROCESO">REPROCESO</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={exportarPDF} className="bg-zinc-800 border border-white/5 py-4 rounded-2xl font-black hover:bg-zinc-700 transition-all">📄 EXPORTAR A PDF</button>
          <button onClick={exportarExcel} className="bg-zinc-800 border border-white/5 py-4 rounded-2xl font-black hover:bg-zinc-700 transition-all">📊 EXPORTAR A EXCEL</button>
          <button onClick={enviarWhatsApp} className="bg-emerald-600 py-4 rounded-2xl font-black shadow-lg hover:bg-emerald-500 transition-all">💬 RESUMEN WHATSAPP</button>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-[35px] border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-zinc-500 border-b border-white/10 font-black">
                <th className="p-4">FECHA / HORA</th>
                <th className="p-4">OPERACIÓN</th>
                <th className="p-4 text-right">L. ANTERIOR</th>
                <th className="p-4 text-right">L. ACTUAL</th>
                <th className="p-4 text-right text-orange-500">KG RESULTANTES</th>
                <th className="p-4 text-center">EVIDENCIA</th>
                <th className="p-4 text-center">EDIT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-24 text-center animate-pulse text-zinc-700 font-black">PROCESANDO AUDITORÍA...</td></tr>
              ) : renderCuerpoTabla()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}