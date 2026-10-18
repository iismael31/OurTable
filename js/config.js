// Configuración pública de la app.
// La clave pública de Supabase ("Publishable key", sb_publishable_..., o la
// antigua "anon" eyJ...) está pensada para ir en el navegador: NO es un secreto.
// La seguridad real la dan las reglas RLS de supabase/schema.sql.
// Nunca pongas aquí una "Secret key" ni la "service_role".
export const SUPABASE_URL = 'https://owjxhdnmnhfoiokkzesz.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_f71tEOw5zsXDDIK92O4wIA_cOrPTU8Q';
// Clave de Google Maps Platform: pública, pero restringida por dominio y con
// cuotas diarias en Google Cloud (ver README). Nunca uses una clave sin restringir.
export const GOOGLE_MAPS_API_KEY = 'AIzaSyBZr-Jvj1lUxTWnsTSLzWcfXon-KPAgFY8';
export const APP_VERSION = '1.4.0';
