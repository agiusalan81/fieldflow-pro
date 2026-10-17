import { createFileRoute } from "@tanstack/react-router";
import { useCompanyRules } from "@/lib/company";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager } from "@/lib/profile";
import { hoursFromTimes } from "@/lib/jobsheets";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/print/$sheetId")({
  head: () => ({
    meta: [
      { title: "Client job sheet — FieldOps" },
      { name: "description", content: "Printable client copy of a job sheet." },
      { property: "og:title", content: "Client job sheet — FieldOps" },
      { property: "og:description", content: "Printable client copy." },
    ],
  }),
  component: PrintSheet,
});

/** Client copy: never includes pending works or internal admin comments. */
function PrintSheet() {
  const { sheetId } = Route.useParams();
  const { data: profile } = useProfile();
  const { data: company } = useCompanyRules();
  const { data } = useQuery({
    queryKey: ["print", sheetId],
    queryFn: async () => {
      const [s, l, p] = await Promise.all([
        supabase.from("job_sheets").select("jobsheet_number, created_at, asset_type, asset_type_other, lift_model, serial_number, is_tech_assistance, is_maintenance, is_installation, job_type_other, maintenance_agreement_type, reported_fault, repairs_performed, technician_name, client_full_name, client_id_card_no, signature_data, clients(name, billing_address), sites(name, address), assets(reference_number), companies(name)").eq("id", sheetId).maybeSingle(),
        supabase.from("jobsheet_time_logs").select("*").eq("jobsheet_id", sheetId).order("sort_order"),
        supabase.from("jobsheet_parts").select("*").eq("jobsheet_id", sheetId).order("sort_order"),
      ]);
      return { s: s.data, logs: l.data ?? [], parts: p.data ?? [] };
    },
  });
  if (profile && !isManager(profile)) return <p className="p-8 text-muted-foreground">Client copies are available to supervisors and office admins.</p>;
  if (!data?.s) return <p className="p-8 text-muted-foreground">Loading…</p>;
  const s = data.s;
  const types = [s.is_tech_assistance && "Technical assistance", s.is_maintenance && "Maintenance", s.is_installation && "Installation", s.job_type_other].filter(Boolean).join(", ");
  return (
    <div className="min-h-screen bg-background py-8 print:bg-card print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl justify-end print:hidden">
        <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Save as PDF / Print</Button>
      </div>
      <article className="mx-auto max-w-3xl space-y-6 bg-card p-10 text-sm text-card-foreground shadow print:shadow-none">
        <header className="flex items-start justify-between border-b pb-4">
          <div className="flex items-center gap-3">{company?.logo && <img src={company.logo} alt="" className="h-14 max-w-32 object-contain" />}<div><p className="font-display text-2xl">{s.companies?.name}</p><p className="text-muted-foreground">Job sheet</p></div></div>
          <div className="text-right"><p className="font-mono text-lg">Job sheet- {s.jobsheet_number}</p><p className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p></div>
        </header>
        <section className="grid grid-cols-2 gap-4">
          <div><p className="text-xs uppercase text-muted-foreground">Client</p><p>{s.clients?.name}</p><p className="text-muted-foreground">{s.clients?.billing_address}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Site</p><p>{s.sites?.name ?? "—"}</p><p className="text-muted-foreground">{s.sites?.address}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Asset</p><p>{s.asset_type === "Other" ? s.asset_type_other : s.asset_type} {s.assets?.reference_number}</p><p className="text-muted-foreground">Model {s.lift_model || "—"} · S/N {s.serial_number || "—"}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Work type</p><p>{types || "—"}</p><p className="text-muted-foreground">{s.maintenance_agreement_type ?? ""}</p></div>
        </section>
        <section><p className="text-xs uppercase text-muted-foreground">Reported fault</p><p className="whitespace-pre-wrap">{s.reported_fault || "—"}</p></section>
        <section><p className="text-xs uppercase text-muted-foreground">Repairs performed</p><p className="whitespace-pre-wrap">{s.repairs_performed || "—"}</p></section>
        <section>
          <p className="mb-1 text-xs uppercase text-muted-foreground">Time sheet</p>
          <table className="w-full border-collapse text-left">
            <thead><tr className="border-b"><th className="py-1">Date</th><th>In</th><th>Out</th><th>Travel</th><th>Techs</th><th className="text-right">Hours</th></tr></thead>
            <tbody>{data.logs.map((l) => (
              <tr key={l.id} className="border-b align-top"><td className="py-1">{l.log_date}</td><td>{l.time_in?.slice(0, 5)}</td><td>{l.time_out?.slice(0, 5)}</td><td>{Number(l.traveling_time_hours)}</td><td>{l.technician_initials.join(", ")}</td><td className="text-right">{(hoursFromTimes(l.time_in, l.time_out) + Number(l.traveling_time_hours)).toFixed(2)}</td></tr>
            ))}</tbody>
          </table>
        </section>
        {data.parts.length > 0 && (
          <section>
            <p className="mb-1 text-xs uppercase text-muted-foreground">Parts</p>
            <table className="w-full text-left"><thead><tr className="border-b"><th className="py-1">Description</th><th>Unit</th><th className="text-right">Qty</th></tr></thead>
              <tbody>{data.parts.map((p) => <tr key={p.id} className="border-b"><td className="py-1">{p.part_description}</td><td>{p.unit}</td><td className="text-right">{Number(p.quantity)}</td></tr>)}</tbody></table>
          </section>
        )}
        <footer className="grid grid-cols-2 gap-6 border-t pt-4">
          <div><p className="text-xs uppercase text-muted-foreground">Technician</p><p>{s.technician_name}</p></div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Client sign-off{s.signature_data ? " · Signed" : ""}</p>
            <p>{s.client_full_name} · ID {s.client_id_card_no}</p>
            {s.signature_data && <img src={s.signature_data} alt="Client signature" className="mt-1 h-20" />}
          </div>
        </footer>
      </article>
    </div>
  );
}
