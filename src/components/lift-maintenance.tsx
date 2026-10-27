import { useNavigate } from "@tanstack/react-router";
import { useProfile, isManager } from "@/lib/profile";
import { quoteAction } from "@/components/customer-quotes";
import { emptyQuoteDocument, newQuoteLine } from "@/lib/customer-quotes";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ardFor, checksFor, collectDefects, defectQuoteLines, evaluate, measurementsFor, missingChecks,
  type CheckResult, type Frequency, type Protocol,
} from "@/lib/lift-maintenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Rec = Record<string, CheckResult>;

function ResultButtons({ value, onChange, disabled }: { value: CheckResult; onChange: (v: CheckResult) => void; disabled: boolean }) {
  const opt: [CheckResult, string][] = [["ok", "OK"], ["defect", "Defect"], ["na", "N/A"]];
  return (
    <div className="flex shrink-0 gap-1">
      {opt.map(([v, l]) => (
        <Button key={v} type="button" size="sm" disabled={disabled} variant={value === v ? (v === "defect" ? "destructive" : "default") : "outline"} className="h-9 px-2.5" onClick={() => onChange(value === v ? "" : v)}>{l}</Button>
      ))}
    </div>
  );
}

/** Lift-pack maintenance protocol on a job sheet: checks, EN guide readings, ARD and defects. */
export function LiftMaintenanceChecklist({ sheetId, assetId, defaultProtocol, readOnly }: { sheetId: string; assetId: string | null; defaultProtocol: Protocol; readOnly: boolean }) {
  const qc = useQueryClient();
  const key = ["lift-maintenance", sheetId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("lift_maintenance_logs").select("*").eq("job_sheet_id", sheetId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [protocol, setProtocol] = useState<Protocol>(defaultProtocol);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [checks, setChecks] = useState<Rec>({});
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [ard, setArd] = useState<Rec>({});
  const [oos, setOos] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = q.data;
    if (!d) return;
    setProtocol(d.protocol_type as Protocol);
    setFrequency(d.frequency as Frequency);
    setChecks((d.checklist_data ?? {}) as Rec);
    setReadings((d.measurements ?? {}) as Record<string, string>);
    setArd((d.ard_check ?? {}) as Rec);
    setOos(d.out_of_service);
  }, [q.data]);

  const defects = collectDefects(protocol, frequency, checks, readings, ard);
  const missing = missingChecks(protocol, frequency, checks, ard);

  const save = async () => {
    setSaving(true);
    const row = {
      job_sheet_id: sheetId, asset_id: assetId, protocol_type: protocol, frequency,
      checklist_data: checks, measurements: readings, ard_check: ard,
      defects: defects as unknown as never, out_of_service: oos, updated_at: new Date().toISOString(),
    };
    const { error } = q.data
      ? await supabase.from("lift_maintenance_logs").update(row).eq("id", q.data.id)
      : await supabase.from("lift_maintenance_logs").insert(row);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Maintenance checklist saved");
    qc.invalidateQueries({ queryKey: key });
  };

  const { data: profile } = useProfile(); const navigate = useNavigate();
  const office = !!profile && isManager(profile);
  const [quoting, setQuoting] = useState(false);
  const quoteDefects = async () => {
    setQuoting(true);
    try {
      const sh = await supabase.from("job_sheets").select("client_id,site_id,jobsheet_number").eq("id", sheetId).single();
      if (sh.error || !sh.data?.client_id) throw new Error("This job sheet has no client to quote");
      const quoteId = crypto.randomUUID();
      const doc = { ...emptyQuoteDocument("estimate"), title: `Corrective works after maintenance #${sh.data.jobsheet_number ?? ""}`.trim(), lines: defectQuoteLines(defects).map((description) => ({ ...newQuoteLine(), description })) };
      await quoteAction(quoteId, "save", { id: quoteId, client_id: sh.data.client_id, site_id: sh.data.site_id, asset_id: assetId, source_sheet_id: sheetId, private_notes: "Created from maintenance checklist defects", data: doc });
      toast.success("Draft estimate created — add prices and issue it");
      void navigate({ to: "/estimates", search: { quote: quoteId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create the estimate"); }
    finally { setQuoting(false); }
  };
  const disabled = readOnly || saving;
  const items = checksFor(protocol, frequency);
  const ardItems = ardFor(protocol, frequency);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Equipment</Label>
          <Select value={protocol} onValueChange={(v) => setProtocol(v as Protocol)} disabled={disabled}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="lift">Lift</SelectItem><SelectItem value="escalator">Escalator</SelectItem><SelectItem value="moving_walk">Moving walk</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Visit type</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)} disabled={disabled}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="annual">Annual</SelectItem><SelectItem value="audit">Safety audit</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Checks</p>
        {items.map((c) => (
          <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">{c.label}</span>
            <ResultButtons value={checks[c.key] ?? ""} disabled={disabled} onChange={(v) => setChecks({ ...checks, [c.key]: v })} />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Measurements <span className="font-normal text-muted-foreground">· guide values ({protocol === "lift" ? "EN 81-20" : "EN 115-1"}), not a substitute for the standard</span></p>
        <div className="grid gap-2 sm:grid-cols-2">
          {measurementsFor(protocol).map((m) => {
            const r = evaluate(m, readings[m.key]);
            return (
              <div key={m.key} className={`rounded-md border p-2 text-sm ${r === "fail" ? "border-destructive bg-destructive/10" : r === "pass" ? "border-success" : ""}`}>
                <Label className="text-xs">{m.label}</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input inputMode="decimal" className="h-10" value={readings[m.key] ?? ""} disabled={disabled} onChange={(e) => setReadings({ ...readings, [m.key]: e.target.value })} />
                  <span className="text-xs text-muted-foreground">{m.unit}</span>
                </div>
                <p className={`mt-1 text-xs ${r === "fail" ? "text-destructive" : "text-muted-foreground"}`}>{r === "fail" ? "Out of tolerance · " : ""}{m.guide}</p>
              </div>
            );
          })}
        </div>
      </div>

      {ardItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Automatic rescue device (ARD)</p>
          {ardItems.map((c) => (
            <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">{c.label}</span>
              <ResultButtons value={ard[c.key] ?? ""} disabled={disabled} onChange={(v) => setArd({ ...ard, [c.key]: v })} />
            </div>
          ))}
        </div>
      )}

      {defects.length > 0 && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-destructive"><AlertTriangle className="h-4 w-4" />{defects.length} defect{defects.length > 1 ? "s" : ""} found</p>
          <ul className="mt-1 list-disc pl-5">{defects.map((d, i) => <li key={i}>{d.label}{d.detail ? ` — ${d.detail}` : ""}</li>)}</ul>
          {office && q.data && <Button type="button" size="sm" variant="outline" className="mt-2" disabled={quoting} onClick={() => void quoteDefects()}>{quoting ? "Creating…" : "Quote these defects"}</Button>}
        </div>
      )}

      <label className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm">
        <Checkbox checked={oos} disabled={disabled} onCheckedChange={(c) => setOos(!!c)} />Equipment left out of service
      </label>

      {!readOnly && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{missing ? `${missing} item${missing > 1 ? "s" : ""} not answered` : "All items answered"}</span>
          <Button type="button" className="h-11" disabled={saving} onClick={save}>Save checklist</Button>
        </div>
      )}
    </div>
  );
}
