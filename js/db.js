// Acceso a datos. Todas las operaciones pasan por Supabase con RLS activo:
// el servidor comprueba quién puede leer o modificar cada fila.
import { supabase } from './supabase.js';

const LITE_COLS = 'id,restaurant_id,author_id,visit_date,rating,price_per_person,would_return,photos,created_at';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export async function loadAll() {
  const [profiles, restaurants, reviews] = await Promise.all([
    supabase.from('profiles').select('id,display_name,color'),
    supabase.from('restaurants').select('*').order('created_at', { ascending: false }),
    supabase.from('reviews').select(LITE_COLS).order('visit_date', { ascending: false }).order('created_at', { ascending: false }),
  ]);
  return { profiles: unwrap(profiles), restaurants: unwrap(restaurants), reviews: unwrap(reviews) };
}

export const fetchReviews = (restaurantId) =>
  supabase.from('reviews').select('*').eq('restaurant_id', restaurantId)
    .order('visit_date', { ascending: false }).order('created_at', { ascending: false }).then(unwrap);

export const fetchReview = (id) => supabase.from('reviews').select('*').eq('id', id).single().then(unwrap);

export const createRestaurant = (data) => supabase.from('restaurants').insert(data).select().single().then(unwrap);
export const updateRestaurant = (id, data) => supabase.from('restaurants').update(data).eq('id', id).select().single().then(unwrap);
export const deleteRestaurant = (id) => supabase.from('restaurants').delete().eq('id', id).then(unwrap);

export const createReview = (data) => supabase.from('reviews').insert(data).select().single().then(unwrap);
export const updateReview = (id, data) => supabase.from('reviews').update(data).eq('id', id).select().single().then(unwrap);
export const deleteReview = (id) => supabase.from('reviews').delete().eq('id', id).then(unwrap);

export const updateProfile = (id, data) => supabase.from('profiles').update(data).eq('id', id).select().single().then(unwrap);

// ---------- Fotos (bucket privado, URLs firmadas temporales) ----------
const BUCKET = 'photos';
const TTL_S = 3600;
const urlCache = new Map(); // path -> { url, exp }

export async function signedUrls(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  const now = Date.now();
  const missing = unique.filter((p) => !(urlCache.get(p)?.exp > now + 60_000));
  if (missing.length) {
    const data = unwrap(await supabase.storage.from(BUCKET).createSignedUrls(missing, TTL_S));
    for (const item of data) if (item.signedUrl) urlCache.set(item.path, { url: item.signedUrl, exp: now + TTL_S * 1000 });
  }
  return Object.fromEntries(unique.map((p) => [p, urlCache.get(p)?.url ?? '']));
}

export async function uploadPhoto(path, blob) {
  unwrap(await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }));
}

export async function removePhotos(paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  unwrap(await supabase.storage.from(BUCKET).remove(list));
  for (const p of list) urlCache.delete(p);
}

// ---------- Tiempo real ----------
export function subscribeChanges(onChange) {
  const channel = supabase
    .channel('cambios-compartidos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
