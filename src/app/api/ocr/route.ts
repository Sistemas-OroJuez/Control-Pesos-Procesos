import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Función para inicializar el cliente de forma segura
const createVisionClient = () => {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (jsonEnv) {
    try {
      const credentials = JSON.parse(jsonEnv);
      // Limpieza de saltos de línea en la llave privada (Crucial para Vercel)
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      return new ImageAnnotatorClient({ credentials });
    } catch (error) {
      console.error("Error al parsear GOOGLE_SERVICE_ACCOUNT_JSON:", error);
    }
  }
  
  // Si no hay variable, intenta usar el archivo local (para desarrollo)
  return new ImageAnnotatorClient({ keyFilename: './src/lib/google-key.json' });
};

const client = createVisionClient();

export async function POST(request: Request) {
  try {
    const { fotoUrl } = await request.json();
    const [result] = await client.textDetection(fotoUrl);
    const fullText = result.textAnnotations?.[0]?.description || '';

    // Extraer valores con Regex
    const extraer = (regex: RegExp) => {
      const match = fullText.match(regex);
      return match ? parseFloat(match[1].replace(',', '.')) : 0;
    };

    // Buscamos la sumatoria (el número más largo o el que tiene ∑)
    let sumatoria = extraer(/∑\s?1?\s?(\d+)/);
    if (sumatoria === 0) {
      const matchLargo = fullText.match(/(\d{7,8})/);
      sumatoria = matchLargo ? parseFloat(matchLargo[1]) : 0;
    }

    return NextResponse.json({
      valorPrincipal: sumatoria,
      metadatosAdicionales: {
        masa_kg_h: extraer(/ṁ\s?(\d+[.,]\d+)/),
        temperatura_c: extraer(/🌡\s?1?\s?(\d+[.,]\d+)/),
        densidad_kg_l: extraer(/ρ\s?(\d+[.,]\d+)/)
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error en OCR: ' + error.message }, { status: 500 });
  }
}