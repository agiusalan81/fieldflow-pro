import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DOC_CATEGORIES, type DocCategory } from "@/components/document-library";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompanyTitle } from "@/lib/company-name";

type LibraryDoc = { id: string; name: string; category: DocCategory };

/** "Import from document library" button + picker. onPick receives the document id and should run the extraction. */
export function LibraryImport({ onPick, label: rawLabel = "Import from document library" }: {
  label?: string;
  onPick: (documentId: string) => Promise<void>;
}) {
  const libraryName = useCompanyTitle("document library");
  const label = rawLabel.replace(/document library/i, libraryName);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: docs = [] } = useQuery({
    queryKey: ["company-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_documents").select("id, name, category").order("created_at", { ascending: false });
      if (error) throw error;
      return data as LibraryDoc[];
    },
  });
  const pick = async (id: string) => {
    setBusy(true);
    try { await onPick(id); setOpen(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not read that document"); }
    setBusy(false);
  };
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileUp className="mr-1 h-4 w-4" />{label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) setOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Pick a document — the app will read it and fill in the form so you can review before saving.</p>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents in the library yet. Upload one in Company settings → {libraryName} first.</p>}
            {docs.map((doc) => (
              <button key={doc.id} type="button" disabled={busy} onClick={() => void pick(doc.id)}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{doc.name}</span>
                  <span className="block text-xs text-muted-foreground">{DOC_CATEGORIES.find((c) => c.value === doc.category)?.label ?? doc.category}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
