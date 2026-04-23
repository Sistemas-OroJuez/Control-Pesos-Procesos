import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const imageUrl = body.imageUrl || body.url; // Acepta ambos nombres por si acaso

    if (!imageUrl) {
      return NextResponse.json({ error: "No se proporcionó la URL de la imagen" }, { status: 400 });
    }

    const formData = new FormData();
    formData.append('apikey', 'K82540315988957');
    formData.append('url', imageUrl);
    formData.append('language', 'eng');
    formData.append('OCREngine', '2');

    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    if (!ocrRes.ok) {
      const errorText = await ocrRes.text();
      return NextResponse.json({ error: `OCR Space respondió con error: ${errorText}` }, { status: ocrRes.status });
    }

    const data = await ocrRes.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Error en el túnel OCR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}