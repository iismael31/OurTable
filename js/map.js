// Mapas con Leaflet + OpenStreetMap. La librería se carga solo cuando hace falta.
const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
const CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
export const DEFAULT_CENTER = [40.4168, -3.7038]; // Madrid

let loading = null;

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${LEAFLET}leaflet.css`;
    link.integrity = CSS_SRI;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = `${LEAFLET}leaflet.js`;
    script.integrity = JS_SRI;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(window.L);
    script.onerror = () => { loading = null; reject(new Error('No se pudo cargar el mapa')); };
    document.head.appendChild(script);
  });
  return loading;
}

export async function createMap(el, { center = DEFAULT_CENTER, zoom = 12, interactive = true } = {}) {
  const L = await loadLeaflet();
  const map = L.map(el, {
    center, zoom,
    zoomControl: interactive, dragging: interactive, scrollWheelZoom: interactive, touchZoom: interactive,
    doubleClickZoom: interactive, boxZoom: false, keyboard: interactive, tap: interactive,
  });
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
  // Si el contenedor cambia de tamaño (giro del móvil, barra del navegador), recalcular.
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    map.on('remove', () => ro.disconnect());
  }
  return { L, map };
}

export function pin(L, latlng, { color = '#d6336c', radius = 9 } = {}) {
  return L.circleMarker(latlng, { radius, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 1 });
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';

async function nominatim(path, params) {
  const url = new URL(`${NOMINATIM}/${path}`);
  url.search = new URLSearchParams({ format: 'jsonv2', 'accept-language': 'es', ...params }).toString();
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('El servicio de direcciones no responde');
  return res.json();
}

function shortAddress(item) {
  const a = item.address || {};
  const street = [a.road || a.pedestrian || a.square, a.house_number].filter(Boolean).join(' ');
  const city = a.city || a.town || a.village || a.municipality || a.county;
  const parts = [street, city].filter(Boolean);
  return parts.length ? parts.join(', ') : (item.display_name || '').split(',').slice(0, 3).join(',');
}

export async function geocode(query) {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const data = await nominatim('search', { q, limit: '6', addressdetails: '1' });
  return data.map((d) => ({ lat: Number(d.lat), lng: Number(d.lon), label: d.display_name, short: shortAddress(d) }));
}

export async function reverseGeocode(lat, lng) {
  const d = await nominatim('reverse', { lat: String(lat), lon: String(lng), addressdetails: '1', zoom: '18' });
  return d && !d.error ? shortAddress(d) : '';
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Tu dispositivo no permite la geolocalización'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('No se pudo obtener tu ubicación')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}
