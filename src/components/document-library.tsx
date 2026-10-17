import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const BUCKET = "company-documents";

export const DOC_CATEGORIES = [
  { value: "checklist", label: "Checklist", hint: "Inspection & service checklists — used to auto-build job sheet checklists" },
  { value: "contract", label: "Contract", hint: "Maintenance agreements — used to auto-fill contract details" },
  { value: "terms", label: "Terms & conditions", hint: "T&C documents — used as presets on job sheets, estimates and agreements" },
  { value: "other", label: "Other", hint: "Any other reference document" },
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number]["value"];

type Doc = {
  id: string;
  category: DocCategory;
  name: string;
  file_path: string;
  file_size: number;
  notes: string | null;
  created_at: string;
};

const fmtSize = (b: number) => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);

export function DocumentLibrary({ companyId, userId }: { companyId: string; userId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<DocCategory>("checklist");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Doc | null>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["company-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error("File is larger than 20 MB"); return; }
    setBusy(true);
    const safe = file.name.replace(/[^\w.\- ]+/g, "_");
    const path = `${companyId}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }
    const { error } = await supabase.from("company_documents").insert({
      company_id: companyId, category, name: file.name, file_path: path, file_size: file.size, notes: notes.trim() || null, uploaded_by: userId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Document uploaded");
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["company-documents"] });
  };

  const open = async (d: Doc) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.file_path, 300);
    if (error || !data) { toast.error(error?.message ?? "Could not open file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("company_documents").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    await supabase.storage.from(BUCKET).remove([deleting.file_path]);
    toast.success("Document removed");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["company-documents"] });
  };

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-medium text-foreground">Document library</h2>
        <p className="text-sm text-muted-foreground">
          Upload your existing checklists, contracts and terms &amp; conditions. These become the source documents the app
          uses to auto-fill checklists, contract details and T&amp;C presets.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-dashed p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Document type</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocCategory)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{DOC_CATEGORIES.find((c) => c.value === category)?.hint}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input className="h-11" placeholder="e.g. Gold tier checklist, 2026 version" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />
          <Button type="button" className="h-11" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {busy ? "Uploading…" : "Upload document"}
          </Button>
          <p className="text-xs text-muted-foreground">PDF, Word or image, up to 20 MB</p>
        </div>
      </div>

      <div className="space-y-2">
        {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{d.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {DOC_CATEGORIES.find((c) => c.value === d.category)?.label} · {fmtSize(d.file_size)}
                {d.notes ? ` · ${d.notes}` : ""}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void open(d)}>
              <Download className="mr-1 h-4 w-4" />Open
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => setDeleting(d)} aria-label={`Delete ${d.name}`}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete document?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            “{deleting?.name}” will be permanently removed from the document library.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void remove()}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
