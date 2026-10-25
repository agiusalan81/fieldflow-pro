import { useCompanyRules } from "@/lib/company";
import { companyTradeOptions } from "@/lib/trade-association";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const OTHER = "__other";

/** Trade/equipment picker seeded from company settings, with an "Other" free-text entry so any tenant can add their own. */
export function CompanyTradeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data } = useCompanyRules();
  const choices = companyTradeOptions(data?.industry, data?.trades, data?.equipmentCategories);
  const isCustom = !!value && !choices.includes(value);
  const selectValue = isCustom ? OTHER : value || "__none";
  return (
    <div className="space-y-2">
      <Select value={selectValue} onValueChange={next => onChange(next === "__none" || next === OTHER ? "" : next)}>
        <SelectTrigger aria-label="Trade / equipment"><SelectValue placeholder="Trade / equipment" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Not specified</SelectItem>
          {choices.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          <SelectItem value={OTHER}>Other (custom)…</SelectItem>
        </SelectContent>
      </Select>
      {(isCustom || selectValue === OTHER) && (
        <Input
          aria-label="Custom trade or equipment"
          placeholder="Type the trade or equipment name"
          value={isCustom ? value : ""}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
