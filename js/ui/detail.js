import { $, $$, html, mount, raw, starsView, fmtDate, fmtPrice, initials, toast, confirmDialog, openLightbox, friendlyError, safeUrl } from '../dom.js';
import { fetchReviews, deleteReview, removePhotos, signedUrls } from '../db.js';
import { createMap, pin } from '../map.js';

const SUB = [
  ['rating_food', 'Comida'],
  ['rating_service', 'Servicio'],
  ['rating_ambience', 'Ambiente'],
  ['rating_value', 'Calidad-precio'],
];

function authorChip(p) {
  return html`<span class="author"><span class="avatar" style="--who:${p?.color || '#888'}">${initials(p?.display_name)}</span>${p?.display_name || 'Alguien'}</span>`;
}

function reviewCard(v, ctx) {
  const mine = v.author_id === ctx.uid;
  const subs = SUB.filter(([k]) => v[k]);
  return html`
    <article class="review" data-id="${v.id}">
      <div class="review-head">
        ${authorChip(ctx.profileOf(v.author_id))}
        <div class="review-actions">
          <span class="review-date">${fmtDate(v.visit_date)}</span>
          ${mine ? html`
            <a class="btn-icon" href="#/review/${v.id}/edit" aria-label="Editar valoración"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></a>
            <button type="button" class="btn-icon" data-delete aria-label="Borrar valoración"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button>` : ''}
        </div>
      </div>
      <div class="rating-big">
        <span class="num">${v.rating}</span>
        <div>
          ${starsView(v.rating, 'md')}
          <div class="meta">
            ${v.price_per_person != null ? html`${fmtPrice(v.price_per_person)} por persona` : ''}
            ${v.would_return === true ? html` <span class="badge badge-ok">Volveríamos</span>` : ''}
            ${v.would_return === false ? html` <span class="badge badge-no">No volveríamos</span>` : ''}
          </div>
        </div>
      </div>
      ${subs.length ? html`<div class="subratings">${subs.map(([k, label]) => html`<div><span>${label}</span>${starsView(v[k], 'sm')}</div>`)}</div>` : ''}
      ${v.dishes?.length ? html`<h4>Platos</h4><ul class="dishes">${v.dishes.map((d) => html`<li><span>${d.name}</span>${d.rating ? starsView(d.rating, 'sm') : ''}</li>`)}</ul>` : ''}
      ${v.drinks ? html`<h4>Bebida</h4><p class="review-text">${v.drinks}</p>` : ''}
      ${v.comment ? html`<h4>Opinión</h4><p class="review-text">${v.comment}</p>` : ''}
      ${v.photos?.length ? html`<div class="photo-grid">${v.photos.map((p) => html`<button type="button" data-full="${p.path}" data-thumb="${p.thumb}" aria-label="Ver foto"></button>`)}</div>` : ''}
    </article>`;
}

