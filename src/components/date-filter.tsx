import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const date = value ? new Date(value + "T12:00:00") : undefined;
  return <Popover><PopoverTrigger asChild><Button variant="outline" className="h-11 w-full justify-start font-normal" aria-label={label}><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "dd MMM yyyy") : label}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")} className="pointer-events-auto p-3" /></PopoverContent></Popover>;
}