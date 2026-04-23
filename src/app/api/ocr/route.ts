import { NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';

export const dynamic = 'force-dynamic';
// Aumentamos el tiempo de espera permitido en Vercel
export const maxDuration = 60; 

export async function POST(request: Request) {
  let worker;
  try {
    const { image } = await request.json();
    if (!image) throw new Error("No hay imagen");

    // Inicialización rápida: solo inglés y sin logs pesados
    worker = await createWorker('eng');

    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.kghClΣESM',
      tessedit_pageseg_mode: '6' as any, // Modo "bloque de texto", es más rápido
    });

    const { data: { text } } = await worker.recognize(image);
    
    // Tu lógica de limpieza (7-8 dígitos)
    const sumatoriaMatch = text.match(/(\d{7,8})/);
    const sumatoria = sumatoriaMatch ? parseInt(sumatoriaMatch[1], 10) : 0;

    await worker.terminate();

    return NextResponse.json({
      valorPrincipal: sumatoria,
      textoCompleto: text
    });

  } catch (error: any) {
    if (worker) await worker.terminate();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}