import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><Input id={id} required minLength={8} autoComplete="new-password" type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} className="h-11 pr-12"/><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9" title={visible ? 'Hide password' : 'Show password'} aria-label={visible ? `Hide ${id}` : `Show ${id}`} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</Button></div>;
}