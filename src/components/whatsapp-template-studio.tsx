import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, MESSAGE_TYPES, previewDraft, validateDraft, variableCount, type WaDraft } from "@/lib/whatsapp-templates";
import { draftWhatsAppTemplate, listWhatsAppTemplates, submitWhatsAppTemplate } from "@/lib/whatsapp-templates.functions";

const STATUS: Record<string, "default" | "secondary" | "destructive" | "outline"> = { APPROVED: "default", PENDING: "secondary", REJECTED: "destructive" };

export function WhatsAppTemplateStudio() {
  const qc = useQueryClient();
  const draftFn = useServerFn(draftWhatsAppTemplate);
  const submitFn = useServerFn(submitWhatsAppTemplate);
  const listFn = useServerFn(listWhatsAppTemplates);
  const list = useQuery({ queryKey: ["wa-templates"], queryFn: () => listFn(), retry: false });
  const [type, setType] = useState<string>("on_my_way");
  const [language, setLanguage] = useState("en");
  const [wording, setWording] = useState("");
  const [draft, setDraft] = useState<WaDraft | null>(null);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const mt = MESSAGE_TYPES.find((m) => m.key === type) ?? MESSAGE_TYPES[0]!;

  const makeDraft = async () => {
    setBusy("draft");
    try { const r = await draftFn({ data: { wording, type: mt.label, category: mt.category, language } }); setDraft(r.draft); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const submit = async () => {
    if (!draft) return;
    setBusy("submit");
    try { await submitFn({ data: draft }); toast.success("Sent to Meta for review. Approval usually takes minutes to a few hours."); setDraft(null); setWording(""); qc.invalidateQueries({ queryKey: ["wa-templates"] }); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const problems = draft ? validateDraft(draft) : [];
  const n = draft ? variableCount(draft.body) : 0;
  const setBody = (body: string) => draft && setDraft({ ...draft, body, examples: Array.from({ length: variableCount(body) }, (_, i) => draft.examples[i] ?? "") });

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div><h2 className="font-medium text-foreground">WhatsApp message templates</h2>
        <p className="text-sm text-muted-foreground">Write the message in your own words. AI turns it into a template Meta accepts, then you review it and send it for approval.</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1"><Label>Message type</Label>
          <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MESSAGE_TYPES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Language</Label>
          <Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="space-y-1"><Label>Your wording</Label>
        <Textarea rows={3} value={wording} onChange={(e) => setWording(e.target.value)} placeholder="Hi Alan, technician Jorey Gloria is on the way. Should be there in approximately 30 mins depending on traffic." /></div>
      <Button onClick={makeDraft} disabled={busy !== null || wording.trim().length < 5}><Sparkles className="mr-1 h-4 w-4" />{busy === "draft" ? "Drafting…" : "Draft for Meta review"}</Button>

      {draft && (
        <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <div className="space-y-3">
            {draft.notes && <p className="text-sm text-muted-foreground">{draft.notes}</p>}
            <div className="space-y-1"><Label>Template name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Template text</Label><Textarea rows={5} value={draft.body} onChange={(e) => setBody(e.target.value)} />
              <p className="text-xs text-muted-foreground">{"{{1}}"}, {"{{2}}"}… are filled in automatically when each message is sent.</p></div>
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="space-y-1"><Label>Sample for {`{{${i + 1}}}`}</Label>
                <Input value={draft.examples[i] ?? ""} onChange={(e) => { const ex = [...draft.examples]; ex[i] = e.target.value; setDraft({ ...draft, examples: ex }); }} /></div>
            ))}
            {problems.length > 0 && <ul className="list-disc pl-5 text-sm text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            <div className="flex gap-2">
              <Button onClick={submit} disabled={busy !== null || problems.length > 0}><Send className="mr-1 h-4 w-4" />{busy === "submit" ? "Sending…" : "Submit to Meta"}</Button>
              <Button variant="outline" onClick={() => setDraft(null)}>Discard</Button>
            </div>
          </div>
          <div className="space-y-1"><Label>What the client sees</Label>
            <div className="rounded-xl bg-muted p-4"><div className="max-w-xs whitespace-pre-wrap rounded-lg bg-background p-3 text-sm shadow-sm">{previewDraft(draft)}</div></div></div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-sm font-medium">Templates on Meta</h3>
          <Button size="sm" variant="ghost" onClick={() => list.refetch()}><RefreshCw className="mr-1 h-3 w-3" />Refresh</Button></div>
        {list.isError && <p className="text-sm text-destructive">{(list.error as Error).message}</p>}
        {list.data?.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
        {list.data?.map((t) => (
          <div key={`${t.name}-${t.language}`} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.name}</span><Badge variant="outline">{t.language}</Badge><Badge variant={STATUS[t.status] ?? "outline"}>{t.status}</Badge></div>
            <p className="mt-1 text-muted-foreground">{t.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
