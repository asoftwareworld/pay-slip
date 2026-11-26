import { LineItem, MONTHS, Payslip } from './payslip.model';

export const sum = (items: LineItem[]) =>
  items.reduce((t, i) => t + (Number(i.amount) || 0), 0);

/** Indian digit grouping, e.g. 2,32,848.00 */
export const money = (n: number) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function netPayText(net: number): string {
  return Number.isInteger(net)
    ? net.toLocaleString('en-IN')
    : money(net);
}

export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso ?? '';
}

export const slipTitle = (s: Payslip) =>
  `PAYSLIP FOR THE MONTH OF ${MONTHS[s.month]} ${s.year}`;

export const fileName = (s: Payslip) => {
  const month = MONTHS[s.month];
  const name = (s.empName || 'Employee').trim().replace(/[^\w]+/g, '_');
  return `Salary Slip - ${month[0]}${month.slice(1, 3).toLowerCase()}${s.year} - ${name}.pdf`;
};

export const daysInMonth = (month: number, year: number) =>
  new Date(year, month + 1, 0).getDate();
