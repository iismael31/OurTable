# OurTable

Web app (PWA) para que una pareja guarde y comparta sus valoraciones de restaurantes: fotos, estrellas, platos, bebida, opinión, ubicación en Google Maps y enlaces (web, Instagram, TikTok...). Incluye una lista de sitios pendientes de visitar. Funciona en iPhone y Android desde el navegador y se puede instalar en la pantalla de inicio. Tema claro, oscuro y automático.

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

### 2. Google Maps (mapas y búsqueda de sitios), gratis con límites
Google exige una cuenta de facturación con tarjeta aunque el uso sea gratuito (10.000 usos/mes por API básica, 5.000 en Places Pro). Los límites diarios de abajo hacen imposible superar el gratuito.
1. En https://console.cloud.google.com crea un proyecto (p. ej. `OurTable`) y asocia una cuenta de facturación.
2. **APIs y servicios → Biblioteca**: habilita **Maps JavaScript API**, **Geocoding API** y **Places API (New)**.
3. **Google Maps Platform → Claves y credenciales → Crear credenciales → Clave de API**. Edita la clave:
   - *Restricciones de aplicación*: **Sitios web** → añade `https://iismael31.github.io/*`. (Para probar los mapas en local habría que añadir también `http://127.0.0.1:8765/*`; la clave actual solo admite GitHub Pages.)
   - *Restricciones de API*: **Restringir clave** → marca solo las tres APIs anteriores.
4. **Google Maps Platform → Cuotas**: pon límites **por día**: Maps JavaScript API *Map loads* = 300; Geocoding *v3 requests* = 100; Places API (New) *SearchTextRequest* = 100, *GetPlaceRequest* = 30 (devuelve la web del restaurante, tarifa Enterprise con 1.000 gratis/mes) y *GetPhotoMediaRequest* = 100. (300 × 31 = 9.300 < 10.000 gratis; 30 × 31 = 930 < 1.000.)
5. **Facturación → Presupuestos y alertas**: crea un presupuesto de 1 € con aviso por email (informativo).
6. La clave **no se escribe en el código**: guárdala en GitHub como secreto `GOOGLE_MAPS_API_KEY` (paso 3). El flujo de publicación la inserta en `js/config.js` al desplegar.

### 3. GitHub Pages (publicación)
1. Crea un repositorio público en GitHub y sube esta carpeta.
2. En **Settings → Secrets and variables → Actions**, añade los secretos `GOOGLE_MAPS_API_KEY` (la clave de Google Maps), `SUPABASE_URL` y `SUPABASE_ANON_KEY` (los dos últimos sirven para la tarea que evita que el proyecto gratuito de Supabase se pause).
3. En **Settings → Pages → Source**, elige **GitHub Actions**. Cada `git push` a `main` ejecuta `.github/workflows/deploy-pages.yml`, que inserta la clave y publica en `https://TU_USUARIO.github.io/NOMBRE_REPO/`.
4. Vuelve a Supabase → **Authentication → URL Configuration** y pon la URL de GitHub Pages como **Site URL** y en **Redirect URLs** (necesario para el enlace de "olvidé mi contraseña").

### 4. En los móviles
Abre la URL en Safari (iPhone) o Chrome (Android), inicia sesión y usa **Añadir a pantalla de inicio**. Los pasos exactos están en la pantalla de Ajustes de la app y en la guía de uso.

## Desarrollo local
No hace falta instalar nada: basta un servidor estático.
```bash
python3 -m http.server 8765 --bind 127.0.0.1
```
y abrir http://127.0.0.1:8765/. Sin claves en `js/config.js`, la app muestra una pantalla de configuración pendiente.
