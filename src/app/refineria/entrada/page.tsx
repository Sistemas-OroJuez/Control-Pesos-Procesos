'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Tesseract from 'tesseract.js';

export default function IngresoACP() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [datosConfirmados, setDatosConfirmados] = useState<any>(null);
  const [esReproceso, setEsReproceso] = useState(false);

  // Cargar estado de reproceso
  useEffect(() => {
    const cargarEstado = async () => {
      const { data } = await supabase.from('estado_proceso_refineria').select('en_reproceso').eq('id', 'GLOBAL_STATUS').single();
      if (data) setEsReproceso(data.en_reproceso);
    };
    cargarEstado();
  }, []);

  const aplicarFiltrosYProcesar = async (file: File) => {
    setLoading(true);
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;

      // 1. DIBUJAR Y CONVERTIR A BLANCO Y NEGRO (Grayscale + Threshold)
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // Umbral: Si es más oscuro que 128, se vuelve negro (0), si es más claro, blanco (255)
        const threshold = avg > 120 ? 255 : 0; 
        data[i] = data[i + 1] = data[i + 2] = threshold;
      }
      ctx.putImageData(imageData, 0, 0);

      // 2. PASAR LA IMAGEN FILTRADA A TESSERACT
      const result = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng');
      const { words } = result.data;
      const cleanText = result.data.text.toUpperCase().replace(/[^A-Z0-9.\-_]/g, ' ');

      // 3. VINCULACIÓN CON CATÁLOGO
      const { data: equipos } = await supabase.from('cat_equipos').select('*');
      const equipoVinculado = equipos?.find(eq => cleanText.includes(eq.tag_id.toUpperCase()));

      if (!equipoVinculado) {
        alert("❌ ERROR: No se detectó el TAG ID del equipo en la zona de anclaje.");
        setLoading(false);
        return;
      }

      // 4. DIBUJAR MARCADORES VISUALES
      ctx.drawImage(img, 0, 0); // Redibujamos la foto original para que los cuadros se vean bien
      words.forEach(word => {
        const wordText = word.text.toUpperCase();
        if (equipoVinculado.tag_id.includes(wordText) || /\d{7,9}/.test(wordText)) {
          ctx.strokeStyle = equipoVinculado.tag_id.includes(wordText) ? '#3b82f6' : '#00ff00';
          ctx.lineWidth = 8;
          ctx.strokeRect(word.bbox.x0, word.bbox.y0, word.bbox.x1 - word.bbox.x0, word.bbox.y1 - word.bbox.y0);
        }
      });

      // 5. SUBIR IMAGEN FINAL MARCADA
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const fileName = `${Date.now()}_ocr.jpg`;
        await supabase.storage.from('refineria_assets').upload(fileName, blob);
        const { data: urlData } = supabase.storage.from('refineria_assets').getPublicUrl(fileName);
        setFotoUrl(urlData.publicUrl);
      }, 'image/jpeg');

      // 6. EXTRAER VALORES
      const decimales = cleanText.match(/\d+\.\d+/g) || [];
      const totalizador = cleanText.match(/(\d{7,9})/);

      setDatosConfirmados({
        valorPrincipal: totalizador ? parseInt(totalizador[1], 10) : 0,
        tagDetectado: equipoVinculado.tag_id,
        nombreEquipo: equipoVinculado.nombre,
        metadatos: {
          masa: decimales[0] || 0,
          temp: decimales[1] || 0,
          dens: decimales[2] || 0
        }
      });
      setLoading(false);
    };
  };

  const guardar = async () => {
    if (!datosConfirmados || !fotoUrl) return;
    setLoading(true);
    const { error } = await supabase.from('operaciones_refineria').insert([{
      tipo_operacion: 'INGRESO_ACP',
      valor_lectura: datosConfirmados.valorPrincipal,
      foto_url: fotoUrl,
      masa_kg_h: Number(datosConfirmados.metadatos.masa),
      temperatura_c: Number(datosConfirmados.metadatos.temp),
      densidad_kg_l: Number(datosConfirmados.metadatos.dens),
      es_reproceso: esReproceso,
      observaciones: `ID: ${datosConfirmados.tagDetectado}`
    }]);
    if (!error) {
      alert("Registro exitoso");
      setFotoUrl(null);
      setDatosConfirmados(null);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black p-4 flex flex-col items-center">
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="w-full max-w-md bg-[#111] rounded-3xl border border-gray-800 overflow-hidden shadow-2xl">
        <header className={`p-6 text-center text-white ${esReproceso ? 'bg-red-700' : 'bg-blue-800'}`}>
          <h1 className="font-black italic text-xl uppercase tracking-tighter">Ingreso ACP</h1>
        </header>

        <div className="p-6 space-y-6">
          {!fotoUrl ? (
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full h-48 border-4 border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center text-gray-500"
            >
              <span className="text-5xl mb-2">📸</span>
              <p className="font-black text-[10px] uppercase tracking-widest">{loading ? 'Procesando B&W + OCR...' : 'Escanear Pantalla'}</p>
            </button>
          ) : (
            <div className="relative group">
              <img src={fotoUrl} className="w-full rounded-2xl border-2 border-blue-500 shadow-lg shadow-blue-500/20" />
              <button onClick={() => { setFotoUrl(null); setDatosConfirmados(null); }} className="absolute -top-2 -right-2 bg-red-600 text-white w-8 h-8 rounded-full font-bold">X</button>
            </div>
          )}

          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && aplicarFiltrosYProcesar(e.target.files[0])} />

          {datosConfirmados && (
            <div className="bg-black/50 p-6 rounded-2xl border border-green-900/50 space-y-4">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-blue-400 font-mono text-[10px] uppercase">{datosConfirmados.tagDetectado}</span>
                <span className="text-white font-bold text-[10px] uppercase">{datosConfirmados.nombreEquipo}</span>
              </div>
              <div className="text-center py-2">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Totalizador Σ1</p>
                <p className="text-5xl font-black text-green-400 tracking-tighter">{datosConfirmados.valorPrincipal.toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 p-2 rounded-lg">
                  <p className="text-[8px] text-gray-500 uppercase">Masa</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatos.masa}</p>
                </div>
                <div className="bg-white/5 p-2 rounded-lg">
                  <p className="text-[8px] text-gray-500 uppercase">Temp</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatos.temp}°</p>
                </div>
                <div className="bg-white/5 p-2 rounded-lg">
                  <p className="text-[8px] text-gray-500 uppercase">Dens</p>
                  <p className="text-white font-bold text-xs">{datosConfirmados.metadatos.dens}</p>
                </div>
              </div>
            </div>
          )}

          <button 
            onClick={guardar}
            disabled={!datosConfirmados || loading}
            className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-30"
          >
            Confirmar y Guardar
          </button>
        </div>
      </div>
    </div>
  );
}