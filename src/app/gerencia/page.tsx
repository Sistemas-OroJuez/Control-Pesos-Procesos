'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function ReporteGerencial() {
  const router = useRouter();
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWSModal, setShowWSModal] = useState(false);
  const [contactoSel, setContactoSel] = useState({ nombre: '', telefono: '' });

  const [filtros, setFiltros] = useState({
    fechaDesde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fechaHasta: new Date().toISOString().split('T')[0],
    localidad: ''
  });

  const [catalogos, setCatalogos] = useState<any>({ localidades: [], operadores: [] });

  useEffect(() => {
    inicializar();
  }, []);

  async function inicializar() {
    const [resLoc, resOpe] = await Promise.all([
      supabase.from('localidades').select('*').order('nombre'),
      supabase.from('operadores').select('*').order('nombre')
    ]);
    setCatalogos({ localidades: resLoc.data || [], operadores: resOpe.data || [] });
    consultar();
  }

  // Función para calcular diferencia de tiempo mm:ss
  const diffMinutos = (inicio: string, fin: string) => {
    if (!inicio || !fin) return "0:00";
    const d1 = new Date(inicio).getTime();
    const d2 = new Date(fin).getTime();
    const diffMs = Math.abs(d2 - d1);
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  async function consultar() {
    setLoading(true);
    let query = supabase
      .from('procesos_batch')
      .select(`*, operadores (nombre, telefono, sitios (nombre, localidad_id, localidades (nombre)))`)
      .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
      .lte('created_at', `${filtros.fechaHasta}T23:59:59`)
      .order('created_at', { ascending: true }); // Orden ascendente para calcular tiempos correlativos

    const { data } = await query;

    if (data) {
      // Cálculo de Eficiencia
      const conEficiencia = data.map((curr, idx) => {
        const duracion = diffMinutos(curr.fecha_inicio_proceso || curr.created_at, curr.created_at);
        const entreBatch = idx > 0 ? diffMinutos(data[idx-1].created_at, curr.created_at) : "N/A";
        return { ...curr, duracion, entreBatch };
      });

      const filtrados = filtros.localidad 
        ? conEficiencia.filter(i => i.operadores?.sitios?.localidad_id === filtros.localidad)
        : conEficiencia;

      setDatos(filtrados.reverse()); // Volteamos para ver lo último arriba
    }
    setLoading(false);
  }

  const enviarWhatsApp = () => {
    if (!contactoSel.telefono) return alert("Selecciona un contacto");
    const total = datos.reduce((acc, c) => acc + Number(c.peso_final_digitado), 0);
    
    const msg = `*📊 REPORTE GERENCIAL DE EFICIENCIA*%0A` +
                `*Periodo:* ${filtros.fechaDesde} al ${filtros.fechaHasta}%0A` +
                `*Total Kilos:* ${total.toLocaleString()} kg%0A` +
                `*Registros:* ${datos.length}%0A` +
                `-----------------------------%0A` +
                `*Link de Auditoría:*%0A${window.location.href}`;
    
    window.open(`https://wa.me/593${contactoSel.telefono}?text=${msg}`, '_blank');
    setShowWSModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* NAV GERENCIAL */}
      <nav className="bg-slate-900 text-white p-4 shadow-xl sticky top-0 z-30 border-b-4 border-red-700">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="bg-slate-800 p-2 rounded-lg text-[10px] font-black">VOLVER</button>
            <h1 className="font-black uppercase tracking-tighter italic">Panel de Eficiencia Gerencial</h1>
          </div>
          <button onClick={() => setShowWSModal(true)} className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2">
            📲 Compartir WhatsApp
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* FILTROS E INDICADORES */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-3xl shadow-sm border col-span-2 flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[9px] font-black text-gray-400 ml-2 uppercase">Desde / Hasta</label>
              <div className="flex gap-2">
                <input type="date" className="w-full p-2 border rounded-xl font-bold text-xs" value={filtros.fechaDesde} onChange={e => setFiltros({...filtros, fechaDesde: e.target.value})} />
                <input type="date" className="w-full p-2 border rounded-xl font-bold text-xs" value={filtros.fechaHasta} onChange={e => setFiltros({...filtros, fechaHasta: e.target.value})} />
              </div>
            </div>
            <button onClick={consultar} className="bg-red-700 text-white p-3 rounded-xl font-black text-[10px] uppercase">Filtrar</button>
          </div>
          
          <div className="bg-red-700 p-4 rounded-3xl shadow-lg text-white">
            <p className="text-[9px] font-black uppercase opacity-60">Kilos Totales</p>
            <p className="text-2xl font-black">{datos.reduce((acc,c) => acc + Number(c.peso_final_digitado), 0).toLocaleString()} kg</p>
          </div>
        </div>

        {/* TABLA GERENCIAL */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border">
          <table className="w-full text-[10px]">
            <thead className="bg-slate-100 text-slate-500 font-black uppercase border-b">
              <tr>
                <th className="p-4 text-left">Batch / Fecha</th>
                <th className="p-4 text-left">Sitio / Operador</th>
                <th className="p-4 text-center bg-blue-50 text-blue-700">⏱ Lapso Batch</th>
                <th className="p-4 text-center bg-orange-50 text-orange-700">⌛ Entre Batches</th>
                <th className="p-4 text-right">Peso Kg</th>
                <th className="p-4 text-center">Auditoría</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {datos.map(reg => (
                <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <span className="font-black text-red-700 text-sm">#{reg.batch_id}</span><br/>
                    {new Date(reg.created_at).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <p className="font-black uppercase">{reg.operadores?.sitios?.nombre}</p>
                    <p className="font-bold text-gray-400">{reg.operadores?.nombre}</p>
                  </td>
                  <td className="p-4 text-center font-black text-blue-600 bg-blue-50/20">{reg.duracion} min</td>
                  <td className="p-4 text-center font-black text-orange-600 bg-orange-50/20">{reg.entreBatch} min</td>
                  <td className="p-4 text-right font-black text-red-700 text-lg">{reg.peso_final_digitado}</td>
                  <td className="p-4">
                    <div className="flex gap-1 justify-center">
                      <a href={reg.foto_visor_final} target="_blank" className="bg-slate-800 text-white px-2 py-1 rounded font-black text-[8px] uppercase">Visor Peso</a>
                      {reg.foto_observacion && <a href={reg.foto_observacion} target="_blank" className="bg-orange-500 text-white px-2 py-1 rounded font-black text-[8px] uppercase">Nov</a>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL WHATSAPP */}
      {showWSModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-slate-800 uppercase text-center mb-6">Enviar a Gerencia</h3>
            <div className="space-y-2 mb-6">
              {catalogos.operadores.map((op: any) => (
                <button 
                  key={op.id}
                  onClick={() => setContactoSel({ nombre: op.nombre, telefono: op.telefono })}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${contactoSel.telefono === op.telefono ? 'border-green-500 bg-green-50' : 'border-slate-100'}`}
                >
                  <p className="font-black text-[10px] uppercase">{op.nombre}</p>
                  <p className="text-[9px] text-gray-400 font-bold">{op.telefono}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={enviarWhatsApp} className="flex-1 bg-green-500 text-white p-4 rounded-2xl font-black uppercase text-[10px]">Enviar WhatsApp</button>
              <button onClick={() => setShowWSModal(false)} className="flex-1 bg-slate-100 text-slate-400 p-4 rounded-2xl font-black uppercase text-[10px]">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}