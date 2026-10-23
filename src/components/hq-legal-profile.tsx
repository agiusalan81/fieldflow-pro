import { useState } from "react";
import { toast } from "sonner";
import { Save, Building2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
type Profile = Database["public"]["Tables"]["platform_legal_profiles"]["Row"];
const fields = [
  ["legal_name", "Registered company name"], ["registration_number", "Company registration number"], ["vat_number", "VAT number"], ["country", "Country"], ["founder_name", "Contact / founder name"],
  ["sales_email", "Sales email"], ["support_email", "Support email"], ["billing_email", "Billing email"], ["privacy_email", "Privacy contact email"],
] as const;
export function HQLegalProfile({ productId, productName, profile, onSaved }: { productId: string; productName: string; profile?: Profile | undefined; onSaved: () => void }) {
  const [values, setValues] = useState(() => Object.fromEntries([...fields.map(([key]) => [key, profile?.[key] ?? ""]), ["registered_address", profile?.registered_address ?? ""]]) as Record<string, string>);
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const emails = fields.filter(([key]) => key.endsWith("email"));
      if (emails.some(([key]) => values[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[key].trim()))) throw new Error("Enter valid contact email addresses");
      const payload = { product_id: productId, ...Object.fromEntries(Object.entries(values).map(([k,v]) => [k, v.trim()])), updated_at: new Date().toISOString() };
      const { error } = await supabase.from("platform_legal_profiles").upsert(payload, { onConflict: "product_id" });
      if (error) throw error;
      toast.success("Platform company details saved"); onSaved();
    } catch(e) { toast.error(e instanceof Error ? e.message : "Could not save company details"); } finally { setSaving(false); }
  };
  return <form onSubmit={save} className="max-w-3xl space-y-6"><div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-muted-foreground"/><div><h2 className="text-xl font-semibold">Platform company details</h2><p className="text-sm text-muted-foreground">{productName}</p></div></div><div className="grid gap-5 sm:grid-cols-2">{fields.map(([key,label]) => <div key={key} className="space-y-2"><Label htmlFor={`legal-${key}`}>{label}</Label><Input id={`legal-${key}`} type={key.endsWith("email") ? "email" : "text"} maxLength={key.endsWith("email") ? 254 : key === "legal_name" || key === "founder_name" ? 200 : 100} value={values[key]} onChange={e=>setValues({...values,[key]:e.target.value})}/></div>)}</div><div className="space-y-2"><Label htmlFor="legal-address">Registered legal address</Label><Textarea id="legal-address" maxLength={2000} rows={4} value={values["registered_address"]} onChange={e=>setValues({...values,registered_address:e.target.value})}/></div><Button disabled={saving} type="submit"><Save className="mr-2 h-4 w-4"/>{saving ? "Saving…" : "Save company details"}</Button></form>;
}