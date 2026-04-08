import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const VERSION = "FIX_AUTH_V14"; 

  try {
    const { fotoUrl } = await request.json();

    // 1. Construimos el objeto de credenciales usando las variables individuales de Vercel
    const credentials = {
      project_id: process.env.GOOGLE_PROJECT_ID,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      // El replace es vital para que Google reconozca los saltos de línea
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    // Validación rápida antes de llamar a Google
    if (!credentials.private_key || !credentials.client_email) {
      throw new Error("Faltan variables de entorno en Vercel (Email o Key)");
    }

    // 2. Inicializamos el cliente con el objeto construido
    const client = new ImageAnnotatorClient({ credentials });

    const [result] = await client.textDetection(fotoUrl);
    
    if (result.error) {
      throw new Error(`Google Cloud Vision Error: ${result.error.message}`);
    }

    const text = result.textAnnotations?.[0]?.description || '';
    
    // Tu lógica de extracción actual
    const sumatoriaMatch = text.match(/(\d{7,8})/);
    const sumatoria = sumatoriaMatch ? parseFloat(sumatoriaMatch[1]) : 0;

    return NextResponse.json({
      valorPrincipal: sumatoria,
      metadatosAdicionales: {
        masa_kg_h: 0, // Aquí podrías añadir la lógica para extraer los otros datos
        temperatura_c: 0,
        densidad_kg_l: 0
      },
      textoCompleto: text,
      version_test: VERSION
    });

  } catch (error: any) {
    console.error("Error en OCR:", error.message);
    return NextResponse.json({ 
      error: "FALLO_AUTENTICACION_VERSION_14", 
      debug: error.message,
      version_test: VERSION 
    }, { status: 500 });
  }
}