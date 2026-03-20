import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export async function POST(request: Request) {
  // CAMBIA ESTO A VERSIÓN 3 PARA ESTAR SEGUROS
  const VERSION = "VERSIÓN_EXTREMA_3"; 

  try {
    const { fotoUrl } = await request.json();
    
    // Intentamos leer la variable de 3 formas distintas
    const envKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || 
                   process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_JSON ||
                   "NO_EXISTE";

    if (envKey === "NO_EXISTE") {
      // Si llegamos aquí, Vercel realmente no nos está dando la variable
      return NextResponse.json({ 
        error: "ERROR_DE_ENTORNO_VERCEL", 
        debug: `La variable no está inyectada. Nombres detectados: ${Object.keys(process.env).filter(k => k.includes('GOOGLE')).join(', ')}`,
        version_test: VERSION 
      }, { status: 500 });
    }

    const credentials = JSON.parse(envKey);
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

    const client = new ImageAnnotatorClient({ credentials });
    const [result] = await client.textDetection(fotoUrl);

    if (result.error) throw new Error(result.error.message);

    const text = result.textAnnotations?.[0]?.description || '';
    return NextResponse.json({
      valorPrincipal: text.match(/(\d{7,8})/) ? parseFloat(text.match(/(\d{7,8})/)![1]) : 0,
      version_test: VERSION
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: "FALLO_MOTOR_OCR", 
      debug: error.message,
      version_test: VERSION 
    }, { status: 500 });
  }
}