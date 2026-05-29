import { supabase } from '@/lib/supabase'; // Usando tu importación actual

export async function subirImagen(archivo: File, nombreRuta: string) {
  // 1. Nombre único para el archivo físico
  const fileName = `batches/${Date.now()}_${nombreRuta}.jpg`;

  // 2. Subida al Bucket "evidencias" (El que ya creaste)
  const { data, error } = await supabase.storage
    .from('evidencias')
    .upload(fileName, archivo);

  if (error) throw error;

  // 3. Obtener la URL pública (Lo que pesará KB en tu tabla)
  const { data: urlData } = supabase.storage
    .from('evidencias')
    .getPublicUrl(data.path);

  return urlData.publicUrl; 
}
