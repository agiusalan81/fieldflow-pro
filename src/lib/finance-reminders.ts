import { z } from 'zod';
import type {Json} from '@/integrations/supabase/types';
export const REMINDER_TYPES=['quote','proforma','payment_request','invoice'] as const;
export type ReminderType=typeof REMINDER_TYPES[number];
export const reminderRuleSchema=z.object({enabled:z.boolean(),before:z.number().int().min(0).max(365),after:z.number().int().min(1).max(365),message:z.string().trim().min(1).max(3000)});
export const reminderRulesSchema=z.record(z.enum(REMINDER_TYPES),reminderRuleSchema);
export type ReminderRule=z.infer<typeof reminderRuleSchema>;
export type ReminderRules=Record<ReminderType,ReminderRule>;
export const DEFAULT_REMINDER_RULES:ReminderRules={
 quote:{enabled:false,before:7,after:3,message:'Please let us know if you have any questions about this estimate or would like to proceed.'},
 proforma:{enabled:false,before:3,after:7,message:'Please arrange the agreed deposit or contact us to discuss the payment schedule.'},
 payment_request:{enabled:false,before:3,after:7,message:'Please arrange payment for the completed work. If you have already paid, please send the payment reference.'},
 invoice:{enabled:false,before:3,after:7,message:'Please arrange settlement of the outstanding balance. If you have already paid, please send the payment reference.'},
};
export function reminderRules(raw:unknown):ReminderRules{
 const value=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 return Object.fromEntries(REMINDER_TYPES.map(k=>{const r=reminderRuleSchema.safeParse(value[k]);return [k,r.success?r.data:{...DEFAULT_REMINDER_RULES[k]}];})) as ReminderRules;
}
export function offsetDay(day:string,offset:number){const date=new Date(`${day}T00:00:00Z`);if(Number.isNaN(date.getTime()))return '';date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);}
export type ReminderTarget={id:string;type:ReminderType;reference:string;title:string;client:string;issued:string;due:string;balance:number;currency:string;status:string;converted:boolean};
export type FollowupState={id:string;billing_id:string|null;quote_id:string|null;paused:boolean;snoozed_until:string|null;completed_stages:string[];activity:Json};
/** Payment/acceptance/conversion stop future tasks without changing the frozen document. */
export function targetOpen(t:ReminderTarget){return !t.converted&&(t.type==='quote'?['issued','sent','awaiting_confirmation'].includes(t.status):t.balance>0);}
export function reminderStages(t:ReminderTarget,r:ReminderRule){return t.type==='quote'?[{key:'first',date:offsetDay(t.issued,r.after),label:'Quote follow-up'},{key:'expiry',date:offsetDay(t.due,-r.before),label:'Before expiry'}]:[{key:'before',date:offsetDay(t.due,-r.before),label:'Before due date'},{key:'due',date:t.due,label:'Due date'},{key:'overdue',date:offsetDay(t.due,r.after),label:'Overdue payment'}];}
export function reminderQueue(targets:ReminderTarget[],states:FollowupState[],rules:ReminderRules,today=new Date().toISOString().slice(0,10)){
 return targets.flatMap(t=>{const state=states.find(s=>(s.billing_id??s.quote_id)===t.id);const r=rules[t.type];if(!r.enabled||!targetOpen(t)||state?.paused)return [];
  return reminderStages(t,r).filter(stage=>stage.date&&!(state?.completed_stages??[]).includes(stage.key)).map(stage=>({...stage,date:state?.snoozed_until&&state.snoozed_until>stage.date?state.snoozed_until:stage.date,target:t,state,dueNow:stage.date<=today&&(!state?.snoozed_until||state.snoozed_until<=today)}));
 }).sort((a,b)=>a.date.localeCompare(b.date));
}