/** Builds a branded QR sticker (title, QR with centre logo, company footer) as a PNG data URL. */
export async function brandedQr(url: string, logo?: string | undefined, size = 600): Promise<string> {
  const qr = await import("qrcode");
  const canvas = document.createElement("canvas");
  // High error correction so a centre logo (≤ ~22% width) still scans.
  await qr.toCanvas(canvas, url, { errorCorrectionLevel: "H", width: size, margin: 1 });
  if (!logo) return canvas.toDataURL("image/png");
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  const img = await loadImage(logo).catch(() => null);
  if (img) {
    const box = Math.round(size * 0.22), x = (size - box) / 2, pad = Math.round(box * 0.1);
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x, x, box, box, box * 0.18); ctx.fill();
    const inner = box - pad * 2, r = Math.min(inner / img.width, inner / img.height);
    const w = img.width * r, h = img.height * r;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  }
  return canvas.toDataURL("image/png");
}
function loadImage(src: string) { return new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = no; i.src = src; }); }
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
