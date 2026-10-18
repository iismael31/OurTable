import { $, html, mount, esc, toast } from '../dom.js';
import { createMap, pin, fitPoints, getPosition, DEFAULT_CENTER } from '../map.js';

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

  let gm = null;
  let map = null;
  let handle = null;
  let markers = [];
  let me = null;
  let info = null;

  function paintMarkers() {
    if (!map) return [];
    markers.forEach((m) => m.setMap(null));
    markers = [];
    const points = [];
    for (const r of ctx.state.restaurants) {
      if (r.lat == null || r.lng == null) continue;
      const s = ctx.state.summaries.get(r.id);
      const color = r.want_to_go ? '#7048e8' : s.count ? (s.avg >= 4 ? '#2f9e6a' : s.avg >= 3 ? '#f5a524' : '#d64545') : '#8a8a8a';
      const summary = r.want_to_go ? '📌 Pendiente de visitar' : s.count ? `★ ${s.avg.toFixed(1).replace('.', ',')} · ${s.count} ${s.count === 1 ? 'visita' : 'visitas'}` : 'Sin valorar';
      const position = { lat: r.lat, lng: r.lng };
      const m = pin(gm, map, position, { color });
      m.addListener('click', () => {
        info.setContent(`<div class="gm-popup"><a href="#/r/${esc(r.id)}">${esc(r.name)}</a>${r.cuisine ? `<br>${esc(r.cuisine)}` : ''}<br>${esc(summary)}</div>`);
        info.open({ map, anchor: m });
      });
      markers.push(m);
      points.push(position);
    }
    return points;
  }

  try {
    ({ gm, map } = handle = await createMap($('#map', ctx.main), { center: DEFAULT_CENTER, zoom: 6 }));
    info = new gm.InfoWindow();
    map.addListener('click', () => info.close());
    fitPoints(gm, map, paintMarkers());
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  $('#locate', ctx.main).addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      const p = await getPosition();
      me?.setMap(null);
      me = pin(gm, map, p, { color: '#2b7fff', radius: 8 });
      map.panTo(p);
      map.setZoom(14);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      e.currentTarget.disabled = false;
    }
  });

  return {
    refresh: paintMarkers,
    destroy: () => {
      info?.close();
      markers.forEach((m) => m.setMap(null));
      me?.setMap(null);
      handle?.destroy();
      ctx.main.classList.remove('view-full');
    },
  };
}
