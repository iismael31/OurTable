import { $, html, mount, esc, toast } from '../dom.js';
import { createMap, pin, getPosition, DEFAULT_CENTER } from '../map.js';

export async function mapView(ctx) {
  ctx.setTopbar('');
  ctx.main.classList.add('view-full');
  mount(ctx.main, html`
    <div class="map-full">
      <div id="map" class="map" role="application" aria-label="Mapa de restaurantes"></div>
      <button type="button" class="btn-icon map-fab" id="locate" aria-label="Centrar en mi ubicación">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>
      </button>
    </div>
  `);

  let map = null;
  let L = null;
  let layer = null;
  let me = null;

  function paintMarkers() {
    if (!map) return;
    layer?.remove();
    layer = L.layerGroup().addTo(map);
    const points = [];
    for (const r of ctx.state.restaurants) {
      if (r.lat == null || r.lng == null) continue;
      const s = ctx.state.summaries.get(r.id);
      const color = r.want_to_go ? '#7048e8' : s.count ? (s.avg >= 4 ? '#2f9e6a' : s.avg >= 3 ? '#f5a524' : '#d64545') : '#8a8a8a';
      const summary = r.want_to_go ? '📌 Pendiente de visitar' : s.count ? `★ ${s.avg.toFixed(1).replace('.', ',')} · ${s.count} ${s.count === 1 ? 'visita' : 'visitas'}` : 'Sin valorar';
      pin(L, [r.lat, r.lng], { color }).addTo(layer)
        .bindPopup(`<a href="#/r/${esc(r.id)}">${esc(r.name)}</a><br>${esc(r.cuisine || '')}${r.cuisine ? '<br>' : ''}${esc(summary)}`);
      points.push([r.lat, r.lng]);
    }
    return points;
  }

  try {
    ({ L, map } = await createMap($('#map', ctx.main), { center: DEFAULT_CENTER, zoom: 6 }));
    const points = paintMarkers();
    if (points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  $('#locate', ctx.main).addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      const p = await getPosition();
      me?.remove();
      me = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#2b7fff', fillOpacity: 1 }).addTo(map);
      map.setView([p.lat, p.lng], 14);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      e.currentTarget.disabled = false;
    }
  });

  return {
    refresh: paintMarkers,
    destroy: () => { map?.remove(); ctx.main.classList.remove('view-full'); },
  };
}
