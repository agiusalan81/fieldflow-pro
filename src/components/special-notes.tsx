import { StickyNote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parsePresets } from "@/lib/documents";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { VoiceDictation } from "@/components/voice-dictation";
import { Button } from "@/components/ui/button";

type NotesForm = { special_notes?: string | boolean | null; special_notes_in_pdf?: string | boolean | null; special_notes_in_email?: string | boolean | null };

/** Pre-send note for the client copy; office presets fill it in, technician can edit. */
export function SpecialNotes({ form, set, readOnly }: { form: NotesForm; set: (p: NotesForm) => void; readOnly: boolean }) {
  const { data: presets = [] } = useQuery({
    queryKey: ["note-presets"],
    queryFn: async () => parsePresets((await supabase.from("company_settings").select("note_presets").maybeSingle()).data?.note_presets),
  });
  const text = (form.special_notes as string) ?? "";
  const enabled = form.special_notes != null;
  const setEnabled = (v: boolean) => set({ special_notes: v ? text : null });
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-medium text-foreground"><StickyNote className="h-4 w-4" />Special notes for the client</h2>
        <Switch aria-label="Add special notes" checked={enabled} disabled={readOnly} onCheckedChange={setEnabled} />
      </div>
      {enabled && (
        <div className="mt-3 space-y-3">
          {presets.length > 0 && !readOnly && (
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => <Button key={p.label} type="button" size="sm" variant="outline" onClick={() => set({ special_notes: [text.trim(), p.text].filter(Boolean).join("\n\n") })}>{p.label}</Button>)}
            </div>
          )}
          <Textarea rows={3} disabled={readOnly} placeholder="e.g. Warranty on replaced parts is 12 months." value={text} onChange={(e) => set({ special_notes: e.target.value })} />
          <VoiceDictation label="special notes" disabled={readOnly} value={text} onApply={(t) => set({ special_notes: t })} />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><Checkbox disabled={readOnly} checked={form.special_notes_in_pdf !== false} onCheckedChange={(c) => set({ special_notes_in_pdf: !!c })} />Include in client PDF</label>
            <label className="flex items-center gap-2"><Checkbox disabled={readOnly} checked={form.special_notes_in_email === true} onCheckedChange={(c) => set({ special_notes_in_email: !!c })} />Include in email</label>
          </div>
        </div>
      )}
    </section>
  );
}
