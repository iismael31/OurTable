// Edición de los datos de un restaurante (compartidos por los dos).
import { $, html, mount, toast, confirmDialog, friendlyError } from '../dom.js';
import { updateRestaurant, deleteRestaurant } from '../db.js';
import { restaurantFields } from './restaurant-fields.js';

export function restaurantFormView(ctx, [id]) {
  const r = ctx.state.restaurants.find((x) => x.id === id);
  if (!r) return ctx.navigate('#/');
  const s = ctx.state.summaries.get(id);

  ctx.setTopbar(html`
    <a class="btn-icon" href="#/r/${r.id}" aria-label="Volver"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></a>
    <h1>Editar restaurante</h1>
  `);
  mount(ctx.main, html`
    <form id="f" novalidate>
      <section class="form-section"><div id="rf"></div></section>
      ${s.count ? '' : html`
      <section class="form-section">
        <label class="settings-row" style="padding:0;border:0;cursor:pointer">
          <div class="grow"><div style="font-weight:600">Pendiente de visitar</div><div class="sub">Aparece en la lista de pendientes hasta que le añadáis una valoración.</div></div>
          <input type="checkbox" id="want" ${r.want_to_go ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--accent)">
        </label>
      </section>`}
      <div class="form-actions">
        <a class="btn btn-ghost" href="#/r/${r.id}">Cancelar</a>
        <button type="submit" class="btn btn-primary" id="save">Guardar</button>
      </div>
      <section class="form-section" style="margin-top:24px">
        <h2>Zona de peligro</h2>
        <p class="help" style="margin-bottom:10px">${s.count ? `Este sitio tiene ${s.count} ${s.count === 1 ? 'valoración' : 'valoraciones'}. Para borrarlo, primero hay que borrar cada valoración (solo puede hacerlo quien la escribió).` : 'Este sitio no tiene valoraciones y se puede borrar.'}</p>
        <button type="button" class="btn btn-danger btn-block" id="delete" ${s.count ? 'disabled' : ''}>Borrar restaurante</button>
      </section>
    </form>
  `);

  const rf = restaurantFields($('#rf', ctx.main), r, { extrasOpen: Boolean(r.links?.length || r.notes) });
  const form = $('#f', ctx.main);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = rf.validate();
    if (err) return toast(err, 'error');
    const btn = $('#save', form);
    btn.disabled = true;
    try {
      const want = $('#want', form);
      await updateRestaurant(r.id, { ...rf.values(), want_to_go: want ? want.checked : false });
      toast('Restaurante actualizado', 'ok');
      await ctx.reload();
      ctx.navigate(`#/r/${r.id}`);
    } catch (e2) {
      toast(friendlyError(e2), 'error');
      btn.disabled = false;
    }
  });

  $('#delete', form).addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Borrar restaurante', message: `Se borrará "${r.name}" de la lista compartida.`, okText: 'Borrar', danger: true });
    if (!ok) return;
    try {
      await deleteRestaurant(r.id);
      toast('Restaurante borrado', 'ok');
      await ctx.reload();
      ctx.navigate('#/');
    } catch (e2) {
      toast(friendlyError(e2), 'error');
    }
  });

  return { destroy: () => rf.destroy() };
}
