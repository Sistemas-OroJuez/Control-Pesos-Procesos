import { NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let worker;
  try {
    const { fotoUrl } = await request.json();
    if (!fotoUrl) throw new Error("No hay imagen");

    worker = await createWorker('eng', 1);

    // Permitimos números, puntos y letras clave para las unidades
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.kghCl',
    });

    const { data: { text } } = await worker.recognize(fotoUrl);
    console.log("Texto detectado:", text);

    // --- EXTRACCIÓN CON PATRONES ESPECÍFICOS ---

    // 1. Masa (ṁ): Busca números con punto antes de 'kg/h'
    const masaMatch = text.match(/(\d+\.\d+)\s*kg\/h/i);
    const masa = masaMatch ? parseFloat(masaMatch[1]) : 0;

    // 2. Sumatoria (Σ1): Busca 7 u 8 dígitos exactos. 
    // Usamos parseInt para asegurar que sea un número entero y evitar decimales falsos.
    const sumatoriaMatch = text.match(/(\d{7,8})/);
    const sumatoria = sumatoriaMatch ? parseInt(sumatoriaMatch[1], 10) : 0;

    // 3. Temperatura (🌡): Busca números con punto antes de '°C' (o 'C' si el símbolo falla)
    const tempMatch = text.match(/(\d+\.\d+)\s*C/i);
    const temp = tempMatch ? parseFloat(tempMatch[1]) : 0;

    // 4. Densidad (ρ): Busca números (normalmente iniciando con 0.) antes de 'kg/l'
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
      version_test: "TESSERACT_FULL_SYNC_V2"
    });

  } catch (error: any) {
    if (worker) await worker.terminate();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}