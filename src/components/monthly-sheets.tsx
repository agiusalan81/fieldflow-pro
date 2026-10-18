import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PenLine, Download, Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { monthlyGroups, unsignedQueue, type MonthlySheet } from "@/lib/monthly-signing";
import { startMonthlySigning, signMonthlySheet, finishMonthlySigning, combinedJobSheets } from "@/lib/sendJobSheetEmail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { termsFor, parseTerms } from "@/lib/documents";
type Batch = Awaited<ReturnType<typeof startMonthlySigning>>;

export function MonthlySheets<T extends MonthlySheet>({ sheets, office }: { sheets: T[]; office: boolean }) {
  const [session, setSession] = useState<Batch | null>(null);
  const [busy, setBusy] = useState(false);
  const start = useServerFn(startMonthlySigning);
  const combine = useServerFn(combinedJobSheets);
  const { data: batches = [] } = useQuery({ queryKey: ["monthly-deliveries"], queryFn: async () => {
    const { data, error } = await supabase.from("signing_batches").select("*").order("created_at", { ascending: false });
    if (error) throw error; return data;
  } });
  return <section className="mb-5 space-y-3 border-y py-4">
    <h2 className="font-semibold">Monthly client batches</h2>
    {monthlyGroups(sheets).map((group) => {
      const pending = unsignedQueue(group.sheets);
      const completed = group.sheets.filter((s) => s.status === "completed" && s.signature_data);
      const delivery = batches.find((b) => b.client_id === group.clientId && b.month === group.month);
      return <div key={`${group.clientId}:${group.month}`} className="flex flex-wrap items-center gap-3 border-b pb-3 last:border-0">
        <div className="min-w-0 flex-1"><p className="font-medium">{group.clientName} · {group.month}</p><p className="text-sm text-muted-foreground">{pending.length} awaiting signature · {completed.length} signed{delivery ? ` · PDF ${delivery.status}${delivery.sent_at ? ` ${new Date(delivery.sent_at).toLocaleDateString()}` : ""}` : ""}</p></div>
        {pending.length > 0 && <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
          setBusy(true); try { setSession(await start({ data: { clientId: group.clientId, month: group.month, sheetIds: pending.map((s) => s.id) } })); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}><PenLine className="mr-1 h-4 w-4" />Sign {pending.length} sheets</Button>}
        {office && completed.length > 0 && <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
          setBusy(true); try {
            const result = await combine({ data: { sheetIds: completed.map((s) => s.id) } });
            const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" }));
            const a = document.createElement("a"); a.href = url; a.download = `Job sheets - ${group.month}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
          } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}><Download className="mr-1 h-4 w-4" />Monthly PDF</Button>}
        {delivery?.status === "failed" && <p className="w-full text-sm text-destructive">{delivery.delivery_error}</p>}
      </div>;
    })}
    {session && <BatchSigning session={session} onClose={() => setSession(null)} />}
  </section>;
}

function BatchSigning({ session, onClose }: { session: Batch; onClose: () => void }) {
  const qc = useQueryClient();
  const sign = useServerFn(signMonthlySheet); const finish = useServerFn(finishMonthlySigning);
  const [signed, setSigned] = useState(session.signed_ids);
  const [name, setName] = useState(""); const [card, setCard] = useState(""); const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [ended, setEnded] = useState(false); const [sent, setSent] = useState<string[] | null>(null); const [error, setError] = useState("");
  const sheetId = session.sheet_ids.find((id) => !signed.includes(id));
  const { data } = useQuery({ queryKey: ["batch-sheet", sheetId], enabled: !!sheetId && !ended, queryFn: async () => {
    const [sheet, logs, parts, settings] = await Promise.all([
      supabase.from("job_sheets").select("jobsheet_number, created_at, reported_fault, repairs_performed, special_notes, special_notes_in_pdf, asset_type, serial_number, clients(name), sites(name, address), assets(reference_number)").eq("id", sheetId ?? "").single(),
      supabase.from("jobsheet_time_logs").select("log_date, daily_work_description, time_in, time_out").eq("jobsheet_id", sheetId ?? "").order("sort_order"),
      supabase.from("jobsheet_parts").select("quantity, unit, part_description").eq("jobsheet_id", sheetId ?? "").order("sort_order"),
      supabase.from("company_settings").select("terms").maybeSingle(),
    ]);
    if (sheet.error) throw sheet.error; return { sheet: sheet.data, logs: logs.data ?? [], parts: parts.data ?? [], terms: termsFor(parseTerms(settings.data?.terms), "job_sheet") };
  } });
  const refresh = () => { ["sheets", "admin-jobs", "monthly-deliveries", "sheet"].forEach((key) => qc.invalidateQueries({ queryKey: [key] })); };
  const end = async () => {
    setBusy(true); setEnded(true); setError("");
    try { const result = await finish({ data: { batchId: session.id } }); setSent(result.recipients); refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const submit = async (stop: boolean) => {
    if (!sheetId || !signature || !name.trim() || !card.trim()) { toast.error("Full name, ID and a new signature are required"); return; }
    setBusy(true);
    try {
      await sign({ data: { batchId: session.id, sheetId, name, card, signature } });
      const next = [...signed, sheetId]; setSigned(next); setSignature(null); refresh();
      if (stop || next.length === session.sheet_ids.length) await end();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={() => {}}><DialogContent onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} className="max-h-[95dvh] overflow-y-auto sm:max-w-3xl [&>button]:hidden">
    <DialogHeader><DialogTitle>{ended ? "Monthly sign-off" : `Job sheet ${data?.sheet.jobsheet_number ?? ""} — ${signed.length + 1} of ${session.sheet_ids.length}`}</DialogTitle></DialogHeader>
    {ended ? <div className="space-y-5 py-8 text-center">
      <Check className="mx-auto h-9 w-9 text-success" /><h2 className="text-xl font-semibold">{signed.length} job sheets signed</h2>
      {busy ? <p>Sending your combined monthly PDF…</p> : error ? <><p className="text-destructive">Signed sheets saved, but the monthly email was not confirmed: {error}</p><Button variant="outline" onClick={end}><Mail className="mr-1 h-4 w-4" />Retry email</Button></> : <p>{sent?.length ? `Combined monthly PDF sent to ${sent.join(", ")}.` : "No sheets were submitted."}</p>}
      <p className="text-lg font-medium">Please hand the device back to your technician.</p><Button disabled={busy} onClick={onClose}>Finish</Button>
    </div> : <div className="space-y-4">
      {!data ? <p>Loading client copy…</p> : <>
        <p className="font-medium">{data.sheet.clients?.name} · {session.month}</p><p className="text-sm text-muted-foreground">{data.sheet.sites?.name} · {data.sheet.sites?.address} · {data.sheet.assets?.reference_number ?? data.sheet.asset_type} · {data.sheet.serial_number}</p>
        {data.sheet.reported_fault && <div><h3 className="font-medium">Reported fault</h3><p className="whitespace-pre-wrap text-sm">{data.sheet.reported_fault}</p></div>}
        <div><h3 className="font-medium">Work carried out</h3>{data.logs.length ? data.logs.map((l, i) => <p key={i} className="whitespace-pre-wrap text-sm">{l.log_date} {l.time_in?.slice(0, 5)}–{l.time_out?.slice(0, 5)} · {l.daily_work_description}</p>) : <p className="whitespace-pre-wrap text-sm">{data.sheet.repairs_performed || "—"}</p>}</div>
        {data.parts.length > 0 && <div><h3 className="font-medium">Parts replaced</h3>{data.parts.map((p, i) => <p key={i} className="text-sm">{p.quantity} {p.unit} · {p.part_description}</p>)}</div>}
        {data.sheet.special_notes_in_pdf && data.sheet.special_notes && <p className="whitespace-pre-wrap text-sm">{data.sheet.special_notes}</p>}
        {data.terms && <details><summary className="cursor-pointer font-medium">Terms & conditions</summary><p className="whitespace-pre-wrap text-sm">{data.terms}</p></details>}
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="batch-name">Full name</Label><Input id="batch-name" value={name} onChange={(e) => setName(e.target.value)} /></div><div><Label htmlFor="batch-card">ID card no.</Label><Input id="batch-card" value={card} onChange={(e) => setCard(e.target.value)} /></div></div>
        <SignaturePad key={sheetId} value={signature} onChange={setSignature} />
      </>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !data} onClick={() => submit(false)}>Submit &amp; Next</Button><Button disabled={busy || !data} variant="outline" onClick={() => submit(true)}>Submit &amp; Finish</Button><Button disabled={busy} variant="ghost" onClick={() => { if (!signed.length || confirm("Stop signing and email the sheets signed so far? Unsigned sheets will stay as drafts.")) void end(); }}>Stop</Button></div>
    </div>}
  </DialogContent></Dialog>;
}