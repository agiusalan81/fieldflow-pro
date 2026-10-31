import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv, hoursCsv, type HoursExportRow } from "@/lib/hours-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** In-house accounting: export staff hours, overtime and daily work reports as CSV for payroll / finance. */
export function HoursExportSettings() {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (to < from) { toast.error("End date must be after start date"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("daily_work_reports").select("report_date, shift_start, shift_end, break_minutes, worked_hours, standard_hours, ot15_hours, ot20_hours, vehicle_reg, rows, superseded_by, users(full_name, employee_id)").gte("report_date", from).lte("report_date", to).order("report_date");
      if (error) throw error;
      if (!data.length) { toast.info("No daily work reports in this period"); return; }
      downloadCsv(hoursCsv(data as unknown as HoursExportRow[]), `Hours_DWR_${from}_${to}.csv`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); }
    finally { setBusy(false); }
  };
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div><h2 className="font-medium text-foreground">Hours, overtime & daily reports export</h2><p className="text-sm text-muted-foreground">Download a spreadsheet (CSV) of every filed daily work report — hours, breaks and overtime per person — for payroll or your accounting software.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="hx-from">From</Label><Input id="hx-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="hx-to">To</Label><Input id="hx-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex items-end"><Button className="w-full" disabled={busy} onClick={run}><Download className="mr-2 h-4 w-4" />{busy ? "Preparing…" : "Export CSV"}</Button></div>
      </div>
      <p className="text-xs text-muted-foreground">Corrected reports replace their originals, so hours are never counted twice.</p>
    </section>
  );
}
