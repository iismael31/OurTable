// Aplica el tema antes de pintar la página para evitar el "parpadeo" blanco.
(function () {
  var pref = 'system';
  try { pref = localStorage.getItem('theme') || 'system'; } catch (e) { /* almacenamiento bloqueado */ }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#111113' : '#f7f5f2');
})();
