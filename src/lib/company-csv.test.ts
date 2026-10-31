import { describe,it,expect } from 'vitest';
import { parseCompanyCsv, mappedImportRows } from './company-csv';
describe('company CSV imports',()=>{
 it('parses quoted commas and multiline addresses',()=>{const p=parseCompanyCsv('name,address\r\n"Client, Ltd","Street\nMalta"');expect(p.rows[0]).toEqual(['Client, Ltd','Street\nMalta']);});
 it('blocks missing room references',()=>{expect(mappedImportRows('rooms',[['Hotel','Property','']],{client:0,site:1,reference:2}).errors).toContain('Row 2: reference is required');});
 it('rejects duplicated equipment IDs without case loopholes',()=>{expect(mappedImportRows('equipment',[['C','S','FR-01','Fridge'],['C','S','fr-01','Fridge']],{client:0,site:1,reference:2,category:3}).errors).toContain('Row 3: duplicate ID in this file');});
 it('rejects malformed row widths',()=>expect(()=>parseCompanyCsv('name,address\nCompany,Street,Extra')).toThrow('same number'));
});