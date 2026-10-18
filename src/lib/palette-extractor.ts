export async function extractPalette(source: string): Promise<string[]> {
  const image = new Image(); image.src = source; await image.decode();
  const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 96;
  const context = canvas.getContext("2d"); if (!context) return [];
  context.drawImage(image, 0, 0, 96, 96);
  const pixels = context.getImageData(0, 0, 96, 96).data; const counts = new Map<string, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0, g = pixels[i + 1] ?? 0, b = pixels[i + 2] ?? 0;
    if ((pixels[i + 3] ?? 0) < 180 || Math.max(r, g, b) < 40 || Math.min(r, g, b) > 220 || Math.max(r, g, b) - Math.min(r, g, b) < 25) continue;
    const hex = "#" + [r, g, b].map((c) => Math.min(255, Math.round(c / 32) * 32).toString(16).padStart(2, "0")).join("");
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([hex]) => hex);
}