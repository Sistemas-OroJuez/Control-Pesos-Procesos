import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Configuración dinámica: Lee de la variable de entorno en la nube o del archivo en local
const clientOptions = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  ? { credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) }
  : { keyFilename: './src/lib/google-key.json' };

const client = new ImageAnnotatorClient(clientOptions);

export async function POST(request: Request) {
  try {
    const { fotoUrl } = await request.json();
    const [result] = await client.textDetection(fotoUrl);
    const fullText = result.textAnnotations?.[0]?.description || '';

    console.log("Texto detectado por Google:", fullText); // Para debug en logs

    const extraer = (regex: RegExp) => {
      const match = fullText.match(regex);
      return match ? parseFloat(match[1].replace(',', '.')) : 0;
    };

    // Lógica mejorada para la Sumatoria (∑1)
    // Busca el símbolo ∑ seguido de números, o un número de 7 u 8 dígitos (el totalizador)
    let sumatoria = extraer(/∑\s?1?\s?(\d+)/);
    if (sumatoria === 0) {
      const matchLargo = fullText.match(/(\d{7,8})/); // Busca un número largo de 7-8 dígitos
      sumatoria = matchLargo ? parseFloat(matchLargo[1]) : 0;
    }

    const respuesta = {
      valorPrincipal: sumatoria,
      metadatosAdicionales: {
        masa_kg_h: extraer(/ṁ\s?(\d+[.,]\d+)/) || extraer(/(\d+[.,]\d+)\s?kg\/h/),
        temperatura_c: extraer(/🌡\s?1?\s?(\d+[.,]\d+)/) || extraer(/(\d+[.,]\d+)\s?°C/),
        densidad_kg_l: extraer(/ρ\s?(\d+[.,]\d+)/) || extraer(/(\d+[.,]\d+)\s?kg\/L/)
      }
    };

    return NextResponse.json(respuesta);
  } catch (error: any) {
    console.error("Error OCR:", error.message);
    return NextResponse.json({ error: "Error en el motor de lectura OCR: " + error.message }, { status: 500 });
  }
}