import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

/** Tap-to-pick clock: choose an hour, then a quarter hour. No scroll wheels. */
export function TimePicker({ value, onChange, disabled, label }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; label: string;
}) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState<number | null>(null);
  const [h = 8, m = 0] = (value || "08:00").split(":").map(Number);
  const pick = (hh: number, mm: number) => {
    onChange(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    setHour(null);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setHour(null); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} aria-label={label} className="h-11 w-full justify-start font-mono text-base font-normal">
          <Clock className="mr-2 h-4 w-4 opacity-60" />
          {value || "--:--"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        {hour === null ? (
          <>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{label} — hour</p>
            <div className="grid grid-cols-6 gap-1">
              {HOURS.map((hh) => (
                <Button key={hh} type="button" size="sm" variant={hh === h ? "default" : "ghost"} className="h-9 px-0 tabular-nums"
                  onClick={() => setHour(hh)}>{String(hh).padStart(2, "0")}</Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{label} — minutes after {String(hour).padStart(2, "0")}</p>
            <div className="grid grid-cols-4 gap-1">
              {MINUTES.map((mm) => (
                <Button key={mm} type="button" size="sm" variant={hour === h && mm === m ? "default" : "outline"} className={cn("h-10 px-0 tabular-nums")}
                  onClick={() => pick(hour, mm)}>:{String(mm).padStart(2, "0")}</Button>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setHour(null)}>Back to hours</Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
