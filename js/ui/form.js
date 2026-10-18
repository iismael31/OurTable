// Formulario de nueva valoración / edición de una valoración propia.
import { $, $$, html, mount, raw, starInput, todayISO, toast, friendlyError } from '../dom.js';
import { fetchReview, createRestaurant, createReview, updateReview, uploadPhoto, removePhotos, signedUrls } from '../db.js';
import { processPhoto } from '../image.js';
import { restaurantFields } from './restaurant-fields.js';
import { placeSearchBox } from './place-search.js';
import { enrichPlace } from '../map.js';
import { addTabs } from './add-tabs.js';

const MAX_PHOTOS = 12;
const MAX_DISHES = 30;
const SUB = [
  ['rating_food', 'Comida'],
  ['rating_service', 'Servicio'],
  ['rating_ambience', 'Ambiente'],
  ['rating_value', 'Calidad-precio'],
];

export async function formView(ctx, [editId], query) {
  const back = () => history.length > 1 ? history.back() : ctx.navigate('#/');
  let review = null;
  if (editId) {
    try {
      review = await fetchReview(editId);
    } catch (err) {
      toast(friendlyError(err), 'error');
      return ctx.navigate('#/');
    }
    if (review.author_id !== ctx.uid) {
      toast('Solo puedes editar tus propias valoraciones', 'error');
      return ctx.navigate(`#/r/${review.restaurant_id}`);
    }
  }

  ctx.setTopbar(html`
    <button type="button" class="btn-icon" id="back" aria-label="Volver"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <h1>${review ? 'Editar valoración' : 'Añadir'}</h1>
  `);
  $('#back').addEventListener('click', back);

  // ---------- Estado del formulario ----------
  let restaurant = ctx.state.restaurants.find((r) => r.id === (review?.restaurant_id || query.r)) || null;
  let creatingNew = false;
  let newInitial = {}; // datos con los que arranca el alta (p. ej. elegido en Google Maps)
  let rf = null; // componente de campos del restaurante
  const dishes = (review?.dishes || []).map((d) => ({ name: d.name || '', rating: Number(d.rating) || 0 }));
  const existing = [...(review?.photos || [])];
  const removed = [];
  const pending = []; // { full, thumb, width, height, preview }
  let wouldReturn = review?.would_return ?? null;

  mount(ctx.main, html`
    <form id="f" novalidate>
      ${!review ? addTabs('review') : ''}
      <section class="form-section" id="sec-restaurant"><h2>Restaurante</h2><div id="rest"></div></section>

      <section class="form-section">
        <h2>Tu valoración</h2>
        <div class="field">
          <label for="visit_date">Fecha de la visita</label>
          <input class="input" id="visit_date" type="date" value="${review?.visit_date || todayISO()}" max="${todayISO()}">
        </div>
        <div class="field">
          <span class="label">Valoración general *</span>
          <div id="rating"></div>
        </div>
        <details ${SUB.some(([k]) => review?.[k]) ? 'open' : ''}>
          <summary class="label" style="cursor:pointer;margin-bottom:8px">Valorar por apartados (opcional)</summary>
          ${SUB.map(([k, label]) => html`<div class="field" style="flex-direction:row;align-items:center;justify-content:space-between"><label>${label}</label><div id="${k}"></div></div>`)}
        </details>
        <div class="field">
          <label for="price">Precio por persona (€)</label>
          <input class="input" id="price" type="number" inputmode="decimal" min="0" max="10000" step="0.5" placeholder="Ej. 35" value="${review?.price_per_person ?? ''}">
        </div>
        <div class="field">
          <span class="label">¿Volveríais?</span>
          <div class="segmented" id="return">
            <button type="button" data-v="true">Sí</button>
            <button type="button" data-v="null">Sin decidir</button>
            <button type="button" data-v="false">No</button>
          </div>
        </div>
      </section>

      <section class="form-section">
        <h2>Platos <button type="button" class="btn btn-sm" id="add-dish">+ Plato</button></h2>
        <div id="dishes"></div>
        <div class="field" style="margin-top:12px">
          <label for="drinks">Bebida</label>
          <input class="input" id="drinks" maxlength="500" placeholder="Ej. Vino de la casa, agua con gas" value="${review?.drinks || ''}">
        </div>
      </section>

      <section class="form-section">
        <h2>Opinión</h2>
        <textarea class="textarea" id="comment" maxlength="4000" placeholder="¿Qué os pareció? Lo mejor, lo peor, recomendaciones...">${review?.comment || ''}</textarea>
      </section>

      <section class="form-section">
        <h2>Fotos <span class="help" id="photo-count"></span></h2>
        <div class="photo-grid" id="photos"></div>
        <input type="file" id="file" accept="image/*" multiple hidden>
        <div class="progress" id="progress" hidden><i></i></div>
      </section>

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" id="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="save">${review ? 'Guardar cambios' : 'Guardar valoración'}</button>
      </div>
    </form>
  `);

  const form = $('#f', ctx.main);
  $('#cancel', form).addEventListener('click', back);

  // ---------- Restaurante ----------
  const restBox = $('#rest', form);
  function renderRestaurant() {
    rf?.destroy();
    rf = null;
    if (restaurant) {
      const sub = [restaurant.cuisine, restaurant.address].filter(Boolean).join(' · ');
      mount(restBox, html`
        <div class="card" style="margin:0">
          <div class="card-body"><div class="card-title">${restaurant.name}</div>${sub ? html`<div class="card-sub">${sub}</div>` : ''}</div>
          ${review ? '' : html`<button type="button" class="btn btn-sm" id="change-rest">Cambiar</button>`}
        </div>`);
      $('#change-rest', restBox)?.addEventListener('click', () => { restaurant = null; renderRestaurant(); });
      return;
    }
    if (creatingNew) {
      mount(restBox, html`<div id="rf"></div><button type="button" class="btn btn-sm btn-ghost" id="pick-existing" style="margin-top:8px">← Elegir uno existente</button>`);
      rf = restaurantFields($('#rf', restBox), newInitial);
      $('#pick-existing', restBox).addEventListener('click', () => { creatingNew = false; renderRestaurant(); });
      return;
    }
    mount(restBox, html`
      <div id="rest-search"></div>
      <p class="help">Escribe el nombre: primero salen los sitios que ya tenéis guardados y debajo los de Google Maps.</p>
      <button type="button" class="btn btn-block btn-ghost" id="new-rest" style="margin-top:10px">+ Crear a mano un restaurante nuevo</button>
    `);
    const box = placeSearchBox($('#rest-search', restBox), {
      placeholder: 'Buscar restaurante',
      saved: () => ctx.state.restaurants,
      onPick: ({ saved, place }) => {
        if (saved) { restaurant = saved; renderRestaurant(); return; }
        if (place) {
          newInitial = { name: place.name, address: place.short, lat: place.lat, lng: place.lng, place_id: place.id };
          creatingNew = true;
          renderRestaurant();
          enrichPlace(place).then((full) => { if (!rf || full === place) return; rf.applyPlace(full); });
        }
      },
    });
    box.focus();
    $('#new-rest', restBox).addEventListener('click', () => {
      newInitial = {};
      creatingNew = true;
      renderRestaurant();
      $('#rf-name', restBox)?.focus();
    });
  }
  renderRestaurant();

  // ---------- Estrellas ----------
  const ratingInput = starInput($('#rating', form), { value: review?.rating || 0 });
  const subInputs = Object.fromEntries(SUB.map(([k]) => [k, starInput($(`#${k}`, form), { value: review?.[k] || 0, small: true })]));

  // ---------- ¿Volver? ----------
  const paintReturn = () => $$('button', $('#return', form)).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v) === String(wouldReturn) ? 'true' : 'false'));
  $('#return', form).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    wouldReturn = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : null;
    paintReturn();
  });
  paintReturn();

  // ---------- Platos ----------
  const dishBox = $('#dishes', form);
  const dishInputs = [];
  function renderDishes() {
    dishInputs.length = 0;
    if (!dishes.length) {
      mount(dishBox, html`<p class="help">Añade los platos que probasteis y puntúa cada uno.</p>`);
      return;
    }
    mount(dishBox, raw(dishes.map((d, i) => html`
      <div class="input-row" style="margin-bottom:8px" data-i="${i}">
        <input class="input" maxlength="80" placeholder="Nombre del plato" value="${d.name}" data-dish="${i}">
        <div data-stars="${i}"></div>
        <button type="button" class="btn-icon" data-remove="${i}" aria-label="Quitar plato"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>`).join('')));
    $$('[data-stars]', dishBox).forEach((el) => {
      const i = Number(el.dataset.stars);
      dishInputs[i] = starInput(el, { value: dishes[i].rating, small: true, onChange: (v) => { dishes[i].rating = v; } });
    });
  }
  dishBox.addEventListener('input', (e) => { if (e.target.dataset.dish != null) dishes[Number(e.target.dataset.dish)].name = e.target.value; });
  dishBox.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-remove]');
    if (!b) return;
    dishes.splice(Number(b.dataset.remove), 1);
    renderDishes();
  });
  $('#add-dish', form).addEventListener('click', () => {
    if (dishes.length >= MAX_DISHES) return toast(`Máximo ${MAX_DISHES} platos`, 'error');
    dishes.push({ name: '', rating: 0 });
    renderDishes();
    $$('[data-dish]', dishBox).at(-1)?.focus();
  });
  renderDishes();

  // ---------- Fotos ----------
  const photoBox = $('#photos', form);
  const fileInput = $('#file', form);
  const progress = $('#progress', form);
  const total = () => existing.length + pending.length;

  async function renderPhotos() {
    $('#photo-count', form).textContent = `${total()} / ${MAX_PHOTOS}`;
    mount(photoBox, html`
      ${existing.map((p, i) => html`<div class="thumb-wrap" data-existing="${i}" data-thumb="${p.thumb}"><button type="button" class="remove" data-remove-existing="${i}" aria-label="Quitar foto">✕</button></div>`)}
      ${pending.map((p, i) => html`<div class="thumb-wrap"><img src="${p.preview}" alt=""><button type="button" class="remove" data-remove-pending="${i}" aria-label="Quitar foto">✕</button></div>`)}
      ${total() < MAX_PHOTOS ? html`<button type="button" class="photo-add" id="add-photo"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Añadir</button>` : ''}
    `);
    $('#add-photo', photoBox)?.addEventListener('click', () => fileInput.click());
    const wraps = $$('[data-existing]', photoBox);
    if (wraps.length) {
      try {
        const urls = await signedUrls(wraps.map((w) => w.dataset.thumb));
        for (const w of wraps) {
          if (!urls[w.dataset.thumb]) continue;
          const img = new Image();
          img.alt = '';
          img.src = urls[w.dataset.thumb];
          w.prepend(img);
        }
      } catch { /* opcional */ }
    }
  }
  photoBox.addEventListener('click', (e) => {
    const ex = e.target.closest('button[data-remove-existing]');
    if (ex) { removed.push(...existing.splice(Number(ex.dataset.removeExisting), 1)); renderPhotos(); return; }
    const pe = e.target.closest('button[data-remove-pending]');
    if (pe) { const [p] = pending.splice(Number(pe.dataset.removePending), 1); URL.revokeObjectURL(p.preview); renderPhotos(); }
  });
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';
    if (!files.length) return;
    const room = MAX_PHOTOS - total();
    if (files.length > room) toast(`Solo caben ${room} fotos más`, 'error');
    const save = $('#save', form);
    save.disabled = true;
    progress.hidden = false;
    let done = 0;
    for (const file of files.slice(0, room)) {
      try {
        const p = await processPhoto(file);
        p.preview = URL.createObjectURL(p.thumb);
        pending.push(p);
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      done++;
      progress.style.setProperty('--p', (done / Math.min(files.length, room)).toFixed(2));
    }
    progress.hidden = true;
    save.disabled = false;
    renderPhotos();
  });
  renderPhotos();

  // ---------- Guardar ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rating = ratingInput.value;
    if (!rating) { toast('Pon al menos la valoración general en estrellas', 'error'); $('#rating', form).scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (!restaurant && !creatingNew) { toast('Elige un restaurante o crea uno nuevo', 'error'); return; }
    if (!restaurant) {
      const err = rf.validate();
      if (err) return toast(err, 'error');
    }
    const priceRaw = $('#price', form).value.trim();
    const price = priceRaw === '' ? null : Number(priceRaw);
    if (price != null && (!Number.isFinite(price) || price < 0 || price > 10000)) return toast('El precio no es válido', 'error');
    const visitDate = $('#visit_date', form).value || todayISO();

    const save = $('#save', form);
    save.disabled = true;
    progress.hidden = false;
    progress.style.setProperty('--p', '0.05');
    const uploaded = [];
    try {
      let restaurantId = restaurant?.id;
      if (!restaurantId) {
        const created = await createRestaurant({ ...rf.values(), created_by: ctx.uid });
        restaurantId = created.id;
      }
      for (let i = 0; i < pending.length; i++) {
        const p = pending[i];
        const base = `${ctx.uid}/${crypto.randomUUID()}`;
        await uploadPhoto(`${base}.jpg`, p.full);
        await uploadPhoto(`${base}_t.jpg`, p.thumb);
        uploaded.push({ path: `${base}.jpg`, thumb: `${base}_t.jpg`, w: p.width, h: p.height });
        progress.style.setProperty('--p', (0.1 + 0.8 * ((i + 1) / pending.length)).toFixed(2));
      }
      const data = {
        restaurant_id: restaurantId,
        visit_date: visitDate,
        rating,
        ...Object.fromEntries(SUB.map(([k]) => [k, subInputs[k].value || null])),
        price_per_person: price,
        dishes: dishes.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim().slice(0, 80), rating: d.rating || null })),
        drinks: $('#drinks', form).value.trim().slice(0, 500) || null,
        comment: $('#comment', form).value.trim().slice(0, 4000) || null,
        would_return: wouldReturn,
        photos: [...existing, ...uploaded],
      };
      if (review) await updateReview(review.id, data);
      else await createReview({ ...data, author_id: ctx.uid });
      if (removed.length) await removePhotos(removed.flatMap((p) => [p.path, p.thumb])).catch(() => {});
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      progress.style.setProperty('--p', '1');
      toast(review ? 'Cambios guardados' : 'Valoración guardada', 'ok');
      await ctx.reload();
      ctx.navigate(`#/r/${restaurantId}`);
    } catch (err) {
      if (uploaded.length) removePhotos(uploaded.flatMap((p) => [p.path, p.thumb])).catch(() => {});
      toast(friendlyError(err), 'error');
      save.disabled = false;
      progress.hidden = true;
    }
  });

  return { destroy: () => { rf?.destroy(); pending.forEach((p) => URL.revokeObjectURL(p.preview)); } };
}
