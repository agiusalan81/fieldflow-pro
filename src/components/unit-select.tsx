import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useProfile } from '@/lib/profile';
import { useCompanyRules } from '@/lib/company';
import { supabase } from '@/integrations/supabase/client';
import { industryUnits } from '@/lib/industry-units';
import { quoteSuggestions } from '@/lib/customer-quote-extras';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export function UnitSelect({ value, onChange, disabled, label = 'Unit', maxLength = 30 }: { value: string; onChange: (unit: string) => void; disabled?: boolean; label?: string; maxLength?: number }) {
  const { data: company } = useCompanyRules(); const { data: profile } = useProfile();
  const [open, setOpen] = useState(false); const [query, setQuery] = useState('');
  const history = useQuery({ queryKey: ['unit-history', profile?.id, profile?.company_id], enabled: open && !!profile, staleTime: 60_000, queryFn: async () => {
    const [quotes, prices, parts] = await Promise.all([supabase.from('customer_quotes').select('data').order('updated_at', { ascending: false }).limit(100), supabase.from('company_price_list_items').select('unit').is('archived_at', null).limit(200), supabase.from('jobsheet_parts').select('unit').limit(200)]);
    return [...quoteSuggestions((quotes.data ?? []).map(q => q.data)).units, ...(prices.data ?? []).map(p => p.unit), ...(parts.data ?? []).map(p => p.unit)];
  } });
  const units = industryUnits(company?.industry, company?.trades, history.data);
  const typed = query.trim().slice(0, maxLength);
  const choose = (unit: string) => { onChange(unit); setOpen(false); setQuery(''); };
  return <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setQuery(''); }}><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} disabled={disabled} className="h-10 w-full min-w-0 justify-between px-2 font-normal"><span className="truncate">{value || 'Unit'}</span><ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" /></Button></PopoverTrigger><PopoverContent align="start" className="w-64 max-w-[calc(100vw-2rem)] p-0"><Command shouldFilter={false}><CommandInput placeholder="Search or add unit…" value={query} onValueChange={setQuery} onKeyDown={e => { if (e.key === 'Enter' && typed) { e.preventDefault(); choose(typed); } }} /><CommandList><CommandGroup>{units.filter(u => u.toLowerCase().includes(query.toLowerCase())).map(unit => <CommandItem key={unit} value={unit} onSelect={() => choose(unit)}><Check className={`mr-2 h-4 w-4 ${value === unit ? 'opacity-100' : 'opacity-0'}`} />{unit}</CommandItem>)}{typed && !units.some(u => u.toLowerCase() === typed.toLowerCase()) && <CommandItem value={`custom:${typed}`} onSelect={() => choose(typed)}><Plus className="mr-2 h-4 w-4" />Use “{typed}”</CommandItem>}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}