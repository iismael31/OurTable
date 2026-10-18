# TO-DO — Sugerencias y pendientes

> Sugerencias y mejoras propuestas durante el desarrollo, además de los pendientes acordados.
> Prioridad: 🔴 alta · 🟡 media · 🟢 baja
> Categorías: seguridad · optimización · limpieza · funcionalidad · documentación

## Pendientes

- [ ] 🔴 [funcionalidad] Reactivar Google Maps cuando Google Cloud restablezca el proyecto `OurTable`: revertir el commit de vuelta a OpenStreetMap, comprobar clave y cuotas, subir versión.
      Justificación: el usuario prefiere Google Maps y la búsqueda de restaurantes por nombre; la implementación ya existe en el historial (3d409e6).


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

- [x] 2026-10-17 — Secretos del keep-alive configurados; primera ejecución correcta (GitHub Actions, 15:16 UTC).
- [x] 2026-10-17 — App instalada y probada en los dos iPhones con el proyecto Supabase real.

- [x] 2026-10-17 — Publicada en GitHub Pages: https://iismael31.github.io/OurTable/ (repositorio público iismael31/OurTable, rama main).

- [x] 2026-10-17 — Proyecto Supabase creado: esquema ejecutado, registro público desactivado, cuentas creadas, claves en `js/config.js`. Prueba real de login y valoración con foto correcta.

- [x] 2026-10-17 — Plan de acción, estructura, esquema SQL con RLS, interfaz completa (lista, mapa, detalle, formulario, resumen, ajustes), temas, PWA, documentación.
- [x] 2026-10-17 — Lista de sitios pendientes de visitar (con notas) y enlaces en cualquier restaurante.

