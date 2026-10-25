import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/lib/profile';
import { useCompanyRules } from '@/lib/company';
import { expenseDetails, type ExpenseDetails } from '@/lib/expense-details';
import { SearchSelect } from '@/components/search-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhotoPdfScanner } from '@/components/photo-pdf-scanner';

export function ExpenseCapture({ onSave, label = 'Save expense' }: { onSave: (blob: Blob, pages: number, details: ExpenseDetails) => Promise<void>; label?: string }) {
  const { data: profile } = useProfile(); const { data: company } = useCompanyRules();
  const today = new Date();
  const [date,setDate] = useState(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);
  const [amount,setAmount] = useState(''), [category,setCategory] = useState(''), [other,setOther] = useState('');
  const categories = useQuery({queryKey:['expense-categories',profile?.id],enabled:!!profile,queryFn:async()=>{const r=await supabase.from('expense_categories').select('id,name,status').neq('status','rejected').order('name');if(r.error)throw r.error;return r.data;}});
  const currency = company?.locale.currency ?? 'EUR';
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5"><Label htmlFor="expense-date">Expense date</Label><Input id="expense-date" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div className="space-y-1.5"><Label htmlFor="expense-amount">Amount · {currency}</Label><Input id="expense-amount" inputMode="decimal" required placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
    </div>
    <div className="space-y-1.5"><Label>Category</Label><SearchSelect value={category} placeholder="Search category" options={[...(categories.data??[]).map(c=>({value:c.id,label:c.name})),{value:'other',label:'Other…'}]} onChange={setCategory}/>{category==='other'&&<Input aria-label="Other expense category" placeholder="Category name" maxLength={100} value={other} onChange={e=>setOther(e.target.value)}/>}</div>
    {categories.error&&<p role="alert" className="text-destructive">{categories.error.message}</p>}
    <PhotoPdfScanner receipt label={label} onAttach={(blob,pages)=>onSave(blob,pages,expenseDetails(date,amount,currency,category==='other'?'':category,category==='other'?other:''))}/>
  </div>;
}