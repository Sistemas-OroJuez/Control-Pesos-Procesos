'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function ReporteFinalAuditoria() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]); 
  const [balanceData, setBalanceData] = useState<any[]>([]); 
  const [modoVista, setModoVista] = useState<'AUDITORIA' | 'GERENCIAL'>('AUDITORIA');
  
  // Estados para Filtros
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [filtroVariedad, setFiltroVariedad] = useState('TODOS');
  const [filtroOperacion, setFiltroOperacion] = useState('TODOS');

  useEffect(() => {
    if (modoVista === 'AUDITORIA') fetchAuditoria();
    else fetchBalanceGerencial();
  }, [fechaInicio, fechaFin, modoVista, filtroVariedad, filtroOperacion]);

  // --- FETCH DATA AUDITORIA ---
  const fetchAuditoria = async () => {
    setLoading(true);
    let query = supabase
      .from('operaciones_refineria')
      .select('*')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('operacion', { ascending: true })
      .order('variedad', { ascending: true })
      .order('fecha', { ascending: false });

    if (filtroVariedad !== 'TODOS') query = query.eq('variedad', filtroVariedad);
    if (filtroOperacion !== 'TODOS') query = query.eq('operacion', filtroOperacion);

    const { data } = await query;
    setRegistros(data || []);
    setLoading(false);
  };

  // --- FETCH DATA GERENCIAL ---
  const fetchBalanceGerencial = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('balance_refineria')
      .select('*')
      .gte('fecha3', fechaInicio)
      .lte('fecha3', fechaFin)
      .order('fecha3', { ascending: false });
    setBalanceData(data || []);
    setLoading(false);
  };

  // --- LÓGICA ESPECIAL ÁCIDO GRASO ---
  const calcularKgAcidoGraso = (medidaVacio: number, numTanque: string) => {
    // Tabla de factores por tanque (Ajustar según necesidad)
    const factores: { [key: string]: number } = { '1': 0.92, '2': 0.95, 'DEFAULT': 0.90 };
    const factor = factores[numTanque] || factores['DEFAULT'];
    return medidaVacio * factor; 
  };

  // --- WHATSAPP CORREGIDO ---
  const enviarWhatsApp = (grupo: any[], titulo: string) => {
    let mensaje = `*REPORTE AUDITORÍA: ${titulo}*\n`;
    mensaje += `Periodo: ${fechaInicio} al ${fechaFin}\n\n`;

    grupo.forEach(reg => {
      let resultado = (reg.valor_lectura || 0) - (reg.lectura_anterior || 0);
      
      // Si es Ácido Graso, aplicar la fórmula especial en el mensaje también
      if (reg.operacion === 'ACIDO GRASO') {
        const kgVacio = calcularKgAcidoGraso(reg.medida_vacio, reg.tanque_id);
        resultado = (kgVacio + (reg.egreso_produccion || 0) + (reg.egreso_venta || 0)) - (reg.lectura_anterior || 0);
      }

      mensaje += `📍 *${reg.variedad}* (${reg.fecha})\n`;
      mensaje += `L.Act: ${reg.valor_lectura.toLocaleString()}\n`;
      mensaje += `L.Ant: ${reg.lectura_anterior?.toLocaleString() || 0}\n`;
      mensaje += `Diff: *${resultado.toLocaleString()} Kg*\n`;
      mensaje += `--------------------------\n`;
    });

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  // --- RENDER VISTA AUDITORÍA (CON SUBTOTALES) ---
  const renderTablaAuditoria = () => {
    const grupos: any = {};
    registros.forEach(reg => {
      if (!grupos[reg.operacion]) grupos[reg.operacion] = {};
      if (!grupos[reg.operacion][reg.variedad]) grupos[reg.operacion][reg.variedad] = [];
      grupos[reg.operacion][reg.variedad].push(reg);
    });

    return Object.keys(grupos).map(op => (
      <div key={op} className="mb-12 bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">OPERACIÓN: {op}</h2>
          <button 
            onClick={() => enviarWhatsApp(Object.values(grupos[op]).flat() as any[], op)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-2xl text-xs font-black transition-all shadow-lg"
          >
            📲 WHATSAPP {op}
          </button>
        </div>

        {Object.keys(grupos[op]).map(varie => {
          const items = grupos[op][varie];
          let subtotalLectura = 0;
          let subtotalDiferencia = 0;

          return (
            <div key={varie} className="border-t border-slate-100">
              <div className="bg-slate-50 px-8 py-4">
                <h3 className="text-xl font-black text-blue-600 uppercase">VARIEDAD: {varie}</h3>
              </div>
              
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-[10px] uppercase font-bold border-b border-slate-50">
                    <th className="p-4 text-left">Fecha</th>
                    <th className="p-4 text-right">Lectura Actual</th>
                    <th className="p-4 text-right">Lectura Anterior</th>
                    <th className="p-4 text-right">Diferencia (Kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r: any) => {
                    let resultado = (r.valor_lectura || 0) - (r.lectura_anterior || 0);

                    if (op === 'ACIDO GRASO') {
                      const kgVacio = calcularKgAcidoGraso(r.medida_vacio, r.tanque_id);
                      resultado = (kgVacio + (r.egreso_produccion || 0) + (r.egreso_venta || 0)) - (r.lectura_anterior || 0);
                    }

                    subtotalLectura += r.valor_lectura;
                    subtotalDiferencia += resultado;

                    return (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-500">{r.fecha}</td>
                        <td className="p-4 text-right font-bold">{r.valor_lectura.toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-400">{r.lectura_anterior?.toLocaleString() || 0}</td>
                        <td className="p-4 text-right font-black text-slate-900">{resultado.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {/* FILA DE SUBTOTAL REQUERIDA: GRANDE Y VISIBLE */}
                  <tr className="bg-blue-600 text-white">
                    <td className="p-6 text-lg font-black uppercase">SUBTOTAL {varie}</td>
                    <td className="p-6 text-right text-xl font-bold">{subtotalLectura.toLocaleString()}</td>
                    <td className="p-6"></td>
                    <td className="p-6 text-right text-3xl font-black border-l border-blue-500">
                      {subtotalDiferencia.toLocaleString()} <span className="text-sm">Kg</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    ));
  };

  // --- RENDER VISTA GERENCIAL (Original) ---
  const renderTablaGerencial = () => (
    <div className="bg-slate-900 rounded-[40px] shadow-2xl overflow-hidden border border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead className="bg-white/5 text-slate-400 font-bold uppercase">
            <tr>
              <th className="p-4">Fecha</th>
              <th className="p-4 text-right">L. Ini CPO</th>
              <th className="p-4 text-right">L. Fin CPO</th>
              <th className="p-4 text-right">L. Ini RBD</th>
              <th className="p-4 text-right">L. Fin RBD</th>
              <th className="p-4 text-right">Inv Ini</th>
              <th className="p-4 text-right">Inv Fin</th>
              <th className="p-4 text-right text-white">Total CPO</th>
              <th className="p-4 text-right text-emerald-400">Total RBD</th>
              <th className="p-4 text-right">AGL</th>
              <th className="p-4 text-right">Balance</th>
              <th className="p-4 text-right">% Merma</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {balanceData.map((b, idx) => {
              const totalCPO = b.flujometro_final_cpo - b.flujometro_inicial_cpo;
              const totalRBD = b.flujometro_final_rbd - b.flujometro_inicial_rbd;
              const balance = (totalCPO + b.inventario_inicial_ds3) - (totalRBD + b.agl + b.reproceso + b.inventario_final_ds3);
              const merma = totalCPO > 0 ? (balance / totalCPO) * 100 : 0;

              return (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4 font-bold">{b.fecha3}</td>
                  <td className="p-4 text-right">{b.flujometro_inicial_cpo?.toLocaleString()}</td>
                  <td className="p-4 text-right">{b.flujometro_final_cpo?.toLocaleString()}</td>
                  <td className="p-4 text-right">{b.flujometro_inicial_rbd?.toLocaleString()}</td>
                  <td className="p-4 text-right">{b.flujometro_final_rbd?.toLocaleString()}</td>
                  <td className="p-4 text-right">{b.inventario_inicial_ds3?.toLocaleString()}</td>
                  <td className="p-4 text-right">{b.inventario_final_ds3?.toLocaleString()}</td>
                  <td className="p-4 text-right font-bold text-white">{totalCPO.toLocaleString()}</td>
                  <td className="p-4 text-right font-bold text-emerald-400">{totalRBD.toLocaleString()}</td>
                  <td className="p-4 text-right">{b.agl?.toLocaleString()}</td>
                  <td className="p-4 text-right font-black text-blue-400">{balance.toLocaleString()}</td>
                  <td className={`p-4 text-right font-bold ${merma > 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {merma.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* CABECERA Y SELECTOR DE VISTA */}
        <div className="bg-white p-8 rounded-[45px] shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Reportes Refinería</h1>
              <p className="text-slate-500 font-medium">Análisis de Auditoría y Balances Gerenciales</p>
            </div>
            
            <div className="flex bg-slate-100 p-1.5 rounded-[25px] shadow-inner border border-slate-200">
              <button 
                onClick={() => setModoVista('AUDITORIA')}
                className={`px-8 py-3 rounded-2xl text-[10px] font-black transition-all ${modoVista === 'AUDITORIA' ? 'bg-white shadow-xl text-blue-600 scale-105' : 'text-slate-400'}`}
              >
                VISTA AUDITORÍA
              </button>
              <button 
                onClick={() => setModoVista('GERENCIAL')}
                className={`px-8 py-3 rounded-2xl text-[10px] font-black transition-all ${modoVista === 'GERENCIAL' ? 'bg-white shadow-xl text-emerald-600 scale-105' : 'text-slate-400'}`}
              >
                REPORTE GERENCIAL
              </button>
            </div>
          </div>

          {/* FILTROS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-100">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 ml-2">FECHA INICIO</label>
              <input type="date" className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs border-none" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 ml-2">FECHA FIN</label>
              <input type="date" className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs border-none" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 ml-2">OPERACIÓN</label>
              <select className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs border-none uppercase" value={filtroOperacion} onChange={e => setFiltroOperacion(e.target.value)}>
                <option value="TODOS">TODAS</option>
                <option value="ENTRADA ACP">ENTRADA ACP</option>
                <option value="SALIDA RBD">SALIDA RBD</option>
                <option value="ACIDO GRASO">ACIDO GRASO</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 ml-2">VARIEDAD</label>
              <select className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs border-none uppercase" value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)}>
                <option value="TODOS">TODAS</option>
                <option value="GUINENSIS">GUINENSIS</option>
                <option value="HIBRIDO">HIBRIDO</option>
              </select>
            </div>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        {loading ? (
          <div className="flex flex-col justify-center items-center p-20 gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-black text-slate-400 animate-pulse uppercase">Procesando datos...</p>
          </div>
        ) : (
          modoVista === 'AUDITORIA' ? renderTablaAuditoria() : renderTablaGerencial()
        )}

      </div>
    </div>
  );
}