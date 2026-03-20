import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import path from 'path';

const client = new ImageAnnotatorClient({
  keyFilename: path.join(process.cwd(), 'src/lib/google-key.json'),
});

export async function POST(request: Request) {
  try {
    const { fotoUrl } = await request.json();
    const [result] = await client.textDetection(fotoUrl);
    const fullText = result.textAnnotations ? result.textAnnotations[0].description : '';

    if (!fullText) throw new Error('No se detectó texto');

    // Lógica para extraer los 4 valores específicos del flujómetro
    const extraer = (regex: RegExp) => {
      const match = fullText.match(regex);
      return match ? parseFloat(match[1].replace(',', '.')) : 0;
    };

    const respuesta = {
      // Priorizamos la sumatoria (el número más largo que suele estar abajo)
      valorPrincipal: extraer(/∑\s?1?\s?(\d+[\d\s]*)/) || extraer(/(\d{6,8})/), 
      metadatosAdicionales: {
        masa_kg_h: extraer(/ṁ\s?(\d+[.,]\d+)/),
        temperatura_c: extraer(/🌡\s?1?\s?(\d+[.,]\d+)/),
        densidad_kg_l: extraer(/ρ\s?(\d+[.,]\d+)/)
      }
    };

    return NextResponse.json(respuesta);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}