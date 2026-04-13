'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ReporteRefineria() {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroFecha, setFiltroFecha] = useState(new Date().toISOString().split('T')[0]);
  const CLAVE_MAESTRA = "orj2026";

  useEffect(() => {
    fetchDatos();
  }, [filtroFecha]);

  const fetchDatos = async () => {
    setLoading(true);
    // Traemos todos los tipos de operación para el balance
    const { data, error } = await supabase
      .from('operaciones_refineria')
      .select('*')
      .gte('created_at', `${filtroFecha}T00:00:00`)
      .lte('created_at', `${filtroFecha}T23:59:59`)
      .order('created_at', { ascending: true });

    if (!error) setRegistros(data);
    setLoading(false);
  };

  // --- LÓGICA DE AGRUPACIÓN ---
  const agruparAcidoGraso = () => {
    const resumen: any = {};
    registros.filter(r => r.tipo_operacion === 'ACIDO_GRASO').forEach(r => {
      const clave = `${r.variedad} - ${r.es_reproceso ? 'REPROCESO' : 'NORMAL'}`;
      resumen[clave] = (resumen[clave] || 0) + parseFloat(r.valor_lectura);
    });
    return resumen;
  };

  // --- LÓGICA DEL BALANCE (RESTA ULTIMO - PRIMERO) ---
  const calcularTotalPorTipo = (tipo: string) => {
    const items = registros.filter(r => r.tipo_operacion === tipo);
    if (items.length < 1) return 0;
    // Gran total = Última lectura registrada - Primera lectura registrada del día
    const primera = parseFloat(items[0].valor_lectura);
    const ultima = parseFloat(items[items.length - 1].valor_lectura);
    return ultima - primera;
  };

  const handleEdit = async (id: string, valorActual: number) => {
    const clave = prompt("INGRESE CLAVE DE AUTORIZACIÓN:");
    if (clave !== CLAVE_MAESTRA) return alert("CLAVE INCORRECTA");

    const nuevoValor = prompt("NUEVO VALOR DE LECTURA (KG):", valorActual.toString());
    if (nuevoValor) {
      const { error } = await supabase.from('operaciones_refineria')
        .update({ valor_lectura: parseFloat(nuevoValor) })
        .eq('id', id);
      if (!error) fetchDatos();
    }
  };

  const enviarWhatsApp = () => {
    const acido = agruparAcidoGraso();
    const totalACP = calcularTotalPorTipo('ENTRADA_ACP');
    const totalRBD = calcularTotalPorTipo('SALIDA_RBD'); // Asumiendo este tipo
    
    let msg = `*📊 REPORTE DE PRODUCCIÓN (${filtroFecha})*%0A%0A`;
    msg += `*SALIDAS ÁCIDO GRASO:*%0A`;
    Object.entries(acido).forEach(([k, v]) => {
      msg += `• ${k}: ${Number(v).toLocaleString()} KG%0A`;
    });
    
    msg += `%0A*BALANCE DE MASA:*%0A`;
    msg += `• ENTRADA ACP: ${totalACP.toLocaleString()} KG%0A`;
    msg += `• SALIDA ESTIMADA: ${(totalRBD + Object.values(acido).reduce((a:any,b:any)=>a+b,0)).toLocaleString()} KG`;
    
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans uppercase text-[10px]">
      <header className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
        <h1 className="text-orange-500 font-black tracking-widest">CONTROL DE BALANCE OROJUEZ</h1>
        <input 
          type="date" 
          value={filtroFecha} 
          onChange={(e) => setFiltroFecha(e.target.value)}
          className="bg-zinc-900 border border-white/10 p-2 rounded-xl text-white"
        />
      </header>

      {/* SECCIÓN DE TOTALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-900 p-4 rounded-3xl border border-white/5">
          <p className="text-zinc-500 font-black mb-3">RESUMEN POR VARIEDAD (ÁCIDO)</p>
          {Object.entries(agruparAcidoGraso()).map(([label, valor]: any) => (
            <div key={label} className="flex justify-between py-2 border-b border-white/5">
              <span>{label}</span>
              <span className="font-black text-orange-500">{valor.toLocaleString()} KG</span>
            </div>
          ))}
          <button onClick={enviarWhatsApp} className="w-full mt-4 py-3 bg-emerald-600 rounded-xl font-black">EXPORTAR TOTALES WA</button>
        </div>

        <div className="bg-zinc-900 p-4 rounded-3xl border border-white/5 flex flex-col justify-center text-center">
          <p className="text-zinc-500 font-black">ENTRADA TOTAL ACP (NETO)</p>
          <p className="text-4xl font-black text-white">{calcularTotalPorTipo('ENTRADA_ACP').toLocaleString()} KG</p>
          <p className="text-[8px] mt-2 text-zinc-600">CALCULADO: LECTURA FINAL - LECTURA INICIAL DEL DÍA</p>
        </div>
      </div>

      {/* TABLA DETALLADA */}
      <div className="bg-zinc-900 rounded-3xl border border-white/5 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5">
            <tr>
              <th className="p-4">HORA</th>
              <th className="p-4">TIPO / VARIEDAD</th>
              <th className="p-4 text-right">VALOR</th>
              <th className="p-4 text-center">FOTO</th>
              <th className="p-4 text-center">EDIT</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="p-4 text-zinc-500">{new Date(r.created_at).toLocaleTimeString()}</td>
                <td className="p-4 font-bold">{r.tipo_operacion} <br/> <span className="text-[8px] text-zinc-500">{r.variedad}</span></td>
                <td className="p-4 text-right font-black text-orange-500">{parseFloat(r.valor_lectura).toLocaleString()} KG</td>
                <td className="p-4 text-center">
                  {r.foto_url && <a href={r.foto_url} target="_blank" rel="noreferrer">📸</a>}
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => handleEdit(r.id, r.valor_lectura)} className="text-blue-500 text-lg">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}