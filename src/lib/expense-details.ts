export type ExpenseDetails = { expense_date: string; amount: number; currency: string; category_id: string | null; category_name?: string };
export function expenseDetails(date: string, amount: string, currency: string, categoryId: string, categoryName = ''): ExpenseDetails {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date) throw new Error('Choose a valid expense date.');
  if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0 || Number(amount) >= 10000000000) throw new Error('Enter an amount greater than zero with up to two decimal places.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Choose a currency.');
  if (!categoryId && !categoryName.trim()) throw new Error('Choose a category or enter another category.');
  return { expense_date: date, amount: Number(amount), currency, category_id: categoryId || null, ...(categoryName.trim() ? { category_name: categoryName.trim().slice(0,100) } : {}) };
}
export const expenseDate = (row: { expense_date?: string | null; created_at: string }) => row.expense_date ?? row.created_at.slice(0,10);
export function expenseInMonth(row: { expense_date?: string | null; created_at: string }, month: string) { return expenseDate(row).slice(0,7) === month; }