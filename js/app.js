// Arranque de la app: sesión, rutas, datos compartidos y tiempo real.
import { $, $$, html, mount, toast, initLightbox } from './dom.js';
import { applyTheme } from './theme.js';
import { isConfigured } from './supabase.js';
import { getSession, onAuthChange } from './auth.js';
import { loadAll, subscribeChanges } from './db.js';
import { loginView, recoveryView } from './ui/login.js';
import { listView } from './ui/list.js';
import { detailView } from './ui/detail.js';
import { formView } from './ui/form.js';
import { wishView } from './ui/wish.js';
import { restaurantFormView } from './ui/restaurant-form.js';
import { mapView } from './ui/map-view.js';
import { statsView } from './ui/stats.js';
import { settingsView } from './ui/settings.js';

const UUID = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
const ROUTES = [
  { re: /^\/$/, view: listView, tab: 'list', live: true },
  { re: /^\/map$/, view: mapView, tab: 'map', live: true },
  { re: /^\/new$/, view: formView, tab: 'new' },
  { re: /^\/wish$/, view: wishView, tab: 'new' },
  { re: new RegExp(`^/r/${UUID}$`), view: detailView, tab: 'list', live: true },
  { re: new RegExp(`^/r/${UUID}/edit$`), view: restaurantFormView, tab: 'list' },
  { re: new RegExp(`^/review/${UUID}/edit$`), view: formView, tab: 'list' },
  { re: /^\/stats$/, view: statsView, tab: 'stats', live: true },
  { re: /^\/settings$/, view: settingsView, tab: 'settings' },
];

const state = {
  session: null,
  profiles: [],
  restaurants: [],
  reviews: [],
  summaries: new Map(),
};

const main = $('#view');
const topbar = $('#topbar');
const tabbar = $('#tabbar');

const ctx = {
  state,
  main,
  get uid() { return state.session?.user?.id ?? null; },
  get email() { return state.session?.user?.email ?? ''; },
  profileOf: (id) => state.profiles.find((p) => p.id === id),
  setTopbar: (content) => mount(topbar, content),
  navigate: (hash) => { location.hash = hash; },
  reload: () => reloadAll(),
  reroute: () => route(),
};

// ---------- Resumen por restaurante (se calcula en el cliente) ----------
function computeSummaries() {
  const byRestaurant = new Map();
  for (const v of state.reviews) {
    if (!byRestaurant.has(v.restaurant_id)) byRestaurant.set(v.restaurant_id, []);
    byRestaurant.get(v.restaurant_id).push(v);
  }
  state.summaries = new Map();
  for (const r of state.restaurants) {
    const list = byRestaurant.get(r.id) || []; // ya vienen ordenadas por fecha desc
    const prices = list.map((v) => v.price_per_person).filter((p) => p != null).map(Number);
    const decided = list.find((v) => v.would_return != null);
    const withPhoto = list.find((v) => v.photos?.length);
    state.summaries.set(r.id, {
      count: list.length,
      avg: list.length ? list.reduce((a, v) => a + v.rating, 0) / list.length : null,
      last: list[0]?.visit_date ?? null,
      price: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      wouldReturn: decided ? decided.would_return : null,
      cover: withPhoto?.photos[0]?.thumb ?? null,
    });
  }
}

// ---------- Datos ----------
let reloading = null;
async function reloadAll() {
  if (reloading) return reloading;
  reloading = (async () => {
    try {
      const data = await loadAll();
      Object.assign(state, data);
      computeSummaries();
      current?.result?.refresh?.();
    } catch (err) {
      if (!state.restaurants.length) toast('No se han podido cargar los datos. Comprueba la conexión.', 'error');
    } finally {
      reloading = null;
    }
  })();
  return reloading;
}

// ---------- Rutas ----------
let current = null; // { route, result }

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

async function route() {
  if (!state.session) return;
  const { path, query } = parseHash();
  const found = ROUTES.map((r) => ({ r, m: path.match(r.re) })).find((x) => x.m);
  if (!found) return ctx.navigate('#/');

  current?.result?.destroy?.();
  current = { route: found.r, result: null };
  $$('.tab', tabbar).forEach((t) => t.classList.toggle('active', t.dataset.tab === found.r.tab));
  main.scrollTop = 0;
  window.scrollTo(0, 0);

  const mine = current;
  const result = await found.r.view(ctx, found.m.slice(1), query);
  if (current === mine) current.result = result || null;
}

// ---------- Sesión ----------
let started = false;
let unsubscribeRealtime = null;
let recovering = false;

async function start() {
  if (started) return;
  started = true;
  tabbar.hidden = false;
  mount(main, html`<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>`);
  await reloadAll();
  unsubscribeRealtime = subscribeChanges(debouncedReload);
  window.addEventListener('hashchange', route);
  await route();
}

function stop() {
  started = false;
  unsubscribeRealtime?.();
  unsubscribeRealtime = null;
  window.removeEventListener('hashchange', route);
  current?.result?.destroy?.();
  current = null;
  tabbar.hidden = true;
  Object.assign(state, { profiles: [], restaurants: [], reviews: [], summaries: new Map() });
}

let reloadTimer = null;
function debouncedReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(reloadAll, 350);
}

function showLogin() {
  stop();
  loginView(ctx);
}

function showRecovery() {
  recovering = true;
  stop();
  tabbar.hidden = true;
  recoveryView(ctx, () => { recovering = false; location.hash = '#/'; start(); });
}

// ---------- Service worker ----------
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      reg.installing?.addEventListener('statechange', (e) => {
        if (e.target.state === 'activated' && hadController) {
          toast('Hay una versión nueva. Toca aquí para actualizar.', 'info', 8000);
          $('#toasts').lastElementChild?.addEventListener('click', () => location.reload());
        }
      });
    });
  }).catch(() => { /* la app funciona igual sin caché */ });
  navigator.serviceWorker.addEventListener('controllerchange', () => { hadController = true; });
}

// ---------- Pantalla de configuración pendiente ----------
function showSetup() {
  mount(topbar, '');
  mount(main, html`
    <div class="setup">
      <div class="empty" style="padding-bottom:16px"><div class="emoji">🔧</div><h2>Falta configurar la conexión</h2></div>
      <ol>
        <li>Crea el proyecto en Supabase y ejecuta <code>supabase/schema.sql</code> en su SQL Editor.</li>
        <li>Copia la <strong>Project URL</strong> y la clave <strong>anon public</strong> (Settings → API).</li>
        <li>Pégalas en <code>js/config.js</code> y vuelve a publicar la app.</li>
      </ol>
    </div>
  `);
}

// ---------- Inicio ----------
applyTheme();
initLightbox();
registerSW();

if (!isConfigured) {
  showSetup();
} else {
  // Si la URL trae un token de recuperación, Supabase lo procesa y emite PASSWORD_RECOVERY.
  onAuthChange((event, session) => {
    state.session = session;
    if (event === 'PASSWORD_RECOVERY') return showRecovery();
    if (recovering) return;
    if (session && !started) start();
    if (!session && (started || event === 'SIGNED_OUT')) showLogin();
  });
  getSession().then((session) => {
    state.session = session;
    if (session) start();
    else if (!recovering) showLogin();
  }).catch(() => showLogin());

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && started) reloadAll();
  });
}
