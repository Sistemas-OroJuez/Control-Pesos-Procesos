import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tzllavurccjvhzrehyug.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bGxhdnVyY2Nqdmh6cmVoeXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDAzNTQsImV4cCI6MjA4Nzc3NjM1NH0.4QwByPX7EgGJewQ5Wao7Y2vothMzMjFUvRyFdS36nt4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)