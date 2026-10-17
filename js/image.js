// Compresión de fotos en el propio móvil antes de subirlas.
// Se generan dos tamaños: completa (máx. 1600 px) y miniatura (máx. 480 px).
const FULL_SIDE = 1600;
const THUMB_SIDE = 480;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

function draw(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve({ blob: b, width: w, height: h }) : reject(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', quality)
  );
}

export async function processPhoto(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
  const img = await loadImage(file);
  const full = await draw(img, FULL_SIDE, 0.82);
  const thumb = await draw(img, THUMB_SIDE, 0.78);
  return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
}
