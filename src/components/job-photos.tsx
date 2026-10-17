import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { JobPhoto } from "@/lib/jobsheets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const BUCKET = "job-photos";

/** Downscale to max 1600px JPEG so uploads are fast on site. */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob((b) => r(b ?? file), "image/jpeg", 0.8));
  } catch {
    return file;
  }
}

const KIND_LABEL: Record<JobPhoto["kind"], string> = { damage: "Damage", part: "Part replaced", other: "Photo" };

type Props = {
  companyId: string;
  sheetId: string;
  photos: JobPhoto[];
  /** Which photos this strip shows and creates. */
  scope: JobPhoto["scope"];
  day: number | null;
  readOnly?: boolean;
  onChange: (next: JobPhoto[]) => Promise<void> | void;
};

export function JobPhotos({ companyId, sheetId, photos, scope, day, readOnly, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<JobPhoto["kind"]>(scope === "work" ? "damage" : "other");
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const mine = photos.filter((p) => p.scope === scope && p.day === day);

  useEffect(() => {
    const missing = mine.map((p) => p.path).filter((p) => !urls[p]);
    if (!missing.length) return;
    supabase.storage.from(BUCKET).createSignedUrls(missing, 3600).then(({ data }) => {
      if (!data) return;
      setUrls((u) => ({ ...u, ...Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl])) }));
    });
  }, [mine.map((p) => p.path).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const added: JobPhoto[] = [];
    try {
      for (const f of Array.from(files)) {
        const blob = await compress(f);
        const path = `${companyId}/${sheetId}/${scope}-${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        added.push({ path, scope, kind, day });
      }
      await onChange([...photos, ...added]);
      toast.success(`${added.length} photo${added.length > 1 ? "s" : ""} added`);
    } catch (e) {
      if (added.length) await onChange([...photos, ...added]);
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async (path: string) => {
    await supabase.storage.from(BUCKET).remove([path]);
    await onChange(photos.filter((p) => p.path !== path));
  };

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          {scope === "work" && (
            <div className="flex overflow-hidden rounded-md border text-xs">
              {(["damage", "part"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`h-8 px-2.5 ${kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{KIND_LABEL[k]}</button>
              ))}
            </div>
          )}
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
            {scope === "work" ? "Add photos" : "Add photos (internal)"}
          </Button>
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        </div>
      )}
      {mine.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mine.map((p) => (
            <div key={p.path} className="relative">
              <button type="button" onClick={() => setOpen(p.path)} className="block h-20 w-20 overflow-hidden rounded-md border bg-muted">
                {urls[p.path] && <img src={urls[p.path]} alt={KIND_LABEL[p.kind]} className="h-full w-full object-cover" />}
              </button>
              <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1 text-[10px]">{KIND_LABEL[p.kind]}</span>
              {!readOnly && (
                <button type="button" aria-label="Remove photo" onClick={() => remove(p.path)}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {open && urls[open] && <img src={urls[open]} alt="Job photo" className="max-h-[80vh] w-full rounded object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
