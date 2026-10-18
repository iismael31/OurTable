# Documentación técnica — OurTable

## 1. Visión general
PWA para dos usuarios (pareja) que registran valoraciones de restaurantes con fotos, estrellas, platos, bebida, opinión y ubicación. Sin paso de compilación: HTML, CSS y módulos ES nativos servidos como estáticos (GitHub Pages). Backend como servicio: Supabase (Postgres + Auth + Storage + Realtime). Datos compartidos entre las dos cuentas con reglas de acceso en el servidor.

## 2. Stack tecnológico
| Capa | Tecnología | Versión | Notas |
|------|------------|---------|-------|
| Lenguaje | JavaScript (ES2022, módulos) | — | Sin transpilar ni empaquetar |
| UI | HTML5 + CSS (custom properties, `color-mix`) | — | Tema claro/oscuro por `data-theme` en `<html>` |
| Backend | Supabase (Postgres 15, PostgREST, GoTrue, Storage, Realtime) | supabase-js 2.118.0 | Cargado por ESM desde jsDelivr; versión fijada (soporta claves publishable) |
| Mapas | Google Maps Platform (Maps JavaScript API, Places API (New), Geocoding API) | `v=weekly` | Carga perezosa; clave pública restringida por dominio y con cuotas diarias |
| Hosting | GitHub Pages | — | Rutas relativas (funciona bajo subcarpeta) |
| Automatización | GitHub Actions | — | `keepalive.yml` cada 3 días |
| Dev local | `python3 -m http.server` | 3.9+ | Cualquier servidor estático sirve |

## 3. Arquitectura
```
 Móvil (Safari / Chrome, PWA)                       Supabase (proyecto propio)
 ┌─────────────────────────────┐   HTTPS / WSS      ┌───────────────────────────┐
 │ index.html + css + js/*.js  │ ─────────────────▶ │ Auth (email + contraseña) │
 │  app.js  router + estado    │   REST (PostgREST) │ Postgres: profiles,       │
 │  db.js   datos + storage    │ ◀────────────────  │   restaurants, reviews    │
 │  ui/*    vistas             │   Realtime         │   + RLS (deny by default) │
 │  sw.js   caché de la app    │                    │ Storage: bucket "photos"  │
 └─────────────────────────────┘                    └───────────────────────────┘
          │  mapas, búsqueda de sitios, geocodificación inversa
          ▼
   maps.googleapis.com · places.googleapis.com (Google Maps Platform)
```
- Un restaurante puede estar "pendiente de visitar" (`want_to_go`); la lista tiene dos modos (Visitados / Pendientes) y el mapa lo pinta en morado.
- `app.js` arranca la sesión, mantiene el estado en memoria (`profiles`, `restaurants`, `reviews` "ligeras" y `summaries` calculadas en cliente) y enruta por `location.hash`.
- Cada vista (`js/ui/*.js`) recibe un contexto `ctx` (estado, usuario, `navigate`, `reload`, `setTopbar`) y devuelve opcionalmente `{ refresh, destroy }`. Las vistas marcadas `live` se refrescan al llegar cambios por Realtime o al volver a primer plano.
- Realtime: canal `postgres_changes` sobre `restaurants` y `reviews` → recarga (con debounce de 350 ms) → `refresh()` de la vista actual.
- Fotos: comprimidas en cliente (`image.js`, 1600 px y miniatura 480 px, JPEG) → bucket privado → URLs firmadas (1 h) con caché en memoria.

## 4. Estructura del proyecto
```
index.html               Carcasa, CSP, metadatos PWA, diálogos (confirmación, lightbox)
manifest.webmanifest     Manifiesto PWA (start_url y scope relativos)
sw.js                    Service worker: precaché de la app, SWR para CDN, red para datos
css/styles.css           Tokens de tema y componentes
js/config.js             URL y clave anon de Supabase (públicas), versión
js/theme-init.js         Aplica el tema antes del primer pintado (script clásico)
js/theme.js              Preferencia claro/oscuro/sistema (localStorage)
js/dom.js                Plantillas HTML con escape automático, toasts, diálogos, estrellas, formato
js/supabase.js           Cliente Supabase (createClient) y flag isConfigured
js/auth.js               Sesión, login, logout, recuperación y cambio de contraseña
js/db.js                 Consultas, mutaciones, Storage (URLs firmadas) y suscripción Realtime
js/image.js              Compresión de fotos (canvas)
js/map.js                Carga perezosa de Google Maps, mapas (estilo oscuro), marcadores, Places Text Search, Place Details, geocodificación inversa, geolocalización
js/ui/login.js           Acceso y nueva contraseña (recuperación)
js/ui/list.js            Lista con búsqueda, orden y filtro
js/ui/detail.js          Ficha del restaurante, minimapa y valoraciones (editar/borrar propias)
js/ui/form.js            Alta/edición de valoración (restaurante, estrellas, platos, fotos)
js/ui/wish.js            Alta de un sitio pendiente de visitar (enlaces y notas)
js/ui/restaurant-fields.js  Campos de restaurante reutilizables (nombre, cocina, dirección, mapa, enlaces, notas)
js/ui/restaurant-form.js Edición/borrado del restaurante
js/ui/map-view.js        Mapa general con pines por nota
js/ui/stats.js           Resumen estadístico
js/ui/settings.js        Tema, perfil, contraseña, instalación, salir
assets/icons/            Icono PNG (192, 512, 512 maskable, apple-touch 180) a partir del diseño del usuario
supabase/schema.sql      Esquema completo e idempotente (tablas, RLS, realtime, bucket)
.github/workflows/keepalive.yml  Ping cada 3 días para evitar la pausa del plan gratuito
to-do.md · work.log      Seguimiento del proyecto
GUIA-DE-USO.md           Guía no técnica
```

