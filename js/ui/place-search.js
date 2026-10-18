// Buscador de restaurantes: sugerencias al escribir, con los sitios ya guardados
// (si se le pasan) y los resultados de Google Maps (Places Text Search).
import { $, html, mount, toast, debounce, friendlyError } from '../dom.js';
import { searchPlaces, DEFAULT_CENTER } from '../map.js';

const MIN_CHARS = 3;
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * @param container  elemento donde se pinta
 * @param opts.placeholder  texto del campo
 * @param opts.saved  () => lista de restaurantes guardados a filtrar (opcional)
 * @param opts.near   () => {lat,lng} para priorizar resultados cercanos
 * @param opts.onPick ({ saved }) | ({ place }) al elegir un resultado
 */
export function placeSearchBox(container, { placeholder = 'Buscar restaurante en Google Maps', saved = null, near = () => DEFAULT_CENTER, onPick }) {
  mount(container, html`
    <div class="search" style="margin-bottom:6px">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input class="input" type="search" placeholder="${placeholder}" autocomplete="off" autocapitalize="words" enterkeyhint="search">
    </div>
    <ul class="geo-results" hidden></ul>
  `);
  const input = $('input', container);
  const list = $('ul', container);
  let seq = 0;
  let lastGoogle = { q: '', items: [] };

  function paint(q, savedItems, googleItems, status) {
    const rows = [];
    if (savedItems.length) {
      rows.push(html`<li class="geo-head">Ya guardados</li>`);
      rows.push(...savedItems.map((r, i) => html`<li><button type="button" data-saved="${i}"><strong>${r.name}</strong>${r.address ? html`<span class="help">${r.address}</span>` : ''}</button></li>`));
    }
    if (googleItems.length || status) {
      rows.push(html`<li class="geo-head">Google Maps${status ? html` · <span class="help">${status}</span>` : ''}</li>`);
      rows.push(...googleItems.map((p, i) => html`<li><button type="button" data-place="${i}"><strong>📍 ${p.name || p.label}</strong>${p.short ? html`<span class="help">${p.short}</span>` : ''}</button></li>`));
    }
    list.hidden = !rows.length;
    mount(list, html`${rows}`);
    list.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      list.hidden = true;
      if (b.dataset.saved != null) onPick({ saved: savedItems[Number(b.dataset.saved)] });
      else if (b.dataset.place != null) onPick({ place: googleItems[Number(b.dataset.place)] });
    };
  }

  const localMatches = (q) => {
    if (!saved) return [];
    const n = norm(q);
    return saved().filter((r) => norm(`${r.name} ${r.cuisine || ''} ${r.address || ''}`).includes(n)).slice(0, 5);
  };

  async function run(q) {
    const savedItems = localMatches(q);
    if (q.length < MIN_CHARS) { paint(q, savedItems, [], q ? `escribe al menos ${MIN_CHARS} letras` : ''); return; }
    if (lastGoogle.q === q) { paint(q, savedItems, lastGoogle.items, ''); return; }
    const my = ++seq;
    paint(q, savedItems, [], 'buscando...');
    try {
      const items = await searchPlaces(q, { near: near() });
      if (my !== seq) return; // llegó tarde: el usuario siguió escribiendo
      lastGoogle = { q, items };
      paint(q, savedItems, items, items.length ? '' : 'sin resultados');
    } catch (err) {
      if (my !== seq) return;
      paint(q, savedItems, [], 'no disponible');
      toast(friendlyError(err), 'error');
    }
  }

  const debounced = debounce(() => run(input.value.trim()), 550);
  input.addEventListener('input', debounced);
  input.addEventListener('focus', () => { if (input.value.trim()) run(input.value.trim()); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(input.value.trim()); } });
  document.addEventListener('click', (e) => { if (!container.contains(e.target)) list.hidden = true; });

  return {
    focus: () => input.focus(),
    clear: () => { input.value = ''; list.hidden = true; },
    get value() { return input.value; },
  };
}
