'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]); 
  const [modoVista, setModoVista] = useState<'AUDITORIA' | 'GERENCIAL'>('AUDITORIA');
  
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [filtroVariedad, setFiltroVariedad] = useState('TODOS');
  const [filtroOperacion, setFiltroOperacion] = useState('TODOS');

  useEffect(() => {
    if (modoVista === 'AUDITORIA') fetchAuditoria();
  }, [fechaInicio, fechaFin, modoVista, filtroVariedad, filtroOperacion]);

  const fetchAuditoria = async () => {
    setLoading(true);
    const { data: todos, error } = await supabase
      .from('operaciones_refineria')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && todos) {
      const procesados = todos.map((reg, index) => {
        const anterior = todos.slice(0, index).reverse().find(r => 
          r.tipo_operacion === reg.tipo_operacion && 
          (reg.tipo_operacion === 'ACIDO_GRASO' ? r.tanque_id === reg.tanque_id : true)
        );

        const lecturaActual = parseFloat(reg.valor_lectura) || 0;
        const lecturaAnterior = anterior ? parseFloat(anterior.valor_lectura) : lecturaActual;
        
        const egresoV = parseFloat(reg.egreso_venta) || 0;
        const egresoJ = parseFloat(reg.egreso_jaboneria) || 0;
        const egresosTotales = egresoV + egresoJ;

        let kg = 0;
        if (reg.tipo_operacion === 'ACIDO_GRASO') {
          kg = (lecturaActual - lecturaAnterior) + egresosTotales;
        } else if (reg.tipo_operacion === 'ENTRADA_ACP' || reg.tipo_operacion === 'SALIDA_RBD') {
          kg = (lecturaActual - lecturaAnterior);
        } else {
          kg = lecturaActual;
        }

        return { 
          ...reg, 
          lecturaAnterior, 
          egresoV,
          egresoJ,
          egresosTotales,
          kgResultantes: kg 
        };
      });
      
      setRegistros(procesados.filter(r => {
        const f = r.created_at.split('T')[0];
        const cumpleFecha = f >= fechaInicio && f <= fechaFin;
        const cumpleVariedad = filtroVariedad === 'TODOS' || r.variedad === filtroVariedad;
        const cumpleOperacion = filtroOperacion === 'TODOS' || r.tipo_operacion === filtroOperacion;
        return cumpleFecha && cumpleVariedad && cumpleOperacion;
      }).reverse()); 
    }
    setLoading(false);
  };

  const exportarExcel = () => {
    if (registros.length === 0) return alert("No hay datos");
    const dataExcel = registros.map(r => ({
      Fecha: new Date(r.created_at).toLocaleString(),
      Operacion: r.tipo_operacion,
      Tanque: r.tanque_id || '-',
      Variedad: r.variedad,
      'Lectura Ant.': r.lecturaAnterior,
      'Lectura Act.': r.valor_lectura,
      'Venta KG': r.egresoV,
      'Local KG': r.egresoJ,
      'Producción Total': r.kgResultantes,
      Foto: r.foto_url || 'Sin foto'
    }));
    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, `Reporte_Auditoria_${fechaInicio}_al_${fechaFin}.xlsx`);
  };

  const exportarPDF = () => {
    if (registros.length === 0) return alert("No hay datos");
    const doc = new jsPDF();
    
    doc.setFontSize(14);
    doc.text("REPORTE DETALLADO DE AUDITORÍA", 14, 15);
    doc.setFontSize(9);
    doc.text(`Periodo: ${fechaInicio} al ${fechaFin}`, 14, 20);

    // Agrupamos para el PDF para que no salga mezclado
    const ops = Array.from(new Set(registros.map(r => r.tipo_operacion)));
    let currentY = 25;

    ops.forEach(op => {
      const regsOp = registros.filter(r => r.tipo_operacion === op);
      const subtotalOp = regsOp.reduce((acc, curr) => acc + curr.kgResultantes, 0);

      autoTable(doc, {
        startY: currentY,
        head: [[{ content: `${op} - TOTAL ACUMULADO: ${subtotalOp.toLocaleString()} KG`, colSpan: 7, styles: { fillColor: [40, 40, 40] } }],
               ['Fecha', 'Detalle', 'Variedad', 'L. Ant', 'L. Act', 'Egresos', 'Resultado']],
        body: regsOp.map(r => [
          new Date(r.created_at).toLocaleDateString(),
          r.tanque_id || '-',
          r.variedad,
          r.lecturaAnterior.toLocaleString(),
          parseFloat(r.valor_lectura).toLocaleString(),
          r.egresosTotales.toLocaleString(),
          r.kgResultantes.toLocaleString()
        ]),
        theme: 'grid',
        styles: { fontSize: 7 },
        margin: { top: 10 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.save(`Auditoria_Refineria_${fechaInicio}.pdf`);
  };

  const enviarWhatsAppSinNumero = () => {
    if (registros.length === 0) return alert("No hay datos");
    let mensaje = `*REPORTE AUDITORIA*\n*Periodo:* ${fechaInicio} / ${fechaFin}\n\n`;
    registros.slice(0, 10).forEach(r => {
      mensaje += `🔸 *${r.tipo_operacion}* (${r.tanque_id || 'S/T'})\n`;
      mensaje += `PROD: ${r.kgResultantes.toLocaleString()} KG\n`;
      mensaje += `----------------------------\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const renderTablaAuditoria = () => {
    const opGrupos = Array.from(new Set(registros.map(r => r.tipo_operacion)));
    return opGrupos.map(opName => {
      const registrosOp = registros.filter(r => r.tipo_operacion === opName);
      const variedadesOp = Array.from(new Set(registrosOp.map(r => r.variedad)));

      return (
        <div key={opName} className="mb-10 bg-zinc-900 rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
          <div className="p-6 bg-white/5 border-b border-white/10 text-2xl font-black italic uppercase flex justify-between">
            <span>{opName}</span>
          </div>
          {variedadesOp.map(varName => {
            const items = registrosOp.filter(r => r.variedad === varName);
            const subtotal = items.reduce((acc, curr) => acc + (curr.kgResultantes || 0), 0);
            return (
              <div key={varName} className="border-b border-white/5 last:border-0">
                <div className="px-6 py-3 bg-white/5 text-blue-400 font-black text-[10px] tracking-widest uppercase italic">Variedad: {varName}</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] text-zinc-500 uppercase font-bold border-b border-white/5">
                      <th className="p-4">Fecha / Hora</th>
                      <th className="p-4 text-center">Tanque</th>
                      <th className="p-4 text-center">Evidencia</th>
                      <th className="p-4 text-right">L. Anterior</th>
                      <th className="p-4 text-right">L. Actual</th>
                      <th className="p-4 text-right text-emerald-500">Venta</th>
                      <th className="p-4 text-right text-orange-400">Local</th>
                      <th className="p-4 text-right">Resultado KG</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300 text-[11px]">
                    {items.map(r => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="p-4 text-center font-bold">{r.tanque_id || '-'}</td>
                        <td className="p-4 text-center">
                          {r.foto_url && (
                            <button onClick={() => window.open(r.foto_url, '_blank')} className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md border border-blue-500/20 text-[8px] font-bold">VER FOTO</button>
                          )}
                        </td>
                        <td className="p-4 text-right">{r.lecturaAnterior?.toLocaleString()}</td>
                        <td className="p-4 text-right font-bold text-white">{parseFloat(r.valor_lectura).toLocaleString()}</td>
                        <td className="p-4 text-right text-emerald-500">{r.egresoV?.toLocaleString() || '-'}</td>
                        <td className="p-4 text-right text-orange-400">{r.egresoJ?.toLocaleString() || '-'}</td>
                        <td className="p-4 text-right font-black text-blue-400">{r.kgResultantes?.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-black/40 font-black">
                      <td colSpan={7} className="p-6 text-right text-zinc-400 uppercase font-bold">SUBTOTAL {varName}</td>
                      <td className="p-6 text-right text-3xl text-emerald-400 tabular-nums">{subtotal.toLocaleString()} KG</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-black p-4 md:p-8 font-sans text-white uppercase text-[10px]">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-zinc-900 p-8 rounded-[40px] border border-white/10 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl">
          <h1 className="text-3xl font-black italic tracking-tighter">Auditoría Refinería</h1>
          <div className="flex flex-wrap gap-3">
            <button onClick={exportarExcel} className="bg-emerald-600 px-6 py-2 rounded-xl font-black hover:bg-emerald-700">📊 EXCEL</button>
            <button onClick={exportarPDF} className="bg-red-600 px-6 py-2 rounded-xl font-black hover:bg-red-700">📕 PDF</button>
            <button onClick={enviarWhatsAppSinNumero} className="bg-green-500 text-black px-6 py-2 rounded-xl font-black hover:bg-green-400">📲 WHATSAPP</button>
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-zinc-600 font-bold ml-2">FECHA INICIO</span>
            <input type="date" className="bg-black border border-white/10 p-3 rounded-xl" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-zinc-600 font-bold ml-2">FECHA FIN</span>
            <input type="date" className="bg-black border border-white/10 p-3 rounded-xl" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-zinc-600 font-bold ml-2">OPERACIÓN</span>
            <select className="bg-black border border-white/10 p-3 rounded-xl" value={filtroOperacion} onChange={e => setFiltroOperacion(e.target.value)}>
              <option value="TODOS">TODAS</option>
              <option value="ENTRADA_ACP">ENTRADA_ACP</option>
              <option value="SALIDA_RBD">SALIDA_RBD</option>
              <option value="ACIDO_GRASO">ACIDO_GRASO</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-zinc-600 font-bold ml-2">VARIEDAD</span>
            <select className="bg-black border border-white/10 p-3 rounded-xl" value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)}>
              <option value="TODOS">TODAS</option>
              <option value="ALTO OLEICO">ALTO OLEICO</option>
              <option value="GUINENSIS">GUINENSIS</option>
            </select>
          </div>
        </div>

        {loading ? <div className="p-20 text-center animate-pulse text-zinc-600 font-black">CARGANDO...</div> : renderTablaAuditoria()}
      </div>
    </div>
  );
}