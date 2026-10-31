import type { PdfTemplate } from './documents';

/** Portable processing keeps screen, print and PDF backgrounds identical. */
export async function tonedBackground(data: string, t: PdfTemplate): Promise<string> {
  if (!data || (t.backgroundTone !== 'grayscale' && (t.backgroundBrightness ?? 1) === 1)) return data;
  if (!data.startsWith('data:image/jpeg')) return data;
  const jpeg = await import('jpeg-js');
  const bytes = Uint8Array.from(atob(data.split(',')[1] ?? ''), c => c.charCodeAt(0));
  const image = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 128 });
  const brightness = t.backgroundBrightness ?? 1;
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i] ?? 0, g = image.data[i + 1] ?? 0, b = image.data[i + 2] ?? 0;
    const grey = .2126 * r + .7152 * g + .0722 * b;
    image.data[i] = Math.min(255, Math.round((t.backgroundTone === 'grayscale' ? grey : r) * brightness));
    image.data[i + 1] = Math.min(255, Math.round((t.backgroundTone === 'grayscale' ? grey : g) * brightness));
    image.data[i + 2] = Math.min(255, Math.round((t.backgroundTone === 'grayscale' ? grey : b) * brightness));
  }
  const result = jpeg.encode(image, 85).data;
  let binary = ''; for (let i = 0; i < result.length; i += 8192) binary += String.fromCharCode(...result.subarray(i, i + 8192));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}