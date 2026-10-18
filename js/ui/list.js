import { $, $$, html, mount, raw, starsView, fmtDate, fmtPrice, debounce, safeUrl } from '../dom.js';
import { signedUrls } from '../db.js';

// Los filtros se recuerdan mientras la app está abierta.
const filters = { q: '', sort: 'recent', onlyReturn: false, mode: 'visited' }; // mode: 'visited' | 'wish'

const SORTS = [
  ['recent', 'Recientes'],
  ['rating', 'Mejor valorados'],
  ['visits', 'Más visitados'],
  ['name', 'A – Z'],
];

const norm = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function filterSort(state) {
  const q = norm(filters.q);
  const wish = filters.mode === 'wish';
  let items = state.restaurants.filter((r) => Boolean(r.want_to_go) === wish).map((r) => ({ r, s: state.summaries.get(r.id) }));
  if (q) items = items.filter(({ r }) => norm(`${r.name} ${r.cuisine || ''} ${r.address || ''}`).includes(q));
  if (filters.onlyReturn && !wish) items = items.filter(({ s }) => s.wouldReturn === true);
  const by = {
    recent: (a, b) => (b.s.last || b.r.created_at).localeCompare(a.s.last || a.r.created_at),
    rating: (a, b) => (b.s.avg ?? -1) - (a.s.avg ?? -1) || b.s.count - a.s.count,
    visits: (a, b) => b.s.count - a.s.count || (b.s.avg ?? 0) - (a.s.avg ?? 0),
    name: (a, b) => a.r.name.localeCompare(b.r.name, 'es'),
  };
  return items.sort(by[filters.sort]);
}

