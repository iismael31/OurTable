# OurTable

Web app (PWA) para que una pareja guarde y comparta sus valoraciones de restaurantes: fotos, estrellas, platos, bebida, opinión, ubicación y enlaces (web, Instagram, TikTok...). Incluye una lista de sitios pendientes de visitar. Funciona en iPhone y Android desde el navegador y se puede instalar en la pantalla de inicio. Tema claro, oscuro y automático.

- **Guía para usarla (sin tecnicismos):** [GUIA-DE-USO.md](GUIA-DE-USO.md)
- **Documentación técnica:** [DOCUMENTACION-TECNICA.md](DOCUMENTACION-TECNICA.md)
- **Pendientes y mejoras propuestas:** [to-do.md](to-do.md) · **Diario de trabajo:** [work.log](work.log)

## Puesta en marcha (una sola vez, unos 20 minutos)

### 1. Supabase (datos, cuentas y fotos)
1. Crea una cuenta gratuita en https://supabase.com y un proyecto nuevo (región **West EU**). Guarda la contraseña de la base de datos en un lugar seguro.
2. En **SQL Editor → New query**, pega el contenido completo de `supabase/schema.sql` y pulsa **Run**.
3. En **Authentication → Providers → Email**, desactiva **Allow new users to sign up** y guarda.
4. En **Authentication → Users → Add user → Create new user**, crea las dos cuentas (email + contraseña) marcando **Auto Confirm User**.
5. En **Project Settings → Data API** copia la **Project URL**, y en **Project Settings → API Keys** la **Publishable key** (`sb_publishable_...`). Nunca uses las *Secret keys*.
6. Pega ambas en `js/config.js`:
   ```js
   export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'sb_publishable_...';
   ```
   La clave *publishable* (o la antigua *anon*) es pública por diseño; la seguridad la dan las reglas RLS del esquema.

### 2. GitHub Pages (publicación)
1. Crea un repositorio en GitHub (puede ser privado) y sube esta carpeta.
2. En **Settings → Pages**, elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`. En un minuto tendrás una URL del tipo `https://TU_USUARIO.github.io/NOMBRE_REPO/`.
3. En **Settings → Secrets and variables → Actions**, añade los secretos `SUPABASE_URL` y `SUPABASE_ANON_KEY` (mismos valores que en `js/config.js`). Sirven para la tarea automática que evita que el proyecto gratuito de Supabase se pause por inactividad.
4. Vuelve a Supabase → **Authentication → URL Configuration** y pon la URL de GitHub Pages como **Site URL** y en **Redirect URLs** (necesario para el enlace de "olvidé mi contraseña").

### 3. En los móviles
Abre la URL en Safari (iPhone) o Chrome (Android), inicia sesión y usa **Añadir a pantalla de inicio**. Los pasos exactos están en la pantalla de Ajustes de la app y en la guía de uso.

## Desarrollo local
No hace falta instalar nada: basta un servidor estático.
```bash
python3 -m http.server 8765 --bind 127.0.0.1
```
y abrir http://127.0.0.1:8765/. Sin claves en `js/config.js`, la app muestra una pantalla de configuración pendiente.
