import { useCompanyRules } from "@/lib/company";
import { companyTradeOptions } from "@/lib/trade-association";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CreatableCombobox } from '@/components/creatable-combobox';

const OTHER = "__other";

/** Trade/equipment picker seeded from company settings, with an "Other" free-text entry so any tenant can add their own. */
export function CompanyTradeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data } = useCompanyRules();
  const choices = companyTradeOptions(data?.industry, data?.trades, data?.equipmentCategories);
  return <CreatableCombobox ariaLabel="Trade / equipment" value={value} onChange={onChange} groups={[{group:'Trade / equipment',items:choices}]}/>;
}