export async function detailView(ctx, [id]) {
  const r = ctx.state.restaurants.find((x) => x.id === id);
  if (!r) {
    ctx.setTopbar(html`<a class="btn-icon" href="#/" aria-label="Volver"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></a><h1>No encontrado</h1>`);
    mount(ctx.main, html`<div class="empty"><div class="emoji">🤷</div><h2>Este sitio ya no existe</h2></div>`);
    return { refresh: () => { if (ctx.state.restaurants.some((x) => x.id === id)) ctx.reroute(); } };
  }
  ctx.setTopbar(html`
    <a class="btn-icon" href="#/" aria-label="Volver"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></a>
    <h1>${r.name}</h1>
    <a class="btn-icon" href="#/r/${r.id}/edit" aria-label="Editar restaurante"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></a>
  `);

  const s = ctx.state.summaries.get(r.id);
  const hasPoint = r.lat != null && r.lng != null;
  const sub = [r.cuisine, r.address].filter(Boolean).join(' · ');
  const mapsApple = hasPoint ? `https://maps.apple.com/?ll=${r.lat},${r.lng}&q=${encodeURIComponent(r.name)}` : '';
  const mapsGoogle = hasPoint ? `https://www.google.com/maps/search/?api=1&query=${r.lat}%2C${r.lng}` : '';
  const links = (r.links || []).map((l) => ({ url: safeUrl(l.url), label: l.label || '' })).filter((l) => l.url);

  mount(ctx.main, html`
    <section class="hero">
      ${safeUrl(r.cover_url || '') ? html`<img class="hero-cover" src="${safeUrl(r.cover_url)}" alt="">` : ''}
      ${r.want_to_go ? html`<span class="badge badge-wish" style="margin-bottom:8px">📌 Pendiente de visitar</span>` : ''}
      <h2>${r.name}</h2>
      ${sub ? html`<p class="sub">${sub}</p>` : ''}
      ${r.notes ? html`<p class="notes">${r.notes}</p>` : ''}
      ${links.length ? html`<div class="links">${links.map((l) => html`<a class="btn btn-sm" href="${l.url}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg><span>${l.label}</span></a>`)}</div>` : ''}
      ${s.count ? html`
        <div class="rating-big"><span class="num">${s.avg.toFixed(1).replace('.', ',')}</span><div>${starsView(s.avg, 'lg')}<div class="meta">${s.count} ${s.count === 1 ? 'visita' : 'visitas'}</div></div></div>
        <div class="hero-stats">
          <div class="stat"><div class="v">${s.last ? fmtDate(s.last) : '—'}</div><div class="l">Última visita</div></div>
          <div class="stat"><div class="v">${s.price != null ? fmtPrice(s.price) : '—'}</div><div class="l">Por persona</div></div>
          <div class="stat"><div class="v">${s.wouldReturn === true ? '💚' : s.wouldReturn === false ? '🚫' : '—'}</div><div class="l">¿Volver?</div></div>
        </div>` : html`<p class="help" style="margin-top:10px">${r.want_to_go ? 'Cuando vayáis, añadid la valoración y pasará a visitados.' : 'Todavía nadie ha valorado este sitio.'}</p>`}
      ${hasPoint ? html`<div class="minimap" id="minimap"></div>` : ''}
      <div class="links-row">
        <a class="btn btn-primary" href="#/new?r=${r.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>${r.want_to_go ? 'Ya hemos ido: valorar' : 'Añadir mi valoración'}</a>
        ${hasPoint ? html`<a class="btn" href="${mapsApple}" target="_blank" rel="noopener">Apple Maps</a><a class="btn" href="${mapsGoogle}" target="_blank" rel="noopener">Google Maps</a>` : ''}
      </div>
    </section>
    <div id="reviews"><div class="skeleton"></div></div>
  `);

  let mapHandle = null;
  if (hasPoint) {
    createMap($('#minimap', ctx.main), { center: { lat: r.lat, lng: r.lng }, zoom: 15, interactive: false })
      .then((m) => { mapHandle = m; pin(m.gm, m.map, { lat: r.lat, lng: r.lng }, { radius: 10 }); })
      .catch(() => { $('#minimap', ctx.main)?.remove(); });
  }

  const box = $('#reviews', ctx.main);

  async function paintPhotos(root) {
    const buttons = $$('button[data-thumb]', root);
    if (!buttons.length) return;
    try {
      const urls = await signedUrls(buttons.map((b) => b.dataset.thumb));
      for (const b of buttons) {
        const url = urls[b.dataset.thumb];
        if (!url) continue;
        const img = new Image();
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = url;
        b.replaceChildren(img);
      }
    } catch { /* opcional */ }
  }

  async function render() {
    try {
      const reviews = await fetchReviews(r.id);
      if (!box.isConnected) return;
      mount(box, reviews.length
        ? raw(reviews.map((v) => reviewCard(v, ctx)).join(''))
        : html`<div class="empty"><div class="emoji">${r.want_to_go ? '📌' : '✍️'}</div><h2>Sin valoraciones</h2><p>${r.want_to_go ? 'Todavía no habéis ido.' : 'Sé la primera persona en opinar.'}</p></div>`);
      paintPhotos(box);
      box.onclick = async (e) => {
        const photo = e.target.closest('button[data-full]');
        if (photo) {
          try {
            const urls = await signedUrls([photo.dataset.full]);
            if (urls[photo.dataset.full]) openLightbox(urls[photo.dataset.full]);
          } catch (err) { toast(friendlyError(err), 'error'); }
          return;
        }
        const del = e.target.closest('button[data-delete]');
        if (del) {
          const card = del.closest('article');
          const review = reviews.find((v) => v.id === card.dataset.id);
          const ok = await confirmDialog({ title: 'Borrar valoración', message: 'Se borrará tu valoración y sus fotos. Esta acción no se puede deshacer.', okText: 'Borrar', danger: true });
          if (!ok) return;
          try {
            await deleteReview(review.id);
            await removePhotos((review.photos || []).flatMap((p) => [p.path, p.thumb])).catch(() => {});
            toast('Valoración borrada', 'ok');
            ctx.reload();
          } catch (err) { toast(friendlyError(err), 'error'); }
        }
      };
    } catch (err) {
      mount(box, html`<div class="empty"><p>${friendlyError(err)}</p></div>`);
    }
  }
  render();

  return {
    refresh: () => { if (ctx.state.restaurants.some((x) => x.id === id)) render(); else ctx.navigate('#/'); },
    destroy: () => { mapHandle?.destroy(); },
  };
}
