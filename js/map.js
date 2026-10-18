// Mapas con Google Maps Platform. La librería se carga solo cuando hace falta.
// Clave pública restringida por dominio y con cuotas diarias (ver README).
import { GOOGLE_MAPS_API_KEY } from './config.js';
import { toast } from './dom.js';

export const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 }; // Madrid

// Estilo nocturno (se aplica cuando la app está en tema oscuro)
const DARK_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa4b5' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];
const LIGHT_STYLES = [{ featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'simplified' }] }];

const isDark = () => document.documentElement.dataset.theme === 'dark';
const stylesFor = () => (isDark() ? DARK_STYLES : LIGHT_STYLES);
const liveMaps = new Set();
new MutationObserver(() => liveMaps.forEach((m) => m.setOptions({ styles: stylesFor() })))
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

export const isMapsConfigured = typeof GOOGLE_MAPS_API_KEY === 'string' && /^AIza[0-9A-Za-z_-]{20,}$/.test(GOOGLE_MAPS_API_KEY);

let loading = null;
export function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (!isMapsConfigured) return Promise.reject(new Error('Falta la clave de Google Maps en js/config.js'));
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const cb = '__ourtableMapsReady';
    window[cb] = () => { delete window[cb]; resolve(window.google.maps); };
    window.gm_authFailure = () => { toast('Google Maps ha rechazado la clave. Revisa las restricciones de la clave.', 'error', 6000); };
    const script = document.createElement('script');
    const params = new URLSearchParams({ key: GOOGLE_MAPS_API_KEY, v: 'weekly', loading: 'async', language: 'es', region: 'ES', callback: cb });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => { loading = null; reject(new Error('No se pudo cargar Google Maps')); };
    document.head.appendChild(script);
  });
  return loading;
}

export async function createMap(el, { center = DEFAULT_CENTER, zoom = 12, interactive = true } = {}) {
  const gm = await loadGoogleMaps();
  const map = new gm.Map(el, {
    center, zoom,
    disableDefaultUI: true,
    zoomControl: interactive,
    gestureHandling: interactive ? 'greedy' : 'none',
    keyboardShortcuts: interactive,
    clickableIcons: interactive,
    styles: stylesFor(),
    backgroundColor: isDark() ? '#242f3e' : '#e5e3df',
  });
  liveMaps.add(map);
  return { gm, map, destroy: () => { liveMaps.delete(map); gm.event.clearInstanceListeners(map); } };
}

/** Marcador circular de color. */
export function pin(gm, map, position, { color = '#d6336c', radius = 9 } = {}) {
  return new gm.Marker({
    position, map,
    icon: { path: gm.SymbolPath.CIRCLE, scale: radius, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
  });
}

/** Ajusta el mapa a una lista de puntos sin pasarse de zoom. */
export function fitPoints(gm, map, points, maxZoom = 15) {
  if (!points.length) return;
  if (points.length === 1) { map.setCenter(points[0]); map.setZoom(maxZoom); return; }
  const bounds = new gm.LatLngBounds();
  points.forEach((p) => bounds.extend(p));
  map.fitBounds(bounds, 48);
  gm.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > maxZoom) map.setZoom(maxZoom); });
}

function shortAddress(components = [], fallback = '') {
  const get = (type) => components.find((c) => c.types.includes(type))?.long_name;
  const street = [get('route'), get('street_number')].filter(Boolean).join(' ');
  const city = get('locality') || get('postal_town') || get('administrative_area_level_2');
  const parts = [street, city].filter(Boolean);
  return parts.length ? parts.join(', ') : fallback.split(',').slice(0, 2).join(',');
}

/** Busca sitios por nombre o dirección (Places Text Search). */
export async function searchPlaces(query, { near = DEFAULT_CENTER } = {}) {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const gm = await loadGoogleMaps();
  const { Place } = await gm.importLibrary('places');
  const { places } = await Place.searchByText({
    textQuery: q,
    fields: ['displayName', 'formattedAddress', 'location'],
    locationBias: near,
    maxResultCount: 6,
    language: 'es',
    region: 'es',
  });
  return (places || []).map((p) => ({
    id: p.id,
    name: p.displayName || '',
    lat: p.location.lat(),
    lng: p.location.lng(),
    label: [p.displayName, p.formattedAddress].filter(Boolean).join(' · '),
    short: cleanAddress(p.formattedAddress),
  }));
}

const cleanAddress = (a) => (a || '').replace(/,\s*\d{5}\b.*$/, '').replace(/,\s*(España|Spain)$/i, '');

/** Detalles de un sitio (nombre, dirección, ubicación, web, enlace a Google Maps y foto).
 *  Cuenta como "Place Details Enterprise" (por la web): solo se llama al elegir un sitio. */
export async function placeById(placeId) {
  const gm = await loadGoogleMaps();
  const { Place } = await gm.importLibrary('places');
  const place = new Place({ id: placeId });
  await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'websiteURI', 'googleMapsURI', 'photos'] });
  let photoUrl = '';
  try { photoUrl = place.photos?.[0]?.getURI({ maxWidth: 1000, maxHeight: 1000 }) || ''; } catch { /* sin foto */ }
  return {
    id: placeId,
    name: place.displayName || '',
    lat: place.location?.lat(), lng: place.location?.lng(),
    short: cleanAddress(place.formattedAddress),
    website: place.websiteURI || '',
    mapsUrl: place.googleMapsURI || '',
    photoUrl,
  };
}

/** Completa un resultado de búsqueda con sus detalles; si falla, devuelve el resultado tal cual. */
export async function enrichPlace(place) {
  if (!place?.id) return place;
  try { return { ...place, ...(await placeById(place.id)) }; } catch { return place; }
}

export async function reverseGeocode(lat, lng) {
  const gm = await loadGoogleMaps();
  const { results } = await new gm.Geocoder().geocode({ location: { lat, lng }, language: 'es' });
  const r = results?.[0];
  return r ? shortAddress(r.address_components, r.formatted_address) : '';
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
