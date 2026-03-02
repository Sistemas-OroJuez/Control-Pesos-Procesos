import { createClient } from '@supabase/supabase-js';

// Inicializamos el cliente aquí o lo importamos si ya lo tienes en otro archivo
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Sube una imagen comprimida al Bucket de Supabase 
 * y retorna la URL pública (Texto corto para la DB).
 */
export async function subirImagen(archivo: File, nombreRuta: string) {
  try {
    // 1. Generar un nombre único para el archivo físico en el Bucket
    // Ejemplo: batches/1712345678_visor_cero.jpg
    const fileName = `batches/${Date.now()}_${nombreRuta}.jpg`;

    // 2. Subida del archivo físico al Bucket "evidencias"
    const { data, error } = await supabase.storage
      .from('evidencias')
      .upload(fileName, archivo, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Error al subir al bucket: ${error.message}`);
    }

    // 3. Obtener la URL pública (Esto es lo que guardaremos en la tabla)
    const { data: urlData } = supabase.storage
      .from('evidencias')
      .getPublicUrl(data.path);

    // Retornamos el link de texto (pesa pocos Bytes)
    return urlData.publicUrl;

  } catch (error) {
    console.error("Error en storage-utils:", error);
    throw error;
  }
}