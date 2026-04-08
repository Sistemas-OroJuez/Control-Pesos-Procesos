import { NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const VERSION = "TESSERACT_V1_FREE";

  try {
    const { fotoUrl } = await request.json();

    if (!fotoUrl) {
      throw new Error("No se recibió la URL de la imagen.");
    }

    // Ejecutamos el OCR gratuito
    const { data: { text } } = await Tesseract.recognize(
      fotoUrl,
      'spa', // Idioma español
      { 
        // Esto ayuda a que reconozca mejor números si la foto es difícil
        tessedit_char_whitelist: '0123456789., ' 
      }
    );

    console.log("Texto detectado por Tesseract:", text);

    // Buscamos la sumatoria de 7 u 8 dígitos
    const sumatoriaMatch = text.match(/(\d{7,8})/);
    const sumatoria = sumatoriaMatch ? parseFloat(sumatoriaMatch[1]) : 0;

    return NextResponse.json({
      valorPrincipal: sumatoria,
      metadatosAdicionales: {
        masa_kg_h: 0,
        temperatura_c: 0,
        densidad_kg_l: 0
      },
      textoCompleto: text,
      version_test: VERSION
    });

  } catch (error: any) {
    console.error("Error OCR Tesseract:", error.message);
    return NextResponse.json({ 
      error: "FALLO_OCR_GRATUITO", 
      debug: error.message,
      version_test: VERSION 
    }, { status: 500 });
  }
}