## 5. Configuración y variables de entorno
| Variable | Dónde | Descripción | Obligatoria | Ejemplo (no secreto) |
|----------|-------|-------------|-------------|----------------------|
| `SUPABASE_URL` | `js/config.js` | URL del proyecto | Sí | `https://abcd1234.supabase.co` |
| `SUPABASE_ANON_KEY` | `js/config.js` | Clave pública *publishable* `sb_publishable_...` (o la antigua *anon* `eyJ...`) | Sí | `sb_publishable_abc...` |
| `GOOGLE_MAPS_API_KEY` | `js/config.js` | Clave de Google Maps Platform (pública, restringida por referrer y por API, con cuotas diarias) | Sí (mapas) | `AIza...` |
| `APP_VERSION` | `js/config.js` | Versión mostrada en Ajustes | No | `1.2.0` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Secretos de GitHub Actions | Para el keep-alive | Recomendado | — |
| `VERSION` | `sw.js` | Cambiarla invalida la caché de la app | — | `v1.0.1` |

> Las *Secret keys* y la clave *service_role* de Supabase NUNCA deben usarse en esta app ni subirse al repositorio.

## 6. Instalación y despliegue
**Requisitos:** cuenta Supabase (gratis), cuenta GitHub (gratis). No requiere Node.

**Local:** `python3 -m http.server 8765 --bind 127.0.0.1` y abrir `http://127.0.0.1:8765/`.

**Supabase:** ejecutar `supabase/schema.sql`; desactivar registro público; crear los dos usuarios con *Auto Confirm*; configurar *Site URL* / *Redirect URLs* con la URL de GitHub Pages.

**GitHub Pages:** subir el repositorio, *Settings → Pages → Deploy from a branch* (`main`, `/`). Añadir los secretos para `keepalive.yml`. Cada `git push` republica.

**Actualizaciones:** al cambiar archivos de la app, subir la `VERSION` de `sw.js` para que los clientes instalados refresquen la caché; la app se recarga sola al activarse la versión nueva (o avisa con un toast si hay un formulario abierto).

## 7. Modelo de datos / API
Acceso vía PostgREST (supabase-js). Tablas en `public`:

**profiles** — `id uuid PK → auth.users`, `display_name text(1–40)`, `color text (#rrggbb)`, `created_at`. Se crea por trigger al dar de alta un usuario. Ser miembro = tener perfil (`is_member()`).

**restaurants** — `id uuid`, `name text(1–120)`, `cuisine text(≤60)`, `address text(≤240)`, `lat/lng double` (ambos o ninguno), `want_to_go bool` (pendiente de visitar), `notes text(≤1000)`, `links jsonb` (array ≤10 de `{label, url}`; solo se renderizan URLs http/https tras pasar por `safeUrl`), `created_by → profiles`, `created_at`, `updated_at` (trigger). Trigger `reviews_mark_visited`: al insertar la primera valoración, `want_to_go` pasa a `false`.

**reviews** — `id uuid`, `restaurant_id → restaurants (cascade)`, `author_id → profiles`, `visit_date date`, `rating smallint 1–5` (obligatorio), `rating_food/service/ambience/value smallint 1–5`, `price_per_person numeric(7,2) 0–10000`, `dishes jsonb` (array ≤30 de `{name, rating}`), `drinks text(≤500)`, `comment text(≤4000)`, `would_return bool`, `photos jsonb` (array ≤12 de `{path, thumb, w, h}`), `created_at`, `updated_at`.

**Storage** — bucket privado `photos` (JPEG/WebP/PNG, ≤3 MB). Rutas `{user_id}/{uuid}.jpg` y `{user_id}/{uuid}_t.jpg`.

**Políticas RLS** (todas para rol `authenticated`, denegar por defecto):
| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | miembros | — (trigger) | solo el propio | — |
| restaurants | miembros | miembros (`created_by = uid`) | miembros | miembros |
| reviews | miembros | miembros (`author_id = uid`) | solo autor | solo autor |
| storage.objects (photos) | miembros | miembros | — | solo propietario |

