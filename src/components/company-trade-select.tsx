import { useCompanyRules } from "@/lib/company";
import { companyTradeOptions } from "@/lib/trade-association";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CompanyTradeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data } = useCompanyRules();
  const choices = companyTradeOptions(data?.industry, data?.trades, data?.equipmentCategories);
  const options = value && !choices.includes(value) ? [value, ...choices] : choices;
  return <Select value={value || "__none"} onValueChange={next => onChange(next === "__none" ? "" : next)}><SelectTrigger aria-label="Trade / equipment"><SelectValue placeholder="Trade / equipment" /></SelectTrigger><SelectContent><SelectItem value="__none">Not specified</SelectItem>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>;
}