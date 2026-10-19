import { describe,it,expect } from 'vitest';
import {canPublishTechnical,canReadTechnical,printPages,shouldShareLocation,relevantPages,technicalStructure} from './field-documents';
describe('agreed field rules',()=>{
 it('only supervisor and superuser publish technical documents',()=>{expect(['technician','admin','supervisor','superuser'].map(canPublishTechnical)).toEqual([false,false,true,true]);});
 it('technicians read all approved non-restricted documents, not restricted documents',()=>{expect(canReadTechnical('technician',{status:'approved',restricted:false,uploaded_by:'another'},'me')).toBe(true);expect(canReadTechnical('technician',{status:'approved',restricted:true,uploaded_by:'me'},'me')).toBe(false);});
 it('technician scans remain in their pending review view',()=>{expect(canReadTechnical('technician',{status:'pending',restricted:false,uploaded_by:'me'},'me')).toBe(true);expect(canReadTechnical('technician',{status:'pending',restricted:false,uploaded_by:'another'},'me')).toBe(false);});
 it('sharing requires consent and an open shift',()=>{expect(shouldShareLocation(true,{ended_at:null})).toBe(true);expect(shouldShareLocation(false,{ended_at:null})).toBe(false);expect(shouldShareLocation(true,{ended_at:'2026-10-19T12:00:00Z'})).toBe(false);expect(shouldShareLocation(true,undefined)).toBe(false);});
 it('printing uses only selected existing pages',()=>{expect(printPages('1-3, 7',8)).toEqual([1,2,3,7]);expect(()=>printPages('1-9',8)).toThrow();});
 it('SOP type exists while taxonomy is optional',()=>{expect(technicalStructure({}).options['documentType']).toContain('S.O.P. / Safety Procedure');expect(technicalStructure({}).options['manufacturer']).toEqual([]);});
 it('retrieval retains actual page numbers and document IDs',()=>{expect(relevantPages([{id:'manual',title:'Manual',pages:[{page:7,text:'Fault E42 programming reset'},{page:8,text:'Parts'}]}],'E42')[0]).toMatchObject({documentId:'manual',page:7});});
});