function wishCard({ r }) {
  const sub = [r.cuisine, r.address].filter(Boolean).join(' · ');
  const n = r.links?.length || 0;
  return html`
    <a class="card" href="#/r/${r.id}">
      <div class="card-cover">${safeUrl(r.cover_url || '') ? html`<img src="${safeUrl(r.cover_url)}" alt="" loading="lazy">` : '📌'}</div>
      <div class="card-body">
        <div class="card-title">${r.name}</div>
        ${sub ? html`<div class="card-sub">${sub}</div>` : ''}
        ${r.notes ? html`<div class="card-sub" style="white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${r.notes}</div>` : ''}
        <div class="card-row"><span class="badge badge-wish">Pendiente</span>${n ? html`<span>🔗 ${n} ${n === 1 ? 'enlace' : 'enlaces'}</span>` : ''}</div>
      </div>
    </a>`;
}

function card(item) {
  if (item.r.want_to_go) return wishCard(item);
  const { r, s } = item;
  const sub = [r.cuisine, r.address].filter(Boolean).join(' · ');
  return html`
    <a class="card" href="#/r/${r.id}">
      <div class="card-cover" data-thumb="${s.cover || ''}">${s.cover ? '' : safeUrl(r.cover_url || '') ? html`<img src="${safeUrl(r.cover_url)}" alt="" loading="lazy">` : '🍽️'}</div>
      <div class="card-body">
        <div class="card-title">${r.name}</div>
        ${sub ? html`<div class="card-sub">${sub}</div>` : ''}
        <div class="card-row">
          ${s.count
            ? html`${starsView(s.avg, 'sm')} <strong>${s.avg.toFixed(1).replace('.', ',')}</strong> · ${s.count} ${s.count === 1 ? 'visita' : 'visitas'}`
            : html`<span class="badge badge-muted">Sin valorar</span>`}
        </div>
        <div class="card-row">
          ${s.last ? html`<span>${fmtDate(s.last)}</span>` : ''}
          ${s.price != null ? html`<span>~${fmtPrice(s.price)} / pers.</span>` : ''}
          ${s.wouldReturn === true ? html`<span class="badge badge-ok">Volveríamos</span>` : ''}
          ${s.wouldReturn === false ? html`<span class="badge badge-no">No volveríamos</span>` : ''}
        </div>
      </div>
    </a>`;
}

export async function loadThumbs(root) {
  const covers = $$('[data-thumb]', root).filter((el) => el.dataset.thumb);
  if (!covers.length) return;
  try {
    const urls = await signedUrls(covers.map((el) => el.dataset.thumb));
    for (const el of covers) {
      const url = urls[el.dataset.thumb];
      if (!url || !el.isConnected) continue;
      const img = new Image();
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = url;
      el.replaceChildren(img);
    }
  } catch { /* las miniaturas son opcionales */ }
}

export function listView(ctx) {
  ctx.setTopbar(html`<h1>OurTable</h1>`);
  mount(ctx.main, html`
    <div class="segmented mode" id="mode"></div>
    <div class="search">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input class="input" id="q" type="search" placeholder="Buscar sitio, cocina o dirección" value="${filters.q}" autocomplete="off">
    </div>
    <div class="chips" id="chips"></div>
    <div id="list"></div>
  `);

  const renderMode = () => {
    const wishCount = ctx.state.restaurants.filter((r) => r.want_to_go).length;
    const visitedCount = ctx.state.restaurants.length - wishCount;
    mount($('#mode', ctx.main), html`
      <button type="button" data-mode="visited" aria-pressed="${filters.mode === 'visited'}">Visitados<span class="count">${visitedCount}</span></button>
      <button type="button" data-mode="wish" aria-pressed="${filters.mode === 'wish'}">📌 Pendientes<span class="count">${wishCount}</span></button>
    `);
  };

  const renderChips = () => mount($('#chips', ctx.main), filters.mode === 'wish'
    ? html`<button type="button" class="chip" data-sort="recent" aria-pressed="${filters.sort === 'recent'}">Recientes</button><button type="button" class="chip" data-sort="name" aria-pressed="${filters.sort === 'name'}">A – Z</button>`
    : html`
    ${SORTS.map(([k, label]) => html`<button type="button" class="chip" data-sort="${k}" aria-pressed="${filters.sort === k}">${label}</button>`)}
    <button type="button" class="chip" data-return aria-pressed="${filters.onlyReturn}">💚 Volveríamos</button>
  `);

  const renderList = () => {
    const items = filterSort(ctx.state);
    const list = $('#list', ctx.main);
    if (!items.length && !filters.q && !filters.onlyReturn) {
      mount(list, filters.mode === 'wish'
        ? html`<div class="empty"><div class="emoji">📌</div><h2>Sin sitios pendientes</h2><p>Guarda los restaurantes a los que queréis ir: pulsa + y elige "Guárdalo como pendiente".</p><a class="btn btn-primary" href="#/wish" style="margin-top:14px">Añadir pendiente</a></div>`
        : html`<div class="empty"><div class="emoji">🍽️</div><h2>Aún no hay sitios</h2><p>Añade vuestra primera valoración con el botón +.</p></div>`);
      return;
    }
    if (!items.length) {
      mount(list, html`<div class="empty"><div class="emoji">🔍</div><h2>Nada por aquí</h2><p>Prueba con otra búsqueda o quita los filtros.</p></div>`);
      return;
    }
    mount(list, raw(items.map(card).join('')));
    loadThumbs(list);
  };

  renderMode();
  renderChips();
  renderList();

  $('#mode', ctx.main).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b || b.dataset.mode === filters.mode) return;
    filters.mode = b.dataset.mode;
    if (filters.mode === 'wish' && !['recent', 'name'].includes(filters.sort)) filters.sort = 'recent';
    renderMode();
    renderChips();
    renderList();
  });

  $('#q', ctx.main).addEventListener('input', debounce((e) => { filters.q = e.target.value; renderList(); }, 150));
  $('#chips', ctx.main).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.sort) filters.sort = b.dataset.sort;
    else if ('return' in b.dataset) filters.onlyReturn = !filters.onlyReturn;
    renderChips();
    renderList();
  });

  return { refresh: () => { renderMode(); renderList(); } };
}
