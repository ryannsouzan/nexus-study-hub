export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const MAX_STORED_COVER_BYTES = 2 * 1024 * 1024;
export const COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type CoverMime = (typeof COVER_TYPES)[number];
export type CoverAsset = { id: string; blob: Blob; mime: CoverMime; width: number; height: number };
export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (blob.arrayBuffer) return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsArrayBuffer(blob);
  });
}
export function detectedMime(bytes: Uint8Array): CoverMime | null {
  if (bytes.length > 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return 'image/png';
  if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return 'image/jpeg';
  if (
    bytes.length > 16 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}
export function validateCoverFile(file: Blob) {
  if (!COVER_TYPES.includes(file.type as CoverMime))
    throw new Error('Escolha uma imagem PNG, JPEG ou WebP.');
  if (!file.size || file.size > MAX_COVER_BYTES)
    throw new Error('A imagem deve ter conteúdo e no máximo 5 MB.');
}
export async function decodeCover(
  blob: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    }
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  } catch {
    throw new Error('A imagem está corrompida ou não pôde ser lida. Escolha outro arquivo.');
  }
}
export function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function base64ToBytes(value: string) {
  if (
    !value ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  )
    throw new Error('A imagem do backup contém codificação inválida.');
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
export async function coverHash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function prepareCoverAsset(blob: Blob): Promise<CoverAsset> {
  validateCoverFile(blob);
  if (blob.size > MAX_STORED_COVER_BYTES)
    throw new Error('A capa otimizada deve ter no máximo 2 MB.');
  const bytes = await blobBytes(blob);
  const mime = detectedMime(bytes);
  if (!mime || mime !== blob.type)
    throw new Error('O conteúdo da imagem não corresponde ao formato informado.');
  const decoded = await decodeCover(blob);
  try {
    if (decoded.width < 1 || decoded.height < 1 || decoded.width > 800 || decoded.height > 1200)
      throw new Error('A capa deve ter dimensões de até 800 × 1200 pixels.');
    return { id: await coverHash(bytes), blob, mime, width: decoded.width, height: decoded.height };
  } finally {
    decoded.close();
  }
}
export async function optimizeCover(file: Blob): Promise<Blob> {
  validateCoverFile(file);
  const bytes = await blobBytes(file);
  if (detectedMime(bytes) !== file.type)
    throw new Error('O arquivo não contém uma imagem válida no formato informado.');
  const decoded = await decodeCover(file);
  try {
    if (!decoded.width || !decoded.height || decoded.width * decoded.height > 40000000)
      throw new Error('A imagem deve ter no máximo 40 megapixels.');
    const scale = Math.min(1, 800 / decoded.width, 1200 / decoded.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Este navegador não permite otimizar imagens.');
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82));
    const blob = (await encode('image/webp')) ?? (await encode('image/png'));
    if (!blob || blob.size > MAX_STORED_COVER_BYTES)
      throw new Error('Não foi possível otimizar a capa para até 2 MB. Escolha uma imagem menor.');
    return blob;
  } finally {
    decoded.close();
  }
}
