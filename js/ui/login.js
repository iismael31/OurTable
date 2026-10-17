import { $, html, mount, toast, friendlyError } from '../dom.js';
import { signIn, sendPasswordReset, updatePassword } from '../auth.js';

export function loginView(ctx) {
  ctx.setTopbar('');
  mount(ctx.main, html`
    <div class="auth">
      <div class="brand">
        <img src="./assets/icons/icon.svg" alt="">
        <h1>Nuestros Restaurantes</h1>
        <p>Vuestras valoraciones, en un solo sitio.</p>
      </div>
      <form id="login-form" class="form-section" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input class="input" id="email" name="email" type="email" autocomplete="username" inputmode="email" autocapitalize="off" required>
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Entrar</button>
        <p class="link-row"><a href="#/" id="forgot">¿Has olvidado la contraseña?</a></p>
      </form>
    </div>
  `);

  const form = $('#login-form', ctx.main);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return toast('Escribe tu email y tu contraseña', 'error');
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      await signIn(email, password);
    } catch (err) {
      toast(friendlyError(err), 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('#forgot', form).addEventListener('click', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email) return toast('Escribe tu email arriba y vuelve a pulsar el enlace', 'error');
    try {
      await sendPasswordReset(email);
      toast('Si el email existe, te hemos enviado un enlace para cambiar la contraseña', 'ok', 5000);
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  });
}

export function recoveryView(ctx, onDone) {
  ctx.setTopbar('');
  mount(ctx.main, html`
    <div class="auth">
      <div class="brand"><h1>Nueva contraseña</h1><p>Elige una contraseña de al menos 8 caracteres.</p></div>
      <form id="recovery-form" class="form-section" novalidate>
        <div class="field">
          <label for="pw1">Nueva contraseña</label>
          <input class="input" id="pw1" type="password" autocomplete="new-password" minlength="8" required>
        </div>
        <div class="field">
          <label for="pw2">Repite la contraseña</label>
          <input class="input" id="pw2" type="password" autocomplete="new-password" minlength="8" required>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Guardar</button>
      </form>
    </div>
  `);
  const form = $('#recovery-form', ctx.main);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('#pw1', form).value;
    const b = $('#pw2', form).value;
    if (a.length < 8) return toast('La contraseña debe tener al menos 8 caracteres', 'error');
    if (a !== b) return toast('Las contraseñas no coinciden', 'error');
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      await updatePassword(a);
      toast('Contraseña actualizada', 'ok');
      onDone();
    } catch (err) {
      toast(friendlyError(err), 'error');
      btn.disabled = false;
    }
  });
}
