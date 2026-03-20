import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Configuramos el cliente de forma dinámica
const clientOptions = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  ? { credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) }
  : { keyFilename: './src/lib/google-key.json' };

const client = new ImageAnnotatorClient(clientOptions);

export async function POST(request: Request) {
  try {
    const { fotoUrl } = await request.json();
    const [result] = await client.textDetection(fotoUrl);
    const fullText = result.textAnnotations?.[0]?.description || '';

    const extraer = (regex: RegExp) => {
      const match = fullText.match(regex);
      return match ? parseFloat(match[1].replace(',', '.')) : 0;
    };

    return NextResponse.json({
      valorPrincipal: extraer(/∑\s?1?\s?(\d+[\d\s]*)/) || extraer(/(\d{6,8})/),
      metadatosAdicionales: {
        masa_kg_h: extraer(/ṁ\s?(\d+[.,]\d+)/),
        temperatura_c: extraer(/🌡\s?1?\s?(\d+[.,]\d+)/),
        densidad_kg_l: extraer(/ρ\s?(\d+[.,]\d+)/)
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}