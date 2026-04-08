import { NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let worker;
  try {
    const { fotoUrl } = await request.json();

    if (!fotoUrl) throw new Error("No hay imagen");

    // Inicializar el trabajador de forma más eficiente
    worker = await createWorker('eng', 1, {
      logger: m => console.log(m.status, m.progress), // Ver progreso en los logs de Vercel
    });

    // Configurar para que solo busque números (esto lo hace mucho más rápido)
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
    });

    const { data: { text } } = await worker.recognize(fotoUrl);
    
    // Extraer sumatoria
    const sumatoriaMatch = text.match(/(\d{7,8})/);
    const sumatoria = sumatoriaMatch ? parseFloat(sumatoriaMatch[1]) : 0;

    await worker.terminate();

    return NextResponse.json({
      valorPrincipal: sumatoria,
      textoCompleto: text,
      version_test: "TESSERACT_OPTIMIZADO"
    });

  } catch (error: any) {
    if (worker) await worker.terminate();
    console.error("Error OCR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}