// Pestañas de la pantalla "Añadir": nueva valoración o sitio al que queremos ir.
import { html } from '../dom.js';

export function addTabs(active) {
  return html`
    <nav class="segmented add-tabs" aria-label="Qué añadir">
      <a href="#/new" aria-pressed="${active === 'review'}">⭐ Nueva valoración</a>
      <a href="#/wish" aria-pressed="${active === 'wish'}">📌 Quiero ir</a>
    </nav>`;
}
