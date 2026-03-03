'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReporteAuditoria() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [datos, setDatos] = useState<any[]>([]);
  
  // FECHAS AUTOMÁTICAS: Desde el 1 del mes actual hasta hoy
  const getPrimerDiaMes = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };
  const getHoy = () => new Date().toISOString().split('T')[0];

  const [filtros, setFiltros] = useState({
    localidad: '',
    fechaDesde: getPrimerDiaMes(),
    fechaHasta: getHoy(),
    variedad: '',
    operador: '',
    proveedor: ''
  });

  const [catalogos, setCatalogos] = useState<any>({ 
    localidades: [], variedades: [], operadores: [], proveedores: [] 
  });

  useEffect(() => {
    cargarCatalogos();
    ejecutarConsulta();
  }, []);

  async function cargarCatalogos() {
    const [resLoc, resVar, resOpe, resProv] = await Promise.all([
      supabase.from('localidades').select('*').order('nombre'),
      supabase.from('parametros').select('valor').eq('categoria', 'variedad'),
      supabase.from('operadores').select('id, nombre').order('nombre'),
      supabase.from('parametros').select('valor').eq('categoria', 'proveedor')
    ]);
    setCatalogos({
      localidades: resLoc.data || [],
      variedades: resVar.data || [],
      operadores: resOpe.data || [],
      proveedores: resProv.data || []
    });
  }

  async function ejecutarConsulta() {
    setLoading(true);
    let query = supabase
      .from('procesos_batch')
      .select(`
        *,
        operadores (
          nombre,
          sitios (
            nombre,
            localidad_id,
            localidades (nombre)
          )
        )
      `)
      .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
      .lte('created_at', `${filtros.fechaHasta}T23:59:59`);

    if (filtros.variedad) query = query.eq('variedad', filtros.variedad);
    if (filtros.operador) query = query.eq('operador_id', filtros.operador);
    if (filtros.proveedor) query = query.eq('proveedor', filtros.proveedor);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (data) {
      // Filtro manual por localidad ya que está en el tercer nivel de relación
      const filtrados = filtros.localidad 
        ? data.filter(i => i.operadores?.sitios?.localidad_id === filtros.localidad)
        : data;
      setDatos(filtrados);
    }
    setLoading(false);
  }

  // --- EXPORTACIONES ---
  const exportExcel = () => {
    const rows = datos.map(r => ({
      Fecha: new Date(r.created_at).toLocaleString(),
      Batch: r.batch_id,
      Sitio: r.operadores?.sitios?.nombre,
      Localidad: r.operadores?.sitios?.localidades?.nombre,
      Operador: r.operadores?.nombre,
      Turno: r.turno,
      Variedad: r.variedad,
      Proveedor: r.proveedor,
      Peso_Kg: r.peso_final_digitado,
      Observaciones: r.observaciones,
      Link_Foto_Inicio: r.foto_visor_inicio,
      Link_Foto_Vacio: r.foto_tanque_vacio,
      Link_Foto_Peso: r.foto_visor_final
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_${filtros.fechaDesde}_al_${filtros.fechaHasta}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(16);
    doc.text("REPORTE OPERATIVO DE PESAJES", 14, 15);
    doc.setFontSize(10);
    doc.text(`Periodo: ${filtros.fechaDesde} a ${filtros.fechaHasta}`, 14, 22);

    const body = datos.map(r => [
      new Date(r.created_at).toLocaleDateString(),
      r.batch_id,
      r.operadores?.sitios?.nombre,
      r.operadores?.nombre,
      r.turno,
      r.peso_final_digitado + " kg",
      r.observaciones || '-'
    ]);

    autoTable(doc, {
      head: [['Fecha', 'Batch', 'Sitio', 'Operador', 'Turno', 'Peso', 'Obs']],
      body: body,
      startY: 30,
      headStyles: { fillColor: [185, 28, 28] }
    });
    doc.save("Reporte_Pesaje.pdf");
  };

  // Totales
  const totalKilos = datos.reduce((acc, curr) => acc + (Number(curr.peso_final_digitado) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* HEADER */}
      <nav className="bg-white p-4 shadow-md border-b-4 border-red-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-100 rounded-lg font-bold text-xs uppercase tracking-tighter">← Panel</button>
            <h1 className="text-red-700 font-black uppercase text-lg tracking-tighter">Reportes de Auditoría</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase shadow-md">Excel</button>
            <button onClick={exportPDF} className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase shadow-md">PDF</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        
        {/* FILTROS */}
        <div className="bg-white p-6 rounded-3xl shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-gray-400 ml-1">DESDE</label>
            <input type="date" className="p-3 border-2 rounded-2xl font-bold text-sm outline-none focus:border-red-700" value={filtros.fechaDesde} onChange={e => setFiltros({...filtros, fechaDesde: e.target.value})} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-gray-400 ml-1">HASTA</label>
            <input type="date" className="p-3 border-2 rounded-2xl font-bold text-sm outline-none focus:border-red-700" value={filtros.fechaHasta} onChange={e => setFiltros({...filtros, fechaHasta: e.target.value})} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-gray-400 ml-1">LOCALIDAD</label>
            <select className="p-3 border-2 rounded-2xl font-bold text-sm bg-gray-50 outline-none" value={filtros.localidad} onChange={e => setFiltros({...filtros, localidad: e.target.value})}>
              <option value="">TODAS</option>
              {catalogos.localidades.map((l:any) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-gray-400 ml-1">VARIEDAD</label>
            <select className="p-3 border-2 rounded-2xl font-bold text-sm bg-gray-50 outline-none" value={filtros.variedad} onChange={e => setFiltros({...filtros, variedad: e.target.value})}>
              <option value="">TODAS</option>
              {catalogos.variedades.map((v:any) => <option key={v.valor} value={v.valor}>{v.valor}</option>)}
            </select>
          </div>
          <button onClick={ejecutarConsulta} className="bg-red-700 text-white font-black p-4 rounded-2xl uppercase text-[10px] shadow-lg hover:bg-red-800 transition-all">Consultar</button>
        </div>

        {/* SUBTOTALES */}
        <div className="bg-red-700 p-6 rounded-3xl text-white shadow-xl flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase opacity-60">Total Kilos en Rango</p>
            <p className="text-4xl font-black">{totalKilos.toLocaleString()} <span className="text-sm">kg</span></p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Registros: {datos.length}</p>
          </div>
        </div>

        {/* TABLA DE RESULTADOS */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead className="bg-gray-50 font-black uppercase text-gray-400 text-left">
                <tr>
                  <th className="p-4">Batch / Fecha</th>
                  <th className="p-4">Origen / Operador</th>
                  <th className="p-4 text-center">Auditoría Fotos</th>
                  <th className="p-4">Variedad / Prov</th>
                  <th className="p-4 text-right">Peso Digitado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {datos.map(reg => (
                  <tr key={reg.id} className="hover:bg-red-50 transition-colors">
                    <td className="p-4">
                      <p className="text-red-700 font-black text-sm">#{reg.batch_id}</p>
                      <p className="text-gray-400 font-bold">{new Date(reg.created_at).toLocaleString()}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-black text-gray-800 uppercase">{reg.operadores?.sitios?.nombre}</p>
                      <p className="text-gray-500 font-bold">{reg.operadores?.nombre} • {reg.turno}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 justify-center">
                        <a href={reg.foto_visor_inicio} target="_blank" className="bg-gray-100 hover:bg-red-700 hover:text-white px-2 py-1 rounded-lg font-black transition-all">INICIO</a>
                        <a href={reg.foto_tanque_vacio} target="_blank" className="bg-gray-100 hover:bg-red-700 hover:text-white px-2 py-1 rounded-lg font-black transition-all">VACÍO</a>
                        <a href={reg.foto_visor_final} target="_blank" className="bg-gray-100 hover:bg-red-700 hover:text-white px-2 py-1 rounded-lg font-black transition-all">PESO</a>
                        {reg.foto_observacion && <a href={reg.foto_observacion} target="_blank" className="bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-black uppercase">Obs</a>}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-black text-gray-800 uppercase">{reg.variedad}</p>
                      <p className="text-gray-400 font-bold">{reg.proveedor}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="text-lg font-black text-red-700">{reg.peso_final_digitado} <span className="text-[10px]">kg</span></p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {datos.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center gap-4">
               <span className="text-4xl opacity-20">📂</span>
               <p className="font-black text-gray-300 uppercase tracking-widest">Sin datos para este mes o filtros</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}