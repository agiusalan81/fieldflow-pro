import { useEffect, useRef, useState } from "react";
import { Undo2, Trash2, Minus, PenLine, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { straighten } from "@/lib/lift-rfq";

type P = { x: number; y: number };
type Stroke = { kind: "line"; pts: P[] } | { kind: "text"; at: P; text: string };

/** Full-screen freehand sketch (like the signature box). Nearly straight strokes snap straight; "Line" mode always draws straight. */
export function SketchPad({ open, initial, onClose, onSave }: { open: boolean; initial?: string | null; onClose: () => void; onSave: (png: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [mode, setMode] = useState<"pen" | "line" | "text">("pen");
  const cur = useRef<P[] | null>(null);
  const bg = useRef<HTMLImageElement | null>(null);

  const draw = (extra?: P[]) => {
    const c = ref.current; if (!c) return; const g = c.getContext("2d")!; const dpr = window.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); const w = c.width / dpr, h = c.height / dpr;
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#e5e7eb"; g.lineWidth = 1; for (let x = 0; x < w; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    if (bg.current) g.drawImage(bg.current, 0, 0, w, h);
    g.strokeStyle = "#111827"; g.fillStyle = "#111827"; g.lineWidth = 2.5; g.lineCap = "round"; g.lineJoin = "round"; g.font = "16px sans-serif";
    for (const s of [...strokes, ...(extra ? [{ kind: "line", pts: extra } as Stroke] : [])]) {
      if (s.kind === "text") { g.fillText(s.text, s.at.x, s.at.y); continue; }
      g.beginPath(); s.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
    }
  };

  useEffect(() => {
    if (!open) return; setStrokes([]); bg.current = null;
    const t = setTimeout(() => {
      const c = ref.current; if (!c) return; const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr; c.height = r.height * dpr;
      if (initial) { const img = new Image(); img.onload = () => { bg.current = img; draw(); }; img.src = initial; } else draw();
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => draw(), [strokes]);

  const pos = (e: React.PointerEvent): P => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => {
    if (mode === "text") { const at = pos(e); const text = window.prompt("Text or dimension (e.g. 1650 mm, CW rear, Door A)"); if (text) setStrokes((s) => [...s, { kind: "text", at, text }]); return; }
    (e.target as HTMLElement).setPointerCapture(e.pointerId); cur.current = [pos(e)];
  };
  const move = (e: React.PointerEvent) => { if (!cur.current) return; const p = pos(e); cur.current = mode === "line" ? [cur.current[0], p] : [...cur.current, p]; draw(cur.current); };
  const up = () => { const pts = cur.current; cur.current = null; if (!pts || pts.length < 2) return; setStrokes((s) => [...s, { kind: "line", pts: mode === "line" ? pts : straighten(pts) }]); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-2 rounded-none p-2 sm:rounded-none">
        <DialogTitle className="sr-only">Layout sketch</DialogTitle>
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <Button size="sm" variant={mode === "pen" ? "default" : "outline"} onClick={() => setMode("pen")}><PenLine className="mr-1 h-4 w-4" />Pen</Button>
          <Button size="sm" variant={mode === "line" ? "default" : "outline"} onClick={() => setMode("line")}><Minus className="mr-1 h-4 w-4" />Line</Button>
          <Button size="sm" variant={mode === "text" ? "default" : "outline"} onClick={() => setMode("text")}><Type className="mr-1 h-4 w-4" />Text</Button>
          <Button size="sm" variant="outline" onClick={() => setStrokes((s) => s.slice(0, -1))}><Undo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => { bg.current = null; setStrokes([]); }}><Trash2 className="h-4 w-4" /></Button>
          <Button size="sm" className="ml-auto" onClick={() => { const c = ref.current; if (c) onSave(c.toDataURL("image/png")); onClose(); }}>Done</Button>
        </div>
        <canvas ref={ref} className="min-h-0 w-full flex-1 touch-none rounded border" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      </DialogContent>
    </Dialog>
  );
}
