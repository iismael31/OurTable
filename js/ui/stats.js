import { html, mount, starsView, fmtPrice, initials } from '../dom.js';

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const fmt1 = (n) => (n == null ? '—' : n.toFixed(1).replace('.', ','));

export function statsView(ctx) {
  ctx.setTopbar(html`<h1>Resumen</h1>`);
  const { reviews, profiles, summaries } = ctx.state;
  const wishCount = ctx.state.restaurants.filter((r) => r.want_to_go).length;
  const restaurants = ctx.state.restaurants.filter((r) => !r.want_to_go);

  if (!reviews.length) {
    mount(ctx.main, html`<div class="empty"><div class="emoji">📊</div><h2>Aún no hay datos</h2><p>Cuando tengáis valoraciones, aquí veréis vuestro resumen.</p></div>`);
    return;
  }

  const ratings = reviews.map((v) => v.rating);
  const prices = reviews.map((v) => v.price_per_person).filter((p) => p != null).map(Number);
  const decided = reviews.filter((v) => v.would_return != null);
  const yes = decided.filter((v) => v.would_return).length;

  const top = restaurants
    .map((r) => ({ r, s: summaries.get(r.id) }))
    .filter(({ s }) => s.count)
    .sort((a, b) => b.s.avg - a.s.avg || b.s.count - a.s.count)
    .slice(0, 5);

  const mostVisited = restaurants
    .map((r) => ({ r, s: summaries.get(r.id) }))
    .filter(({ s }) => s.count > 1)
    .sort((a, b) => b.s.count - a.s.count)
    .slice(0, 5);

  const cuisineCount = new Map();
  for (const r of restaurants) {
    const c = (r.cuisine || 'Sin tipo').trim();
    cuisineCount.set(c, (cuisineCount.get(c) || 0) + 1);
  }
  const cuisines = [...cuisineCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxC = cuisines[0]?.[1] || 1;

  const byAuthor = profiles.map((p) => {
    const mine = reviews.filter((v) => v.author_id === p.id);
    return { p, n: mine.length, avg: avg(mine.map((v) => v.rating)) };
  });

  mount(ctx.main, html`
    <div class="stats-grid">
      <div class="stat"><div class="v">${restaurants.length}</div><div class="l">Sitios visitados</div></div>
      <div class="stat"><div class="v">${wishCount}</div><div class="l">Pendientes</div></div>
      <div class="stat"><div class="v">${reviews.length}</div><div class="l">Valoraciones</div></div>
      <div class="stat"><div class="v">${reviews.reduce((a, v) => a + (v.photos?.length || 0), 0)}</div><div class="l">Fotos</div></div>
      <div class="stat"><div class="v">${fmt1(avg(ratings))} ★</div><div class="l">Nota media</div></div>
      <div class="stat"><div class="v">${prices.length ? fmtPrice(avg(prices)) : '—'}</div><div class="l">Precio medio / pers.</div></div>
    </div>

    <section class="form-section">
      <h2>¿Volveríamos?</h2>
      ${decided.length
        ? html`<div class="bar-row"><span>Sí, repetiríamos</span><div class="bar"><i style="--p:${(yes / decided.length).toFixed(2)}"></i></div><span class="n">${Math.round((yes / decided.length) * 100)}%</span></div>`
        : html`<p class="help">Todavía no habéis marcado si volveríais.</p>`}
    </section>

    <section class="form-section">
      <h2>Top 5 mejor valorados</h2>
      <ol class="rank">${top.map(({ r, s }, i) => html`<li><span class="pos">${i + 1}</span><a class="name" href="#/r/${r.id}">${r.name}</a>${starsView(s.avg, 'sm')}<strong>${fmt1(s.avg)}</strong></li>`)}</ol>
    </section>

    ${mostVisited.length ? html`
    <section class="form-section">
      <h2>Los que más repetís</h2>
      <ol class="rank">${mostVisited.map(({ r, s }, i) => html`<li><span class="pos">${i + 1}</span><a class="name" href="#/r/${r.id}">${r.name}</a><span class="help">${s.count} visitas</span></li>`)}</ol>
    </section>` : ''}

    <section class="form-section">
      <h2>Tipos de cocina</h2>
      <div class="bar-list">${cuisines.map(([c, n]) => html`<div class="bar-row"><span>${c}</span><div class="bar"><i style="--p:${(n / maxC).toFixed(2)}"></i></div><span class="n">${n}</span></div>`)}</div>
    </section>

    <section class="form-section">
      <h2>Quién valora más</h2>
      <ol class="rank">${byAuthor.map(({ p, n, avg: a }) => html`<li><span class="avatar" style="--who:${p.color}">${initials(p.display_name)}</span><span class="name">${p.display_name}</span><span class="help">${n} ${n === 1 ? 'valoración' : 'valoraciones'}</span><strong>${fmt1(a)} ★</strong></li>`)}</ol>
    </section>
  `);
}
