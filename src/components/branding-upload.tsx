import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
export function BrandingUpload({ companyId, kind, label, path, onChange }: { companyId: string; kind: "fonts" | "backgrounds"; label: string; path: string; onChange: (path: string, name: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return; setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Choose a file under 5 MB");
      let blob: Blob = file; let ext = "ttf";
      if (kind === "fonts") {
        if (!/\.(ttf|otf)$/i.test(file.name)) throw new Error("Choose a licensed TTF or OTF font");
        const fontkit = (await import("@pdf-lib/fontkit")).default;
        fontkit.create(new Uint8Array(await file.arrayBuffer())); ext = file.name.toLowerCase().endsWith(".otf") ? "otf" : "ttf";
      } else {
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Choose a PNG, JPG or WebP image");
        const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image processing unavailable"); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
        blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Image processing failed")), "image/jpeg", .8)); ext = "jpg";
      }
      const next = `${companyId}/${kind}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("company-branding").upload(next, blob, { contentType: kind === "fonts" ? "font/ttf" : "image/jpeg", upsert: false });
      if (error) throw error; onChange(next, file.name); toast.success("File uploaded — save to apply");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not upload file"); } finally { setBusy(false); }
  };
  return <div className="space-y-2"><Label>{label}</Label><div className="flex flex-wrap items-center gap-2"><Button variant="outline" asChild disabled={busy}><label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />{busy ? "Uploading…" : path ? "Replace" : "Upload"}<input aria-label={label} disabled={busy} className="sr-only" type="file" accept={kind === "fonts" ? ".ttf,.otf" : "image/png,image/jpeg,image/webp"} onChange={e => { void pick(e.target.files?.[0]); e.target.value = ""; }} /></label></Button>{path && <><span className="text-xs text-muted-foreground">Uploaded</span><Button variant="ghost" size="icon" aria-label={`Remove ${label}`} onClick={() => onChange("", "")}><X className="h-4 w-4" /></Button></>}</div>{kind === "fonts" && <p className="text-xs text-muted-foreground">TTF / OTF · Only fonts licensed for commercial use and document embedding.</p>}</div>;
}