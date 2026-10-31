import {describe,it,expect} from 'vitest';
import {scheduledTravelAllowed,defaultJobIncentive,workspaceMessageValid} from './workspace-thread';
describe('shared workflow rules',()=>{
 it('travel is restricted to the scheduled Malta day, including UTC midnight crossover',()=>{
  const now=new Date('2026-10-31T23:30:00Z');
  expect(scheduledTravelAllowed('2026-11-01',now)).toBe(true);
  expect(scheduledTravelAllowed('2026-10-31',now)).toBe(false);
  expect(scheduledTravelAllowed('2026-11-02',now)).toBe(false);
 });
 it('default incentives are reserved for Up for grabs unless company opts into all jobs',()=>{
  expect(defaultJobIncentive(true,25,false)).toBe(0);
  expect(defaultJobIncentive(true,25,true)).toBe(25);
  expect(defaultJobIncentive(true,25,false,true)).toBe(25);
  expect(defaultJobIncentive(false,25,true,true)).toBe(0);
 });
 it('conversation messages require nonblank bounded content',()=>{
  expect(workspaceMessageValid(' ')).toBe(false);
  expect(workspaceMessageValid('Cover arranged')).toBe(true);
  expect(workspaceMessageValid('x'.repeat(4001))).toBe(false);
 });
});