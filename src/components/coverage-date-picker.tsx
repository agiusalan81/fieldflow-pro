import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
export function CoverageDatePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const date = value ? parseISO(value) : undefined;
  return <div className="min-w-0 space-y-1"><Label>{label}</Label><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" aria-label={label} className="w-full justify-start font-normal"><CalendarIcon className="mr-2 size-4" />{date ? format(date, 'dd MMM yyyy') : 'Select date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 pointer-events-auto" align="start"><Calendar mode="single" selected={date} defaultMonth={date} captionLayout="dropdown" startMonth={new Date(2000, 0)} endMonth={new Date(2100, 11)} onSelect={d => { if (d) { onChange(format(d, 'yyyy-MM-dd')); setOpen(false); } }} className="pointer-events-auto" /></PopoverContent></Popover></div>;
}