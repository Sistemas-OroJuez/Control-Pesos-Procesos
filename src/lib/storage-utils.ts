import { supabase } from '@/lib/supabase';

export async function subirImagen(archivo: File | Blob, nombreRuta: string) {
  // Generar nombre único
  const fileName = `batches/${Date.now()}_${nombreRuta}.jpg`;

  // Subir el Blob/File directamente
  const { data, error } = await supabase.storage
    .from('evidencias')
    .upload(fileName, archivo, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('evidencias')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}