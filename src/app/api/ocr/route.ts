import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const VERSION = "OPERACION_BASE64_V13"; 

  try {
    const { fotoUrl } = await request.json();
    let keyRaw = process.env.NEXT_PUBLIC_GCP_KEY || "";

    if (!keyRaw) throw new Error("Variable NEXT_PUBLIC_GCP_KEY vacía");

    // Si la llave no parece un JSON (no empieza con {), es Base64 y la decodificamos
    if (!keyRaw.trim().startsWith('{')) {
      keyRaw = Buffer.from(keyRaw, 'base64').toString('utf-8');
    }

    const credentials = JSON.parse(keyRaw);

    // Limpieza de seguridad por si acaso
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const client = new ImageAnnotatorClient({ credentials });

    const [result] = await client.textDetection(fotoUrl);
    if (result.error) throw new Error(`Google Cloud: ${result.error.message}`);

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
      error: "FALLO_AUTENTICACION_TOTAL", 
      debug: error.message,
      version_test: VERSION 
    }, { status: 500 });
  }
}