import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ModulePreview } from '@/components/module-preview';
import { useClientPortalAccess } from '@/lib/client-portal-access';

export function ClientPortalInvitationGate({ children }: { children: ReactNode }) {
  const access = useClientPortalAccess();
  if (access.allowed) return children;
  return <Popover><PopoverTrigger asChild><Button type="button" size="sm" variant="outline" disabled={access.loading} className="text-muted-foreground"><LockKeyhole className="mr-2 h-4 w-4" />Client portal invitation — locked</Button></PopoverTrigger><PopoverContent className="max-w-[calc(100vw-2rem)]"><ModulePreview feature="client_portal" title="Client portal invitations" comingSoon={access.comingSoon} /></PopoverContent></Popover>;
}