import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function SignaturePad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = getComputedStyle(c).color;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        className="h-[55dvh] min-h-64 w-full touch-none rounded-lg border border-dashed bg-card text-foreground sm:h-56"
        onPointerDown={(e) => {
          drawing.current = true;
          ref.current!.setPointerCapture(e.pointerId);
          const ctx = ref.current!.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current!.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          onChange(ref.current!.toDataURL("image/png"));
        }}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Customer signs above</span>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => {
            const c = ref.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            onChange(null);
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
