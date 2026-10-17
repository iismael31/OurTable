// Tema claro / oscuro / automático. La preferencia se guarda en cada dispositivo.
const KEY = 'theme';
const COLORS = { dark: '#111113', light: '#f7f5f2' };
const mq = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref() {
  try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
}

export function resolveTheme(pref = getThemePref()) {
  return pref === 'dark' || (pref === 'system' && mq.matches) ? 'dark' : 'light';
}

export function applyTheme(pref = getThemePref()) {
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
}

export function setThemePref(pref) {
  try { localStorage.setItem(KEY, pref); } catch { /* sin almacenamiento: solo se aplica en esta sesión */ }
  applyTheme(pref);
}

mq.addEventListener('change', () => applyTheme());
