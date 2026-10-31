export const QR_PHOTO_LIMIT = 2 * 1024 * 1024;
export function validateQrPhoto(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes.length > QR_PHOTO_LIMIT || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error('Choose a JPEG photo up to 2 MB.');
}
export async function prepareQrPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) throw new Error('Choose an image up to 20 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(bitmap.width * scale)); canvas.height = Math.max(1,Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Photo processing unavailable.');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,'image/jpeg',0.8));
    if (!blob || blob.size > QR_PHOTO_LIMIT) throw new Error('Choose a smaller photo.');
    return await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Photo could not be opened.')); reader.readAsDataURL(blob); });
  } finally { bitmap.close(); }
}