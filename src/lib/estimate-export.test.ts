import { expect, it } from 'vitest';
import { estimateExportCsv } from './estimate-export';
it('exports one priced estimate line with escaped notes', () => {
  const csv = estimateExportCsv({ title: 'Door operator', client: 'Grand Hotel, Ltd', site: 'Tower A', notes: 'Say "hi"', price: 450, fixedLabour: true, taxRate: '18%', incomeAccount: 'Sales' });
  expect(csv.split('\n')[1]).toBe('"Grand Hotel, Ltd",Door operator,Tower A,Door operator (labour included),1,450.00,18%,Sales,"Say ""hi"""');
});
