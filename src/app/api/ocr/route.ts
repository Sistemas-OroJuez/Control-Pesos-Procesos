import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Función para inicializar el cliente con limpieza de llave para Vercel
const getVisionClient = () => {
  const envKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (envKey) {
    try {
      // 1. Parseamos el JSON que pegaste en Vercel
      const credentials = JSON.parse(envKey);
      
      // 2. REPARACIÓN CRÍTICA: Convertimos los \n de texto en saltos de línea reales
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      
      return new ImageAnnotatorClient({ credentials });
    } catch (err) {
      console.error("Error al configurar credenciales de Google:", err);
    }
  }

  // Si falla o no hay variable, intenta usar el archivo local (solo desarrollo)
  return new ImageAnnotatorClient({ keyFilename: './src/lib/google-key.json' });
};

// Instanciamos el cliente
const client = getVisionClient();

export async function POST(request: Request) {
  try {
    const { fotoUrl } = await request.json();

    if (!fotoUrl) {
      return NextResponse.json({ error: "No se proporcionó la URL de la foto" }, { status: 400 });
    }

    // Ejecutar detección de texto
    const [result] = await client.textDetection(fotoUrl);
    const detections = result.textAnnotations;
    const fullText = detections && detections.length > 0 ? detections[0].description : '';

    if (!fullText) {
      return NextResponse.json({ error: "No se detectó texto en la imagen" }, { status: 422 });
    }

    // Función auxiliar para extraer números con Regex
    const extraerNumero = (regex: RegExp) => {
      const match = fullText.match(regex);
      if (match) {
        // Limpiamos espacios y cambiamos coma por punto para el parseFloat
        return parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
      }
      return 0;
    };

    // LÓGICA DE EXTRACCIÓN ESPECÍFICA PARA TU FLUJÓMETRO
    // 1. Buscamos la sumatoria ∑1 (o el número de 7-8 dígitos)
    let sumatoria = extraerNumero(/∑\s?1?\s?(\d+[\d\s]*)/);
    if (sumatoria === 0) {
      const largoMatch = fullText.match(/(\d{7,8})/);
      sumatoria = largoMatch ? parseFloat(largoMatch[1]) : 0;
    }

    // 2. Extraemos los metadatos adicionales
    const masa = extraerNumero(/ṁ\s?(\d+[.,]\d+)/) || extraerNumero(/(\d+[.,]\d+)\s?kg\/h/);
    const temp = extraerNumero(/🌡\s?1?\s?(\d+[.,]\d+)/) || extraerNumero(/(\d+[.,]\d+)\s?°C/);
    const dens = extraerNumero(/ρ\s?(\d+[.,]\d+)/) || extraerNumero(/(\d+[.,]\d+)\s?kg\/L/);

    return NextResponse.json({
      valorPrincipal: sumatoria,
      metadatosAdicionales: {
        masa_kg_h: masa,
        temperatura_c: temp,
        densidad_kg_l: dens
      }
    });

  } catch (error: any) {
    console.error("DETALLE ERROR OCR:", error);
    return NextResponse.json({ 
      error: "Error en el motor OCR", 
      details: error.message 
    }, { status: 500 });
  }
}