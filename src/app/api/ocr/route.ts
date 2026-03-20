import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export async function POST(request: Request) {
  // SUBIMOS A VERSIÓN 5 PARA CONFIRMAR CAMBIO
  const VERSION = "VERSIÓN_FINAL_5"; 

  try {
    const { fotoUrl } = await request.json();
    
    // Intentamos leer cualquiera de las dos variables que configuraste
    const envKey = process.env.GCP_SERVICE_ACCOUNT || 
                   process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!envKey) {
      // Si llegamos aquí, listamos TODO lo que Vercel deja ver (filtro de seguridad)
      const llavesVistas = Object.keys(process.env).filter(k => !k.includes('AUTH') && !k.includes('PASSWORD')).join(', ');
      return NextResponse.json({ 
        error: "LLAVE_NO_ENCONTRADA", 
        debug: `Vercel no inyectó las variables. Solo veo estas: ${llavesVistas}`,
        version_test: VERSION 
      }, { status: 500 });
    }

    // Limpieza de la llave
    const credentials = JSON.parse(envKey);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const client = new ImageAnnotatorClient({ credentials });
    const [result] = await client.textDetection(fotoUrl);

    if (result.error) throw new Error(`Google responde: ${result.error.message}`);

    const text = result.textAnnotations?.[0]?.description || '';
    const sumatoriaMatch = text.match(/(\d{7,8})/);
    const sumatoria = sumatoriaMatch ? parseFloat(sumatoriaMatch[1]) : 0;

    return NextResponse.json({
      valorPrincipal: sumatoria,
      textoCompleto: text,
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