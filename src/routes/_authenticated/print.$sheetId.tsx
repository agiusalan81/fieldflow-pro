import { customerNotes } from "@/lib/service-sheet";
import {formatSiteDisplay,formatSiteTitle} from "@/lib/site-display";
import { serviceEquipment } from "@/lib/service-sheet";
import { createFileRoute } from "@tanstack/react-router";
import { useCompanyRules } from "@/lib/company";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager } from "@/lib/profile";
import { useEdition } from "@/lib/plan-features";
import { isInHouse } from "@/lib/editions";
import { labourHours, technicianCount } from "@/lib/jobsheets";
import { ServiceSheet } from "@/components/service-sheet";
import { formatOfficeAddress } from "@/lib/contact-details";
import { parseTemplate, parseTerms, termsFor } from "@/lib/documents";
import { dayLabourHours } from "@/lib/jobsheets";
import { Button } from "@/components/ui/button";
import { documentVariables } from "@/components/document-preview";

export const Route = createFileRoute("/_authenticated/print/$sheetId")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Client job sheet — FieldBridge" },
      { name: "description", content: "Printable client copy of a job sheet." },
      { property: "og:title", content: "Client job sheet — FieldBridge" },
      { property: "og:description", content: "Printable client copy." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrintSheet,
});

/** Client copy: never includes pending works or internal admin comments. */
function PrintSheet() {
  const { sheetId } = Route.useParams();
  const { data: profile } = useProfile();
  const { data: company } = useCompanyRules();
  const inHouse = isInHouse(useEdition().edition);
  const { data } = useQuery({
    queryKey: ["print", sheetId],
    queryFn: async () => {
      const [s, l, p] = await Promise.all([
        supabase.from("job_sheets").select("jobsheet_number, created_at, asset_type, asset_type_other, lift_model, serial_number, is_tech_assistance, is_maintenance, is_installation, job_type_other, maintenance_agreement_type, reported_fault, repairs_performed, technician_name, client_full_name, client_id_card_no, signature_data, assigned_technician_id, special_notes, special_notes_in_pdf, maintenance_notes, clients(name, billing_address), sites(name, address, store_code), assets(reference_number), companies(name)").eq("id", sheetId).maybeSingle(),
        supabase.from("jobsheet_time_logs").select("*").eq("jobsheet_id", sheetId).order("sort_order"),
        supabase.from("jobsheet_parts").select("*").eq("jobsheet_id", sheetId).order("sort_order"),
      ]);
      const { data: settings } = await supabase.from("company_settings").select("terms").maybeSingle();
      const { data: technician } = s.data?.assigned_technician_id ? await supabase.from("users").select("signature_on_file").eq("id",s.data.assigned_technician_id).maybeSingle() : { data: null };
      return { s: s.data, logs: l.data ?? [], parts: p.data ?? [], terms: settings?.terms, technicianSignature: technician?.signature_on_file };
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
      {company?.documentTemplate.stylePreset === "service" ? <div className="mx-auto max-w-3xl"><ServiceSheet data={{
        company: s.companies?.name ?? "", logo: company.logo, officeAddress: formatOfficeAddress(company.officeAddress), vatNumber: company.vatNumber, contact: [company.phones.office_phone,company.phones.company_email].filter(Boolean).join("\n"),
        number: s.jobsheet_number, date: new Date(s.created_at).toLocaleDateString("en-GB"), client: s.clients?.name ?? "", address: s.sites?formatSiteDisplay(s.sites):s.clients?.billing_address??"", asset: serviceEquipment(s.asset_type === "Other" ? s.asset_type_other : s.asset_type,s.assets?.reference_number,s.lift_model,s.serial_number), workType: types,
        fault: s.reported_fault ?? "", repairs: s.repairs_performed ?? "", technician: s.technician_name ?? "", technicianSignature: data.technicianSignature, signedBy: s.client_full_name ?? "", idCard: s.client_id_card_no ?? "", signature: s.signature_data,
        logs: data.logs.map(l=>({ date: l.log_date,in:l.time_in?.slice(0,5) ?? "",out:l.time_out?.slice(0,5) ?? "",travel:Number(l.traveling_time_hours),total:dayLabourHours(l.time_in,l.time_out,Number(l.traveling_time_hours),l.technician_count,l.technician_initials),techs:l.technician_initials.join(", "),count:technicianCount(l.technician_count,l.technician_initials) })),
        parts: data.parts.map(p=>({desc:p.part_description,unit:p.unit ?? "",qty:Number(p.quantity)})),notes:customerNotes(s.maintenance_notes, s.special_notes_in_pdf ? s.special_notes : null),terms:termsFor(parseTerms(data.terms),"job_sheet"),template:company.documentTemplate,
      }}/></div> : <article style={company ? documentVariables(company.documentTemplate) : undefined} data-frame={company?.documentTemplate.frame} data-style={company?.documentTemplate.stylePreset} className="document-paper mx-auto max-w-3xl space-y-6 p-10 text-sm shadow print:shadow-none">
        <header className="flex items-start justify-between border-b pb-4">
          <div className="flex items-center gap-3">{company?.logo && <img src={company.logo} alt="" className="h-14 max-w-32 object-contain" />}<div><p className="font-display text-2xl">{s.companies?.name}</p><p className="text-muted-foreground">Job sheet</p></div></div>
          <div className="text-right"><p className="font-mono text-lg">Job sheet- {s.jobsheet_number}</p><p className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p></div>
        </header>
        <section className="grid grid-cols-2 gap-4">
          <div><p className="text-xs uppercase text-muted-foreground">{inHouse ? "Location" : "Client"}</p><p>{s.clients?.name}</p><p className="text-muted-foreground">{s.clients?.billing_address}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Site</p><p>{s.sites?formatSiteTitle(s.sites):"—"}</p><p className="text-muted-foreground">{s.sites?.address}</p></div>
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
              <tr key={l.id} className="border-b align-top"><td className="py-1">{l.log_date}</td><td>{l.time_in?.slice(0, 5)}</td><td>{l.time_out?.slice(0, 5)}</td><td>{Number(l.traveling_time_hours)}</td><td>{technicianCount(l.technician_count, l.technician_initials)} · {l.technician_initials.join(", ")}</td><td className="text-right">{labourHours(l.time_in, l.time_out, l.technician_count, l.technician_initials).toFixed(2)}</td></tr>
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
          <div><p className="text-xs uppercase text-muted-foreground">Technician</p><p>{s.technician_name}</p>{data.technicianSignature && <img src={data.technicianSignature} alt="Technician signature" className="mt-1 h-20 max-w-full object-contain" />}</div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">{inHouse ? "Sign-off & verification" : "Client sign-off"}{s.signature_data ? " · Signed" : ""}</p>
            <p>{s.client_full_name} · ID {s.client_id_card_no}</p>
            {s.signature_data && <img src={s.signature_data} alt={inHouse ? "Verifier signature" : "Client signature"} className="mt-1 h-20" />}
          </div>
        </footer>
      </article>}
    </div>
  );
}
