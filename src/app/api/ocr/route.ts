import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Forzamos que la ruta sea dinámica para que lea las variables frescas
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const VERSION = "SOLUCION_DEFINITIVA_V6"; 

  try {
    const { fotoUrl } = await request.json();
    
    // Intentamos obtener la llave de la forma más directa posible
    const key = process.env.GCP_SERVICE_ACCOUNT || process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!key) {
      return NextResponse.json({ 
        error: "LLAVE_NO_ENCONTRADA", 
        debug: "Vercel no está pasando la variable al servidor. Revisa los Scopes en Settings.",
        version_test: VERSION 
      }, { status: 500 });
    }

    const credentials = JSON.parse(key);
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

    const client = new ImageAnnotatorClient({ credentials });
    const [result] = await client.textDetection(fotoUrl);

    if (result.error) throw new Error(result.error.message);

    const text = result.textAnnotations?.[0]?.description || '';
    const sumatoria = text.match(/(\d{7,8})/) ? parseFloat(text.match(/(\d{7,8})/)![1]) : 0;

    return NextResponse.json({
      valorPrincipal: sumatoria,
      metadatosAdicionales: {
        masa_kg_h: 0, // Simplificado para que no falle por regex
        temperatura_c: 0,
        densidad_kg_l: 0
      },
      version_test: VERSION
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: "ERROR_OPERATIVO_OCR", 
      debug: error.message,
      version_test: VERSION 
    }, { status: 500 });
  }
}