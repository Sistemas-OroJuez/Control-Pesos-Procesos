import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const VERSION = "REINTENTO_FINAL_V7"; 

  try {
    const { fotoUrl } = await request.json();
    
    // Usamos la variable con prefijo NEXT_PUBLIC que es más persistente en Vercel
    const key = process.env.NEXT_PUBLIC_GCP_KEY;

    if (!key) {
      // Si sigue fallando, mostramos qué variables hay para ver el error de Vercel
      const debugKeys = Object.keys(process.env).filter(k => k.includes('NEXT_PUBLIC')).join(', ');
      return NextResponse.json({ 
        error: "NO_HAY_VARIABLE", 
        debug: `Vercel no inyectó NEXT_PUBLIC_GCP_KEY. Veo estas: ${debugKeys}`,
        version_test: VERSION 
      }, { status: 500 });
    }

    const credentials = JSON.parse(key);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const client = new ImageAnnotatorClient({ credentials });
    const [result] = await client.textDetection(fotoUrl);

    if (result.error) throw new Error(result.error.message);

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
      error: "FALLO_EN_EJECUCION", 
      debug: error.message,
      version_test: VERSION 
    }, { status: 500 });
  }
}