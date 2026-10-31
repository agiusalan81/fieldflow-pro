import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {getFinanceWorkspace} from './finance-reminders.functions';
import {reminderQueue} from './finance-reminders';
export function useFinanceDue(enabled:boolean){const load=useServerFn(getFinanceWorkspace);const q=useQuery({queryKey:['finance-reminder-workspace'],enabled,queryFn:()=>load(),refetchInterval:60000,staleTime:30000});return enabled&&q.data?reminderQueue(q.data.targets,q.data.states,q.data.rules).filter(s=>s.dueNow):[];}