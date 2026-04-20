'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]); 
  const [modoVista, setModoVista] = useState<'AUDITORIA' | 'GERENCIAL'>('AUDITORIA');
  const [numWhatsApp, setNumWhatsApp] = useState('');
  
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
        const anterior = todos.slice(0, index).reverse().find(r => r.tipo_operacion === reg.tipo_operacion);
        const lecturaActual = parseFloat(reg.valor_lectura) || 0;
        const lecturaAnterior = anterior ? parseFloat(anterior.valor_lectura) : lecturaActual;
        
        const kg = (reg.tipo_operacion === 'ENTRADA_ACP' || reg.tipo_operacion === 'SALIDA_RBD') 
          ? (lecturaActual - lecturaAnterior) 
          : lecturaActual;

        return { ...reg, lecturaAnterior, kgResultantes: kg };
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

  // --- FUNCIONES DE EXPORTACIÓN ---
  const exportarExcel = () => {
    const dataExcel = registros.map(r => ({
      Fecha: new Date(r.created_at).toLocaleString(),
      Operacion: r.tipo_operacion,
      Variedad: r.variedad,
      'Lectura Ant.': r.lecturaAnterior,
      'Lectura Act.': r.valor_lectura,
      'Resultado KG': r.kgResultantes
    }));
    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, `Auditoria_Refineria_${fechaInicio}_al_${fechaFin}.xlsx`);
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("REPORTE AUDITORIA REFINERIA", 14, 15);
    doc.setFontSize(10);
    doc.text(`Periodo: ${fechaInicio} a ${fechaFin}`, 14, 22);

    const body = registros.map(r => [
      new Date(r.created_at).toLocaleString(),
      r.tipo_operacion,
      r.variedad,
      r.lecturaAnterior.toLocaleString(),
      parseFloat(r.valor_lectura).toLocaleString(),
      r.kgResultantes.toLocaleString()
    ]);

    (doc as any).autoTable({
      startY: 30,
      head: [['Fecha', 'Operacion', 'Variedad', 'L. Ant', 'L. Act', 'Total KG']],
      body: body,
      theme: 'grid'
    });
    doc.save(`Auditoria_${fechaFin}.pdf`);
  };

  const enviarWhatsApp = () => {
    if (!numWhatsApp) return alert("Por favor ingresa un número de teléfono");
    
    let mensaje = `*REPORTE AUDITORIA REFINERIA*\n`;
    mensaje += `*Periodo:* ${fechaInicio} a ${fechaFin}\n\n`;
    
    registros.forEach(r => {
      mensaje += `🔹 *${r.tipo_operacion}* (${r.variedad})\n`;
      mensaje += `L. Actual: ${parseFloat(r.valor_lectura).toLocaleString()}\n`;
      mensaje += `L. Anterior: ${r.lecturaAnterior.toLocaleString()}\n`;
      mensaje += `*Resultado: ${r.kgResultantes.toLocaleString()} KG*\n`;
      mensaje += `----------------------------\n`;
    });

    const url = `https://wa.me/${numWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const renderTablaAuditoria = () => {
    const opGrupos = Array.from(new Set(registros.map(r => r.tipo_operacion)));

    return opGrupos.map(opName => {
      const registrosOp = registros.filter(r => r.tipo_operacion === opName);
      const variedadesOp = Array.from(new Set(registrosOp.map(r => r.variedad)));

      return (
        <div key={opName} className="mb-10 bg-zinc-900 rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
          <div className="p-6 bg-white/5 flex justify-between items-center border-b border-white/10">
            <h2 className="text-2xl font-black text-white uppercase italic">{opName}</h2>
          </div>

          {variedadesOp.map(varName => {
            const items = registrosOp.filter(r => r.variedad === varName);
            const subtotalDif = items.reduce((acc, curr) => acc + (curr.kgResultantes || 0), 0);

            return (
              <div key={varName} className="border-b border-white/5 last:border-0">
                <div className="px-6 py-3 bg-white/5">
                  <span className="text-blue-400 font-black text-[10px] uppercase tracking-widest">Variedad: {varName}</span>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] text-zinc-500 uppercase font-bold border-b border-white/5">
                      <th className="p-4">Fecha / Hora</th>
                      <th className="p-4 text-center">Evidencia</th>
                      <th className="p-4 text-right">Lectura Anterior</th>
                      <th className="p-4 text-right text-white">Lectura Actual</th>
                      <th className="p-4 text-right">Resultado KG</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300 text-[11px]">
                    {items.map(r => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="p-4 text-center">
                          {r.foto_url && (
                            <button 
                              onClick={() => window.open(r.foto_url, '_blank')}
                              className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all text-[9px] font-bold"
                            >
                              👁️ VER VISOR
                            </button>
                          )}
                        </td>
                        <td className="p-4 text-right">{r.lecturaAnterior?.toLocaleString()}</td>
                        <td className="p-4 text-right font-bold text-white">{parseFloat(r.valor_lectura).toLocaleString()}</td>
                        <td className="p-4 text-right font-black text-blue-400">{r.kgResultantes?.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-black/40">
                      <td colSpan={4} className="p-6 text-xs font-black text-zinc-400 uppercase text-right">SUBTOTAL {varName}</td>
                      <td className="p-6 text-right text-3xl font-black text-emerald-400 tabular-nums">
                        {subtotalDif.toLocaleString()} <span className="text-xs">KG</span>
                      </td>
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
        
        {/* HEADER Y ACCIONES */}
        <div className="bg-zinc-900 p-8 rounded-[40px] border border-white/10 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <h1 className="text-3xl font-black italic tracking-tighter">Auditoría Refinería</h1>
            
            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-black transition-colors">📊 EXCEL</button>
              <button onClick={exportarPDF} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-black transition-colors">📕 PDF</button>
              <div className="flex bg-black p-1 rounded-xl border border-white/10">
                <input 
                  type="text" 
                  placeholder="593XXXXXXXXX" 
                  value={numWhatsApp}
                  onChange={(e) => setNumWhatsApp(e.target.value)}
                  className="bg-transparent px-3 py-1 text-white w-32 outline-none normal-case"
                />
                <button onClick={enviarWhatsApp} className="bg-green-500 text-black px-4 py-1 rounded-lg font-black text-[9px]">📲 WHATSAPP</button>
              </div>
            </div>
          </div>

          <div className="flex bg-black p-1.5 rounded-2xl border border-white/10 w-fit mx-auto md:mx-0">
            <button onClick={() => setModoVista('AUDITORIA')} className={`px-6 py-2 rounded-xl font-black ${modoVista === 'AUDITORIA' ? 'bg-white text-black' : 'text-zinc-500'}`}>AUDITORÍA</button>
            <button onClick={() => setModoVista('GERENCIAL')} className={`px-6 py-2 rounded-xl font-black ${modoVista === 'GERENCIAL' ? 'bg-white text-black' : 'text-zinc-500'}`}>GERENCIAL</button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-zinc-900 p-6 rounded-[30px] border border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-zinc-500 font-bold ml-2">INICIO</label>
            <input type="date" className="bg-black border border-white/10 p-3 rounded-xl" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-zinc-500 font-bold ml-2">FIN</label>
            <input type="date" className="bg-black border border-white/10 p-3 rounded-xl" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-zinc-500 font-bold ml-2">OPERACIÓN</label>
            <select className="bg-black border border-white/10 p-3 rounded-xl" value={filtroOperacion} onChange={e => setFiltroOperacion(e.target.value)}>
              <option value="TODOS">TODAS</option>
              <option value="ENTRADA_ACP">ENTRADA_ACP</option>
              <option value="SALIDA_RBD">SALIDA_RBD</option>
              <option value="ACIDO_GRASO">ACIDO_GRASO</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-zinc-500 font-bold ml-2">VARIEDAD</label>
            <select className="bg-black border border-white/10 p-3 rounded-xl" value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)}>
              <option value="TODOS">TODAS</option>
              <option value="ALTO OLEICO">ALTO OLEICO</option>
              <option value="GUINENSIS">GUINENSIS</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-20 text-center animate-pulse text-zinc-600 font-black">CARGANDO...</div>
        ) : (
          modoVista === 'AUDITORIA' ? renderTablaAuditoria() : <div className="text-center text-zinc-500">Vista Gerencial en desarrollo...</div>
        )}
      </div>
    </div>
  );
}