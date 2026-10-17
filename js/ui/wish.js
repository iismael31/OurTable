// "Quiero ir": guardar un restaurante pendiente de visitar, con enlaces y notas.
import { $, html, mount, toast, friendlyError } from '../dom.js';
import { createRestaurant } from '../db.js';
import { restaurantFields } from './restaurant-fields.js';

export function wishView(ctx) {
  const back = () => (history.length > 1 ? history.back() : ctx.navigate('#/'));
  ctx.setTopbar(html`
    <button type="button" class="btn-icon" id="back" aria-label="Volver"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <h1>Sitio pendiente</h1>
  `);
  $('#back').addEventListener('click', back);

  mount(ctx.main, html`
    <form id="f" novalidate>
      <p class="help" style="margin-bottom:12px">Un restaurante al que queréis ir. Guarda dónde lo visteis y por qué os llamó la atención; cuando vayáis, le añadís la valoración y pasa a visitados.</p>
      <section class="form-section"><div id="rf"></div></section>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" id="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="save">Guardar pendiente</button>
      </div>
    </form>
  `);

  const rf = restaurantFields($('#rf', ctx.main), {}, { extrasOpen: true });
  $('#cancel', ctx.main).addEventListener('click', back);

  $('#f', ctx.main).addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = rf.validate();
    if (err) return toast(err, 'error');
    const btn = $('#save', ctx.main);
    btn.disabled = true;
    try {
      const created = await createRestaurant({ ...rf.values(), want_to_go: true, created_by: ctx.uid });
      toast('Guardado en pendientes', 'ok');
      await ctx.reload();
      ctx.navigate(`#/r/${created.id}`);
    } catch (e2) {
      toast(friendlyError(e2), 'error');
      btn.disabled = false;
    }
  });

  return { destroy: () => rf.destroy() };
}
