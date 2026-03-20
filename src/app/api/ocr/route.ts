import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const VERSION = "SOLUCION_LLAVE_V12"; 

  try {
    const { fotoUrl } = await request.json();
    
    // 1. Intentamos leer la llave
    const keyRaw = process.env.NEXT_PUBLIC_GCP_KEY;

    if (!keyRaw) {
      throw new Error("La variable NEXT_PUBLIC_GCP_KEY no existe en este proyecto de Vercel.");
    }

    // 2. Parsear el JSON
    const credentials = JSON.parse(keyRaw);

    // 3. REPARADOR CRÍTICO DE LLAVE (Corrige el Error 16)
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key
        .replace(/\\n/g, '\n') // Convierte el texto "\n" en saltos de línea reales
        .trim();
    }

    const client = new ImageAnnotatorClient({ 
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
        project_id: credentials.project_id
      }
    });

    // 4. Llamada a Google
    const [result] = await client.textDetection(fotoUrl);

    if (result.error) {
      throw new Error(`Google Cloud Error: ${result.error.message}`);
    }

    const text = result.textAnnotations?.[0]?.description || '';
    
    // Buscamos la sumatoria (7-8 dígitos)
    const sumatoriaMatch = text.match(/(\d{7,8})/);
    const sumatoria = sumatoriaMatch ? parseFloat(sumatoriaMatch[1]) : 0;

    return NextResponse.json({
      valorPrincipal: sumatoria,
      metadatosAdicionales: {
        masa_kg_h: 0,
        temperatura_c: 0,
        densidad_kg_l: 0
      },
      version_test: VERSION
    });

  } catch (error: any) {
    console.error("Error en OCR:", error.message);
    return NextResponse.json({ 
      error: "FALLO_EN_AUTENTICACION", 
      debug: error.message,
      version_test: VERSION 
    }, { status: 500 });
  }
}