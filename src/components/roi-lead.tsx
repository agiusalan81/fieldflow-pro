import { useState } from "react";
import { Download } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatEur } from "@/lib/catalog-pricing";
import type { RoiInputs, retailRoi } from "@/lib/retail-roi";

type Result = NonNullable<ReturnType<typeof retailRoi>>;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const eur = (n: number) => formatEur(n).replace(/[^\x20-\x7E]/g, " ").replace("€", "EUR ");

async function buildPdf(email: string, input: RoiInputs, r: Result, plan: string, cadence: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 780;
  const line = (t: string, f = font, size = 11) => { page.drawText(t.replace(/[^\x20-\x7E]/g, ""), { x: 50, y, size, font: f, color: rgb(0.1, 0.15, 0.2) }); y -= size + 10; };
  line("AisleOps - Custom ROI Summary", bold, 20);
  line(`Prepared for ${email} on ${new Date().toLocaleDateString("en-IE")}`);
  y -= 10;
  line("Your inputs", bold, 14);
  line(`Plan: ${plan} (${cadence})`);
  line(`Store locations: ${input.stores}   Team accounts: ${input.technicians}`);
  line(`Paperwork minutes recovered per person/day: ${input.minutes}   Working days/month: ${input.days}`);
  line(`Loaded hourly labour cost: EUR ${input.hourlyRate}/hr`);
  y -= 10;
  line("Results", bold, 14);
  line(`Monthly hours recovered: ${r.hours.toFixed(1)}`);
  line(`Annual recovered labour capacity: ${eur(r.annualCapacity)}`);
  line(`AisleOps annual subscription: ${eur(r.annualCost)}`);
  if (r.licenceDifference !== null) line(`Annual licence difference: ${eur(r.licenceDifference)}`);
  line(`First-year setup & training: ${eur(input.setupCost)}`);
  line(`First-year net capacity value: ${eur(r.net)}`, bold, 13);
  line(`First-year ROI: ${r.roi === null ? "-" : `${r.roi.toFixed(0)}%`}`, bold, 13);
  y -= 10;
  line("Conservative estimate based strictly on labor capacity recovery.", font, 9);
  line("Excludes inventory loss prevention and emergency callout fees.", font, 9);
  line("aisleopsapp.com  -  sales@fieldbridgeapp.com", font, 9);
  return doc.save();
}

export function RoiLead({ input, result, plan, cadence }: { input: RoiInputs; result: Result; plan: string; cadence: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL.test(clean) || clean.length > 254) { toast.error("Enter a valid work email address."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("roi_leads").insert({ email: clean, product: "fieldbridge-retail", inputs: { ...input, plan, cadence, net: result.net } });
      if (error) throw error;
      const bytes = await buildPdf(clean, input, result, plan, cadence);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = "AisleOps-ROI-summary.pdf"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Your ROI summary is downloading.");
    } catch { toast.error("Could not prepare your summary. Please try again."); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mt-6 rounded-lg border bg-card p-4">
      <Label htmlFor="roi-email">Work email address</Label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input id="roi-email" type="email" required maxLength={254} placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
        <Button type="submit" disabled={busy} className="shrink-0"><Download className="mr-2 h-4 w-4" />Download Custom ROI Summary (PDF)</Button>
      </div>
    </form>
  );
}
