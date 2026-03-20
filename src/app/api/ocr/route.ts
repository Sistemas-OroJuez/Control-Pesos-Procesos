import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export async function POST(request: Request) {
  try {
    const { fotoUrl } = await request.json();
    const envKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!envKey) throw new Error("Vercel no detecta la variable GOOGLE_SERVICE_ACCOUNT_JSON");

    // Intentar parsear y limpiar la llave privada
    let credentials;
    try {
      credentials = JSON.parse(envKey);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (e) {
      throw new Error("El JSON de la variable en Vercel está mal formateado");
    }

    const client = new ImageAnnotatorClient({ credentials });

    // Pedir lectura a Google
    const [result] = await client.textDetection(fotoUrl);
    
    // Si Google responde con un error específico (ej. cuota, red)
    if (result.error) {
      throw new Error(`Google Cloud dice: ${result.error.message}`);
    }

    const text = result.textAnnotations?.[0]?.description || '';
    if (!text) throw new Error("No se detectó texto en la imagen. Intenta una foto más clara.");

    // Extraer datos (Sumatoria de 7-8 dígitos)
    const extraerNum = (reg: RegExp) => {
      const m = text.match(reg);
      return m ? parseFloat(m[1].replace(/\s/g, '').replace(',', '.')) : 0;
    };

    const sumatoria = text.match(/(\d{7,8})/) ? parseFloat(text.match(/(\d{7,8})/)![1]) : 0;

    return NextResponse.json({
      valorPrincipal: sumatoria,
      metadatosAdicionales: {
        masa_kg_h: extraerNum(/ṁ\s?(\d+[.,]\d+)/),
        temperatura_c: extraerNum(/🌡\s?(\d+[.,]\d+)/),
        densidad_kg_l: extraerNum(/ρ\s?(\d+[.,]\d+)/)
      }
    });

  } catch (error: any) {
    // ESTE MENSAJE ES EL QUE NECESITO QUE ME DIGAS SI FALLA
    console.error("DEBUG OCR:", error.message);
    return NextResponse.json({ 
      error: "Error en el motor de lectura OCR", 
      debug: error.message 
    }, { status: 500 });
  }
}