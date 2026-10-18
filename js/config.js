// Configuración pública de la app.
// La clave pública de Supabase ("Publishable key", sb_publishable_..., o la
// antigua "anon" eyJ...) está pensada para ir en el navegador: NO es un secreto.
// La seguridad real la dan las reglas RLS de supabase/schema.sql.
// Nunca pongas aquí una "Secret key" ni la "service_role".
export const SUPABASE_URL = 'https://owjxhdnmnhfoiokkzesz.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_f71tEOw5zsXDDIK92O4wIA_cOrPTU8Q';
// Clave de Google Maps Platform. NO se escribe aquí: el marcador se sustituye al
// publicar con el secreto GOOGLE_MAPS_API_KEY del repositorio (ver
// .github/workflows/deploy-pages.yml). La clave va restringida por dominio y
// con cuotas diarias en Google Cloud.
export const GOOGLE_MAPS_API_KEY = '__GOOGLE_MAPS_API_KEY__';
export const APP_VERSION = '1.4.0';