Realtime: publicación `supabase_realtime` incluye `restaurants` y `reviews` (respeta RLS).

## 8. Seguridad implementada
- Sin secretos en el código: solo la clave *anon* (pública por diseño). `.gitignore` excluye `.env`, claves y certificados.
- Autorización en servidor con RLS en todas las tablas y en Storage; la UI solo oculta botones, el servidor decide.
- Registro público desactivado; cuentas creadas a mano. Recuperación de contraseña por enlace de un solo uso.
- Validación en base de datos (CHECK de longitudes, rangos, tipos JSON, tamaño de arrays) además de la validación de cliente.
- Escape automático de todo dato interpolado en plantillas (`html` tag en `dom.js`); nada de `innerHTML` con datos sin escapar.
- Enlaces de usuario: se normalizan y validan al guardar (`normalizeUrl`) y se vuelven a validar al mostrar (`safeUrl`, solo http/https), con `target=_blank rel="noopener noreferrer"`.
- CSP por `<meta>`: scripts solo propios + jsDelivr + Google Maps; conexiones solo a Supabase, jsDelivr y Google Maps/Places; `object-src 'none'`, `base-uri 'self'`.
- Clave de Google Maps restringida a los dominios de la app y a las tres APIs usadas, con cuotas diarias que impiden superar el tramo gratuito (y por tanto cualquier cargo).
- Fotos en bucket privado, servidas por URLs firmadas temporales; límite de tamaño y MIME en el bucket; compresión previa.
- Mensajes de error al usuario genéricos (`friendlyError`), sin trazas internas.
- Enlaces externos con `rel="noopener"`; `referrer` restringido.

## 9. Decisiones de optimización
- Resúmenes (media, nº visitas, última visita, portada) calculados en cliente a partir de una consulta "ligera" de reviews (sin `comment` ni `dishes`); evita una vista/RPC y N+1.
- Carga perezosa de Google Maps solo en vistas con mapa; cada `new google.maps.Map` cuenta como un *map load*, por eso el minimapa de la ficha es estático (sin gestos) y el mapa general reutiliza marcadores al refrescar.
- Fotos: dos tamaños (miniatura para listas, completa para el lightbox); URLs firmadas cacheadas en memoria y pedidas en lote.
- Service worker: precaché de la carcasa (abre al instante); todos los archivos, incluida la página, se sirven de la caché de la versión instalada para no mezclar versiones; la nueva se instala en segundo plano y la app se recarga sola al activarse (o avisa si hay un formulario abierto). Nunca cachea datos ni mapas.
- Realtime con debounce para agrupar ráfagas de cambios; recarga también al volver la app a primer plano.
- Sin framework ni build: ~2.600 líneas, cero dependencias de desarrollo, tiempo de carga mínimo.

## 10. Tests
No hay suite automatizada (no hay Node en el entorno de desarrollo). Verificación realizada manualmente en navegador con un *mock* en memoria del cliente Supabase (no incluido en el repo): acceso, lista/orden/filtros, detalle con minimapa, alta con restaurante nuevo (geocodificación real), estrellas, platos, foto comprimida, guardado y navegación, lightbox, edición de valoración propia, permisos de edición entre usuarios, mapa general, resumen, ajustes y cambio de tema; lista de pendientes, alta de pendiente con enlaces (normalización de URL) y paso automático a visitado al valorar.
Pendiente (ver `to-do.md`): pruebas end-to-end contra un proyecto Supabase real y en dispositivos iOS/Android.

## 11. Limitaciones conocidas y deuda técnica
- Plan gratuito de Supabase: 500 MB de BD, 1 GB de Storage, pausa tras 7 días sin actividad (mitigada con `keepalive.yml`).
- GitHub Pages no permite cabeceras HTTP: la CSP va en `<meta>` y no hay `frame-ancestors`/HSTS propios.
- supabase-js cargado desde CDN (versión fijada); Google Maps se carga necesariamente desde Google.
- El borrado en cascada de un restaurante no limpia fotos huérfanas en Storage (la UI solo permite borrar restaurantes sin valoraciones).
- Sin modo offline para escribir; sin notificaciones push.
- Resto en `to-do.md`.

## 12. Cómo contribuir
- Rama `main` = producción (GitHub Pages). Trabajar en ramas y hacer PR.
- Mantener `to-do.md` y `work.log` al día (regla: lo que se hace → work.log; lo que se propone → to-do.md).
- Cualquier dato que llegue a la interfaz pasa por la plantilla `html` de `dom.js`.
- Cambios de esquema: editar `supabase/schema.sql` de forma idempotente y volver a ejecutarlo.
- Al publicar cambios de la app, subir `VERSION` en `sw.js` y `APP_VERSION` en `js/config.js`.
