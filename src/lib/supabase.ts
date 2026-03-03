import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validamos que existan las variables antes de crear el cliente
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Error: Variables de Supabase no detectadas.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);