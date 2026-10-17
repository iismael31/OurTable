// Campos de un restaurante (nombre, cocina, dirección y ubicación en mapa).
// Lo usan tanto el formulario de valoración como la edición del restaurante.
import { $, $$, html, mount, raw, toast, friendlyError, normalizeUrl, linkHost } from '../dom.js';
import { createMap, pin, geocode, reverseGeocode, getPosition, DEFAULT_CENTER } from '../map.js';

export const CUISINES = [
  'Española', 'Tapas', 'Asador', 'Marisquería', 'Arrocería', 'Mediterránea', 'Italiana', 'Pizzería',
  'Japonesa', 'Sushi', 'China', 'Tailandesa', 'Vietnamita', 'Coreana', 'India', 'Mexicana', 'Peruana',
  'Árabe', 'Griega', 'Americana', 'Hamburguesería', 'Vegetariana', 'Fusión', 'Brunch', 'Cafetería', 'Postres',
];

const MAX_LINKS = 10;

export function restaurantFields(container, initial = {}, { extrasOpen = false } = {}) {
  const links = (initial.links || []).map((l) => ({ label: l.label || '', url: l.url || '' }));
  const v = {
    name: initial.name ?? '',
    cuisine: initial.cuisine ?? '',
    address: initial.address ?? '',
    lat: initial.lat ?? null,
    lng: initial.lng ?? null,
    notes: initial.notes ?? '',
  };
  let map = null;
  let marker = null;
  let L = null;

  mount(container, html`
    <div class="field">
      <label for="rf-name">Nombre del restaurante *</label>
      <input class="input" id="rf-name" maxlength="120" autocomplete="off" value="${v.name}" placeholder="Ej. Casa Lucio">
    </div>
    <div class="field">
      <label for="rf-cuisine">Tipo de cocina</label>
      <input class="input" id="rf-cuisine" list="rf-cuisines" maxlength="60" autocomplete="off" value="${v.cuisine}" placeholder="Ej. Japonesa">
      <datalist id="rf-cuisines">${CUISINES.map((c) => html`<option value="${c}"></option>`)}</datalist>
    </div>
    <div class="field">
      <label for="rf-address">Dirección</label>
      <div class="input-row">
        <input class="input" id="rf-address" maxlength="240" autocomplete="off" value="${v.address}" placeholder="Calle, número, ciudad">
        <button type="button" class="btn btn-sm" id="rf-geocode">Buscar</button>
      </div>
      <ul class="geo-results" id="rf-results" hidden></ul>
      <p class="help">Busca la dirección, toca el mapa para colocar el punto o usa tu ubicación.</p>
    </div>
    <div class="input-row" style="flex-wrap:wrap">
      <button type="button" class="btn btn-sm" id="rf-locate" style="white-space:nowrap">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>
        Usar mi ubicación
      </button>
      <span class="help" id="rf-coords"></span>
      <button type="button" class="btn btn-sm btn-ghost" id="rf-clear" hidden>Quitar punto</button>
    </div>
    <div class="map-picker" id="rf-map"></div>
    <details id="rf-extras" ${extrasOpen ? 'open' : ''} style="margin-top:14px">
      <summary class="label" style="cursor:pointer;margin-bottom:10px">Enlaces y notas (opcional)</summary>
      <div class="field">
        <span class="label">Enlaces <span class="help" id="rf-links-count"></span></span>
        <p class="help">Web del restaurante, Instagram, TikTok, la reseña donde lo visteis...</p>
        <div id="rf-links"></div>
        <button type="button" class="btn btn-sm" id="rf-add-link">+ Enlace</button>
      </div>
      <div class="field">
        <label for="rf-notes">Notas</label>
        <textarea class="textarea" id="rf-notes" maxlength="1000" placeholder="Ej. Nos lo recomendó Marta; pedir el ramen picante">${v.notes}</textarea>
      </div>
    </details>
  `);

  // ----- Enlaces -----
  const linksBox = $('#rf-links', container);
  function renderLinks() {
    $('#rf-links-count', container).textContent = links.length ? `${links.length} / ${MAX_LINKS}` : '';
    mount(linksBox, raw(links.map((l, i) => html`
      <div class="link-row" data-i="${i}">
        <input class="input" maxlength="40" placeholder="Nombre (ej. Instagram)" value="${l.label}" data-label="${i}">
        <input class="input" type="url" inputmode="url" autocapitalize="off" autocomplete="off" maxlength="500" placeholder="https://..." value="${l.url}" data-url="${i}">
        <button type="button" class="btn-icon" data-remove-link="${i}" aria-label="Quitar enlace"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>`).join('')));
  }
  linksBox.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.label != null) links[Number(t.dataset.label)].label = t.value;
    if (t.dataset.url != null) links[Number(t.dataset.url)].url = t.value;
  });
  linksBox.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-remove-link]');
    if (!b) return;
    links.splice(Number(b.dataset.removeLink), 1);
    renderLinks();
  });
  $('#rf-add-link', container).addEventListener('click', () => {
    if (links.length >= MAX_LINKS) return toast(`Máximo ${MAX_LINKS} enlaces`, 'error');
    links.push({ label: '', url: '' });
    renderLinks();
    $$('[data-url]', linksBox).at(-1)?.focus();
  });
  renderLinks();

  const nameEl = $('#rf-name', container);
  const cuisineEl = $('#rf-cuisine', container);
  const addressEl = $('#rf-address', container);
  const results = $('#rf-results', container);
  const coordsEl = $('#rf-coords', container);
  const clearBtn = $('#rf-clear', container);

  const hasPoint = () => v.lat != null && v.lng != null;

  function paintPoint() {
    coordsEl.textContent = hasPoint() ? `${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}` : 'Sin ubicación';
    clearBtn.hidden = !hasPoint();
    if (!map) return;
    if (hasPoint()) {
      if (!marker) marker = pin(L, [v.lat, v.lng], { radius: 10 }).addTo(map);
      else marker.setLatLng([v.lat, v.lng]);
    } else if (marker) {
      marker.remove();
      marker = null;
    }
  }

  function setPoint(lat, lng, { pan = true } = {}) {
    v.lat = lat;
    v.lng = lng;
    paintPoint();
    if (map && pan) map.setView([lat, lng], Math.max(map.getZoom(), 16));
  }

  createMap($('#rf-map', container), {
    center: hasPoint() ? [v.lat, v.lng] : DEFAULT_CENTER,
    zoom: hasPoint() ? 16 : 5,
  }).then((m) => {
    L = m.L;
    map = m.map;
    paintPoint();
    map.on('click', async (e) => {
      setPoint(e.latlng.lat, e.latlng.lng, { pan: false });
      if (!addressEl.value.trim()) {
        try { addressEl.value = (await reverseGeocode(e.latlng.lat, e.latlng.lng)).slice(0, 240); } catch { /* opcional */ }
      }
    });
  }).catch((err) => toast(friendlyError(err), 'error'));

  async function search() {
    const q = addressEl.value.trim() || nameEl.value.trim();
    if (!q) return toast('Escribe una dirección o el nombre del sitio', 'error');
    const btn = $('#rf-geocode', container);
    btn.disabled = true;
    try {
      const found = await geocode(q);
      if (!found.length) { toast('No se ha encontrado nada con ese texto'); results.hidden = true; return; }
      mount(results, html`${found.map((f, i) => html`<li><button type="button" data-i="${i}">${f.label}</button></li>`)}`);
      results.hidden = false;
      results.onclick = (e) => {
        const b = e.target.closest('button[data-i]');
        if (!b) return;
        const f = found[Number(b.dataset.i)];
        setPoint(f.lat, f.lng);
        if (f.short) addressEl.value = f.short.slice(0, 240);
        results.hidden = true;
      };
    } catch (err) {
      toast(friendlyError(err), 'error');
    } finally {
      btn.disabled = false;
    }
  }

  $('#rf-geocode', container).addEventListener('click', search);
  addressEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  clearBtn.addEventListener('click', () => { v.lat = null; v.lng = null; paintPoint(); });
  $('#rf-locate', container).addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const p = await getPosition();
      setPoint(p.lat, p.lng);
      if (!addressEl.value.trim()) {
        try { addressEl.value = (await reverseGeocode(p.lat, p.lng)).slice(0, 240); } catch { /* opcional */ }
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  return {
    values() {
      return {
        name: nameEl.value.trim().slice(0, 120),
        cuisine: cuisineEl.value.trim().slice(0, 60) || null,
        address: addressEl.value.trim().slice(0, 240) || null,
        lat: hasPoint() ? v.lat : null,
        lng: hasPoint() ? v.lng : null,
        notes: $('#rf-notes', container).value.trim().slice(0, 1000) || null,
        links: links
          .map((l) => ({ url: normalizeUrl(l.url), label: l.label.trim().slice(0, 40) }))
          .filter((l) => l.url)
          .map((l) => ({ url: l.url, label: l.label || linkHost(l.url) })),
      };
    },
    validate() {
      if (!nameEl.value.trim()) { nameEl.focus(); return 'El nombre del restaurante es obligatorio'; }
      const bad = links.find((l) => l.url.trim() && !normalizeUrl(l.url));
      if (bad) {
        $('#rf-extras', container).open = true;
        $(`[data-url="${links.indexOf(bad)}"]`, linksBox)?.focus();
        return 'Uno de los enlaces no es una dirección web válida';
      }
      return null;
    },
    refreshMap() { map?.invalidateSize(); },
    destroy() { map?.remove(); map = null; marker = null; $$('button', container).forEach((b) => { b.onclick = null; }); },
  };
}
