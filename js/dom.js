// Utilidades de interfaz. Todo lo que viene de datos se escapa al renderizar.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(String(s));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);

function part(v) {
  if (v == null || v === false || v === '') return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

/** Plantilla HTML segura: escapa automáticamente las interpolaciones. */
export function html(strings, ...vals) {
  let out = '';
  for (let i = 0; i < strings.length; i++) out += strings[i] + (i < vals.length ? part(vals[i]) : '');
  return new Raw(out);
}

export function mount(el, content) {
  el.innerHTML = String(content ?? '');
  return el;
}

export const debounce = (fn, ms = 200) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

// ---------- Formato ----------
export const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const fmtPrice = (n) =>
  n == null || n === '' ? '' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number(n) % 1 ? 2 : 0 }).format(Number(n));

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

// ---------- Estrellas ----------
export const STAR_SVG = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17.3 6 20.6l1.3-6.6L2.4 9.4l6.7-.8z"/></svg>');

export function starsView(value, size = 'md') {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return html`<span class="stars stars-${size}" style="--v:${v.toFixed(2)}" role="img" aria-label="${v.toFixed(1).replace('.', ',')} de 5"><span class="stars-fill"></span></span>`;
}

/** Selector de estrellas interactivo. Devuelve { get value, set value }. */
export function starInput(container, { value = 0, small = false, onChange } = {}) {
  let current = Number(value) || 0;
  container.classList.add('star-input');
  if (small) container.classList.add('small');
  container.setAttribute('role', 'radiogroup');
  mount(container, html`${[1, 2, 3, 4, 5].map((n) => html`<button type="button" data-n="${n}" role="radio" aria-label="${n} ${n === 1 ? 'estrella' : 'estrellas'}">${STAR_SVG}</button>`)}`);
  const paint = () => $$('button', container).forEach((b) => {
    const on = Number(b.dataset.n) <= current;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', Number(b.dataset.n) === current ? 'true' : 'false');
  });
  container.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-n]');
    if (!b) return;
    const n = Number(b.dataset.n);
    current = current === n ? 0 : n; // volver a tocar la misma estrella la quita
    paint();
    onChange?.(current);
  });
  paint();
  return {
    get value() { return current; },
    set value(v) { current = Number(v) || 0; paint(); },
  };
}

// ---------- Avisos ----------
export function toast(message, type = 'info', ms = 3200) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast-error' : type === 'ok' ? ' toast-ok' : ''}`;
  el.textContent = message;
  box.appendChild(el);
  const remove = () => el.remove();
  el.addEventListener('click', remove);
  setTimeout(remove, ms);
}

export function confirmDialog({ title, message, okText = 'Aceptar', cancelText = 'Cancelar', danger = false }) {
  const dlg = $('#confirm');
  $('.dialog-title', dlg).textContent = title;
  $('.dialog-message', dlg).textContent = message;
  const ok = $('.dialog-ok', dlg);
  ok.textContent = okText;
  ok.classList.toggle('danger', danger);
  $('.dialog-cancel', dlg).textContent = cancelText;
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}

export function openLightbox(url) {
  const dlg = $('#lightbox');
  const img = $('img', dlg);
  img.src = url;
  dlg.showModal();
}

export function initLightbox() {
  const dlg = $('#lightbox');
  const close = () => { dlg.close(); $('img', dlg).removeAttribute('src'); };
  $('.lightbox-close', dlg).addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
}

// ---------- Errores ----------
const FRIENDLY = [
  [/invalid login credentials/i, 'Email o contraseña incorrectos.'],
  [/email not confirmed/i, 'La cuenta aún no está confirmada.'],
  [/rate limit|too many requests/i, 'Demasiados intentos. Espera un momento y vuelve a probar.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
  [/new password should be different/i, 'La nueva contraseña debe ser distinta de la actual.'],
  [/failed to fetch|networkerror|load failed/i, 'Sin conexión. Comprueba tu red e inténtalo de nuevo.'],
  [/row-level security|permission denied|not allowed/i, 'No tienes permiso para hacer esto.'],
  [/payload too large|exceeded the maximum allowed size/i, 'La foto es demasiado grande.'],
  [/violates check constraint/i, 'Alguno de los datos no es válido (demasiado largo o fuera de rango).'],
  [/referer|PERMISSION_DENIED|REQUEST_DENIED|ApiNotActivated|has been suspended/i, 'Google Maps no está disponible en este momento.'],
];
export function friendlyError(err) {
  const msg = err?.message || String(err || '');
  for (const [re, text] of FRIENDLY) if (re.test(msg)) return text;
  return 'Algo ha fallado. Inténtalo de nuevo.';
}

// ---------- Enlaces ----------
/** Devuelve la URL solo si es http(s); evita esquemas peligrosos (javascript:, data:). */
export function safeUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch { return ''; }
}

/** Normaliza lo que escribe el usuario: añade https:// si falta y valida. */
export function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  return safeUrl(s);
}

/** Etiqueta corta para un enlace sin nombre: el dominio (sin www.). */
export function linkHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'enlace'; }
}
