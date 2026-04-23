// app/api/ocr/route.ts
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { imageUrl } = await request.json();

    // Creamos el formulario que OCR Space necesita
    const formData = new FormData();
    formData.append('apikey', 'K82540315988957');
    formData.append('url', imageUrl);
    formData.append('language', 'eng');
    formData.append('OCREngine', '2');

    // El servidor hace la petición (aquí NO hay bloqueo de CORS)
    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });

    const data = await ocrRes.json();
    
    // Le devolvemos la respuesta de la IA a tu aplicación
    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}