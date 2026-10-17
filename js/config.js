// Configuración pública de la app.
// La clave pública de Supabase ("Publishable key", sb_publishable_..., o la
// antigua "anon" eyJ...) está pensada para ir en el navegador: NO es un secreto.
// La seguridad real la dan las reglas RLS de supabase/schema.sql.
// Nunca pongas aquí una "Secret key" ni la "service_role".
export const SUPABASE_URL = 'https://owjxhdnmnhfoiokkzesz.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_f71tEOw5zsXDDIK92O4wIA_cOrPTU8Q';
export const APP_VERSION = '1.0.0';
