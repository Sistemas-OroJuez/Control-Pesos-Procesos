'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
// ... (mismas importaciones anteriores)

export default function ReporteGerencial() {
  const [showWSModal, setShowWSModal] = useState(false);
  const [contactoSel, setContactoSel] = useState({ nombre: '', telefono: '' });
  // ... (mismos estados de datos y filtros)

  // --- LÓGICA DE ENVÍO POR WHATSAPP ---
  const enviarPorWhatsApp = () => {
    if (!contactoSel.telefono) return alert("Seleccione un contacto");

    // Calculamos los KPIs para el mensaje
    const totalKilos = datos.reduce((acc, curr) => acc + (Number(curr.peso_final_digitado) || 0), 0);
    const totalRegistros = datos.length;
    
    // Construimos el mensaje con formato de WhatsApp
    const mensaje = `*📊 REPORTE GERENCIAL DE PESAJES*%0A` +
      `------------------------------------%0A` +
      `*Periodo:* ${filtros.fechaDesde} al ${filtros.fechaHasta}%0A` +
      `*Total Kilos:* ${totalKilos.toLocaleString()} kg%0A` +
      `*Nº Batches:* ${totalRegistros}%0A` +
      `------------------------------------%0A` +
      `*DETALLE POR SITIO:*%0A` +
      Object.keys(subtotalesPorSitio).map(s => `- ${s}: ${subtotalesPorSitio[s].toLocaleString()} kg`).join('%0A') +
      `%0A%0A*Accede al reporte completo aquí:*%0A${window.location.href}`;

    // Abrir WhatsApp con el mensaje pre-cargado
    const url = `https://wa.me/593${contactoSel.telefono}?text=${mensaje}`;
    window.open(url, '_blank');
    setShowWSModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER CON BOTÓN WHATSAPP */}
      <nav className="bg-slate-900 p-4 shadow-md border-b-4 border-red-700 sticky top-0 z-20 text-white">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="font-black uppercase text-lg tracking-tighter">Gerencia de Eficiencia</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowWSModal(true)} 
              className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-xl font-bold text-[10px] uppercase flex items-center gap-2"
            >
              <span>📲</span> WhatsApp
            </button>
            {/* ... botones excel y pdf */}
          </div>
        </div>
      </nav>

      {/* MODAL DE SELECCIÓN DE CONTACTO */}
      {showWSModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border-t-8 border-green-500">
            <h3 className="font-black text-gray-800 uppercase mb-4">Enviar Reporte vía WhatsApp</h3>
            <p className="text-[10px] text-gray-400 font-bold mb-4 uppercase">Seleccione el destinatario:</p>
            
            <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
              {catalogos.operadores.map((op: any) => (
                <div 
                  key={op.id}
                  onClick={() => setContactoSel({ nombre: op.nombre, telefono: op.telefono })}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${contactoSel.telefono === op.telefono ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:bg-gray-50'}`}
                >
                  <p className="font-black text-xs uppercase">{op.nombre}</p>
                  <p className="text-[10px] text-gray-400 font-bold">{op.telefono || 'Sin teléfono'}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={enviarPorWhatsApp}
                disabled={!contactoSel.telefono}
                className="flex-1 bg-green-500 text-white p-4 rounded-2xl font-black uppercase text-xs shadow-lg disabled:opacity-30"
              >
                Enviar a {contactoSel.nombre.split(' ')[0]}
              </button>
              <button 
                onClick={() => setShowWSModal(false)}
                className="flex-1 bg-gray-100 text-gray-400 p-4 rounded-2xl font-black uppercase text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ... Resto de la tabla y filtros igual ... */}
    </div>
  );
}