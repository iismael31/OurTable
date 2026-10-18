# TO-DO — Sugerencias y pendientes

> Sugerencias y mejoras propuestas durante el desarrollo, además de los pendientes acordados.
> Prioridad: 🔴 alta · 🟡 media · 🟢 baja
> Categorías: seguridad · optimización · limpieza · funcionalidad · documentación

## Pendientes

- [ ] 🔴 [seguridad] Rotar la clave de Google Maps: crear una clave nueva en Google Cloud (mismas restricciones: sitio `https://iismael31.github.io/*` y las tres APIs), guardarla como secreto `GOOGLE_MAPS_API_KEY` en GitHub, cambiar *Settings → Pages → Source* a **GitHub Actions**, hacer push, y borrar en Google las dos claves anteriores (`AIzaSyCK...` y `AIzaSyBZ...`, que quedaron en el historial del repositorio). Cerrar las alertas de *Secret scanning* como "Revoked".
      Justificación: las claves antiguas están en commits públicos; aunque están restringidas por dominio y cuota, lo limpio es anularlas.



- [ ] 🟡 [seguridad] Borrar en Google Cloud la clave antigua `AIzaSyCK...` (suspendida y ya sustituida) en Google Maps Platform → Claves y credenciales.
      Justificación: una clave sin uso es superficie de riesgo innecesaria.



- [ ] 🟡 [seguridad] Configurar en Supabase la "Site URL" y "Redirect URLs" con `https://iismael31.github.io/OurTable/`.
      Justificación: necesario para que funcione el enlace de recuperación de contraseña.

- [ ] 🟡 [seguridad] Vendorizar las librerías externas (supabase-js, Leaflet) dentro de `js/vendor/` en lugar de cargarlas desde CDN.
      Justificación: elimina la dependencia de terceros en tiempo de ejecución y permite una CSP más estricta. Requiere permiso para descargar los archivos.

- [ ] 🟢 [limpieza] Limpiar fotos huérfanas del bucket cuando se borra un restaurante con valoraciones de la otra persona.
      Justificación: la app borra las fotos de la propia valoración, pero el borrado en cascada desde la base de datos no toca el almacenamiento.

- [ ] 🟢 [funcionalidad] Exportación de copia de seguridad (JSON + fotos) desde Ajustes.
      Justificación: tener los datos propios fuera de Supabase por si algún día se migra.

- [ ] 🟢 [seguridad] Revisar periódicamente las versiones fijadas de supabase-js (2.118.0) y Leaflet (1.9.4) y actualizarlas tras probar.
      Justificación: mantener parches de seguridad sin romper la app.

- [ ] 🟢 [funcionalidad] Previsualización de enlaces (favicon o miniatura) en la ficha del restaurante.
      Justificación: hoy se muestra solo la etiqueta; traer metadatos requeriría un proxy o función de servidor por CORS.

## Completados

- [x] 2026-10-18 — Columnas `place_id`/`cover_url` creadas en Supabase (comprobado por API) y cuotas GetPlaceRequest 30/día y GetPhotoMediaRequest 100/día ajustadas por el usuario.

- [x] 2026-10-18 — Google Cloud restableció el proyecto; Google Maps reactivado (v1.2.0).

- [x] 2026-10-17 — Secretos del keep-alive configurados; primera ejecución correcta (GitHub Actions, 15:16 UTC).
- [x] 2026-10-17 — App instalada y probada en los dos iPhones con el proyecto Supabase real.

- [x] 2026-10-17 — Publicada en GitHub Pages: https://iismael31.github.io/OurTable/ (repositorio público iismael31/OurTable, rama main).

- [x] 2026-10-17 — Proyecto Supabase creado: esquema ejecutado, registro público desactivado, cuentas creadas, claves en `js/config.js`. Prueba real de login y valoración con foto correcta.

- [x] 2026-10-17 — Plan de acción, estructura, esquema SQL con RLS, interfaz completa (lista, mapa, detalle, formulario, resumen, ajustes), temas, PWA, documentación.
- [x] 2026-10-17 — Lista de sitios pendientes de visitar (con notas) y enlaces en cualquier restaurante.

