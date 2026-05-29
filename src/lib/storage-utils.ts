import { supabase } from '@/lib/supabase';
import imageCompression from 'browser-image-compression';

export async function subirImagen(archivo: File, nombreRuta: string) {
  // 1. FORZAMOS la compresión aquí mismo
  const options = {
    maxSizeMB: 0.3, // Máximo 300KB
    maxWidthOrHeight: 800,
    useWebWorker: true,
  };

  const archivoComprimido = await imageCompression(archivo, options);

  // 2. Generar nombre único
  const fileName = `batches/${Date.now()}_${nombreRuta}.jpg`;

  // 3. Subimos el archivo COMPRIMIDO
  const { data, error } = await supabase.storage
    .from('evidencias')
    .upload(fileName, archivoComprimido, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('evidencias')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}