import 'fake-indexeddb/auto';
import {describe,it,expect,vi} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {Blob as NodeBlob} from 'node:buffer';
vi.stubGlobal('Blob',NodeBlob);
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
import {stashExpense,localExpenses,monthBounds,combineReceiptPdfs} from './expense-stash';
import {sheetFingerprint} from './sheet-dirty';
describe('expense stash',()=>{
 it('isolates photo-only PDFs by account without vendor or amount entry',async()=>{await stashExpense('alice','company',new Blob(['scan'],{type:'application/pdf'}),1);await stashExpense('bob','company',new Blob(['other']),2);const rows=await localExpenses('alice');expect(rows).toHaveLength(1);expect(rows[0]?.page_count).toBe(1);expect(rows[0]).not.toHaveProperty('amount');expect((await localExpenses('bob'))[0]?.page_count).toBe(2);});
 it('exports a complete selected month including December rollover',()=>{expect(monthBounds('2026-12')).toEqual({start:'2026-12-01T00:00:00.000Z',end:'2027-01-01T00:00:00.000Z'});expect(()=>monthBounds('2026-13')).toThrow();});
 it('retains original receipt page sizes and order in a monthly PDF',async()=>{const first=await PDFDocument.create();first.addPage([200,500]);const second=await PDFDocument.create();second.addPage([300,800]);const merged=await combineReceiptPdfs([new Blob([new Uint8Array(await first.save())]),new Blob([new Uint8Array(await second.save())])]);const pdf=await PDFDocument.load(new Uint8Array(await merged.arrayBuffer()));expect(pdf.getPageCount()).toBe(2);expect(pdf.getPage(0).getSize()).toEqual({width:200,height:500});expect(pdf.getPage(1).getSize()).toEqual({width:300,height:800});});
});
describe('sheet dirty tracking',()=>{
 it('does not mark unchanged restored values dirty due to key ordering',()=>expect(sheetFingerprint({logs:[],form:{a:1,b:2}})).toBe(sheetFingerprint({form:{b:2,a:1},logs:[]})));
 it('detects actual note and row edits',()=>{expect(sheetFingerprint({note:'before'})).not.toBe(sheetFingerprint({note:'after'}));expect(sheetFingerprint([1,2])).not.toBe(sheetFingerprint([2,1]));});
});
