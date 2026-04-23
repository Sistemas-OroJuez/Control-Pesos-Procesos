import { NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let worker;
  try {
    // CAMBIO: Ahora aceptamos tanto "fotoUrl" como "image" (Base64)
    const { fotoUrl, image } = await request.json();
    const source = image || fotoUrl; // Prioriza Base64 si existe

    if (!source) throw new Error("No hay imagen");

    worker = await createWorker('eng', 1);

    // MANTENEMOS TU WHITELIST (Es lo que te costó cuadrar)
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.kghClΣ', // Añadí el Σ por si acaso
    });

    // RECONOCIMIENTO
    const { data: { text } } = await worker.recognize(source);
    console.log("Texto detectado:", text);

    // --- TU LÓGICA DE EXTRACCIÓN (INTACTA) ---
    const masaMatch = text.match(/(\d+\.\d+)\s*kg\/h/i);
    const masa = masaMatch ? parseFloat(masaMatch[1]) : 0;

    const sumatoriaMatch = text.match(/(\d{7,8})/);
    const sumatoria = sumatoriaMatch ? parseInt(sumatoriaMatch[1], 10) : 0;

    const tempMatch = text.match(/(\d+\.\d+)\s*C/i);
    const temp = tempMatch ? parseFloat(tempMatch[1]) : 0;

    const densMatch = text.match(/(\d+\.\d+)\s*kg\/l/i);
    const densidad = densMatch ? parseFloat(densMatch[1]) : 0;

    await worker.terminate();

    return NextResponse.json({
      valorPrincipal: sumatoria,
      metadatosAdicionales: {
        masa_kg_h: masa,
        temperatura_c: temp,
        densidad_kg_l: densidad
      },
      textoCompleto: text,
      version_test: "TESSERACT_STABLE_V2_PROXY"
    });

  } catch (error: any) {
    if (worker) await worker.terminate();
    console.error("Error en servidor:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}