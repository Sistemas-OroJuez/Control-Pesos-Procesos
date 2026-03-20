import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export async function POST(request: Request) {
  // --- TEST DE ACTUALIZACIÓN ---
  const VERSION = "VERSIÓN_EXTREMA_1"; 
  // -----------------------------

  try {
    const { fotoUrl } = await request.json();
    const envKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!envKey) {
      return NextResponse.json({ 
        error: "ERROR_SISTEMA", 
        debug: "La variable no existe en Vercel",
        version_test: VERSION 
      }, { status: 500 });
    }

    const credentials = JSON.parse(envKey);
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

    const client = new ImageAnnotatorClient({ credentials });
    const [result] = await client.textDetection(fotoUrl);

    if (result.error) {
      return NextResponse.json({ 
        error: "ERROR_GOOGLE", 
        debug: result.error.message,
        version_test: VERSION 
      }, { status: 500 });
    }

    return NextResponse.json({
      mensaje: "Si ves esto, el OCR funcionó",
      version_test: VERSION,
      texto: result.textAnnotations?.[0]?.description || "Sin texto"
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: "FALLO_CRITICO", 
      debug: error.message,
      version_test: VERSION 
    }, { status: 500 });
  }
}