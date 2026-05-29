import { supabase } from '@/lib/supabase';

// Recibe un Blob (la imagen ya comprimida) directamente
export async function subirImagen(blob: Blob, nombreRuta: string) {
  const fileName = `batches/${Date.now()}_${nombreRuta}.jpg`;

  const { data, error } = await supabase.storage
    .from('evidencias')
    .upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('evidencias')
    .getPublicUrl(data.path);

  return urlData.publicUrl; 
}