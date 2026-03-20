import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export async function POST(request: Request) {
  try {
    const { fotoUrl } = await request.json();
    
    // VALIDACIÓN 1: ¿Existe la variable?
    const envKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!envKey) {
      return NextResponse.json({ error: "Configuración ausente", debug: "La variable GOOGLE_SERVICE_ACCOUNT_JSON no existe en Vercel." }, { status: 500 });
    }

    // VALIDACIÓN 2: Limpieza de la llave
    let credentials;
    try {
      credentials = JSON.parse(envKey);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (e) {
      return NextResponse.json({ error: "Error de formato", debug: "El JSON en Vercel tiene un error de sintaxis (comas o llaves mal puestas)." }, { status: 500 });
    }

    // INSTANCIA DEL CLIENTE
    const client = new ImageAnnotatorClient({ credentials });

    // PETICIÓN A GOOGLE
    const [result] = await client.textDetection(fotoUrl);
    
    // ERROR DIRECTO DE GOOGLE
    if (result.error) {
      return NextResponse.json({ error: "Google rechazó la petición", debug: result.error.message }, { status: 500 });
    }

    const text = result.textAnnotations?.[0]?.description || '';
    if (!text) {
      return NextResponse.json({ error: "Imagen ilegible", debug: "Google no encontró texto en la foto." }, { status: 422 });
    }

    // EXTRACCIÓN SIMPLE (Para probar que funcione)
    const sumatoriaMatch = text.match(/(\d{7,8})/);
    const sumatoria = sumatoriaMatch ? parseFloat(sumatoriaMatch[1]) : 0;

    return NextResponse.json({
      valorPrincipal: sumatoria,
      textoCompleto: text // Esto nos servirá para ver qué está leyendo realmente
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: "Fallo crítico en el motor", 
      debug: error.message 
    }, { status: 500 });
  }
}