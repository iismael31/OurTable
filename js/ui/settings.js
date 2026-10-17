import { $, $$, html, mount, toast, confirmDialog, friendlyError, initials } from '../dom.js';
import { getThemePref, setThemePref } from '../theme.js';
import { signOut, updatePassword } from '../auth.js';
import { updateProfile } from '../db.js';
import { APP_VERSION } from '../config.js';

const COLORS = ['#d6336c', '#e8590c', '#f08c00', '#2f9e44', '#0ca678', '#1c7ed6', '#7048e8', '#ae3ec9', '#495057'];
const THEMES = [['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Automático']];

export function settingsView(ctx) {
  ctx.setTopbar(html`<h1>Ajustes</h1>`);
  const me = ctx.profileOf(ctx.uid) || { display_name: '', color: COLORS[0] };
  let color = me.color;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  mount(ctx.main, html`
    <div class="settings-group">
      <h2>Apariencia</h2>
      <div class="settings-row"><div class="segmented" id="theme">${THEMES.map(([k, l]) => html`<button type="button" data-t="${k}" aria-pressed="${getThemePref() === k}">${l}</button>`)}</div></div>
    </div>

    <div class="settings-group">
      <h2>Mi perfil</h2>
      <form id="profile" class="settings-row" style="flex-direction:column;align-items:stretch;gap:12px">
        <div class="input-row">
          <span class="avatar" id="avatar" style="--who:${color};width:40px;height:40px;font-size:15px">${initials(me.display_name)}</span>
          <input class="input" id="name" maxlength="40" value="${me.display_name}" placeholder="Tu nombre" autocomplete="nickname">
        </div>
        <div class="color-dots" id="colors">${COLORS.map((c) => html`<button type="button" data-c="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${c === color}"></button>`)}</div>
        <button type="submit" class="btn btn-primary">Guardar perfil</button>
      </form>
    </div>

    <div class="settings-group">
      <h2>Seguridad</h2>
      <form id="password" class="settings-row" style="flex-direction:column;align-items:stretch;gap:10px">
        <div class="field" style="margin:0"><label for="pw1">Nueva contraseña</label><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="8"></div>
        <div class="field" style="margin:0"><label for="pw2">Repetir contraseña</label><input class="input" id="pw2" type="password" autocomplete="new-password" minlength="8"></div>
        <button type="submit" class="btn">Cambiar contraseña</button>
      </form>
    </div>

    ${standalone ? '' : html`
    <div class="settings-group">
      <h2>Instalar en el móvil</h2>
      <div class="settings-row"><div class="grow">
        ${isIOS
          ? html`<p>En Safari, toca el botón <strong>Compartir</strong> (cuadrado con flecha) y elige <strong>Añadir a pantalla de inicio</strong>.</p>`
          : html`<p>En Chrome, abre el menú <strong>⋮</strong> y elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</p>`}
        <p class="sub" style="margin-top:6px">Así se abre a pantalla completa, como una app.</p>
      </div></div>
    </div>`}

    <div class="settings-group">
      <div class="settings-row"><div class="grow"><div>Sesión iniciada como</div><div class="sub">${ctx.email}</div></div><button type="button" class="btn btn-danger btn-sm" id="logout">Salir</button></div>
      <div class="settings-row"><span class="sub">Nuestros Restaurantes · versión ${APP_VERSION}</span></div>
    </div>
  `);

  $('#theme', ctx.main).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-t]');
    if (!b) return;
    setThemePref(b.dataset.t);
    $$('button', e.currentTarget).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  });

  $('#colors', ctx.main).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-c]');
    if (!b) return;
    color = b.dataset.c;
    $$('button', e.currentTarget).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    $('#avatar', ctx.main).style.setProperty('--who', color);
  });
  $('#name', ctx.main).addEventListener('input', (e) => { $('#avatar', ctx.main).textContent = initials(e.target.value); });

  $('#profile', ctx.main).addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#name', ctx.main).value.trim().slice(0, 40);
    if (!name) return toast('Escribe tu nombre', 'error');
    try {
      await updateProfile(ctx.uid, { display_name: name, color });
      toast('Perfil guardado', 'ok');
      ctx.reload();
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  });

  $('#password', ctx.main).addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('#pw1', ctx.main).value;
    const b = $('#pw2', ctx.main).value;
    if (a.length < 8) return toast('La contraseña debe tener al menos 8 caracteres', 'error');
    if (a !== b) return toast('Las contraseñas no coinciden', 'error');
    try {
      await updatePassword(a);
      toast('Contraseña cambiada', 'ok');
      e.target.reset();
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  });

  $('#logout', ctx.main).addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Cerrar sesión', message: '¿Seguro que quieres salir?', okText: 'Salir' });
    if (!ok) return;
    try { await signOut(); } catch (err) { toast(friendlyError(err), 'error'); }
  });
}
