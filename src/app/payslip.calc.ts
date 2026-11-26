import { LineItem } from './payslip.model';

/**
 * Estimated yearly income tax, new regime (FY 2025-26 slabs):
 * Rs 75,000 standard deduction, 87A rebate up to Rs 12L taxable, 4% cess.
 * This is an estimate, not the employer's actual TDS.
 */
export function yearlyTax(annualGross: number): number {
  const taxable = Math.max(0, annualGross - 75000);
  if (taxable <= 1200000) return 0;
  const slabs: [number, number][] = [
    [400000, 0],
    [800000, 0.05],
    [1200000, 0.1],
    [1600000, 0.15],
    [2000000, 0.2],
    [2400000, 0.25],
    [Infinity, 0.3],
  ];
  let tax = 0;
  let from = 0;
  for (const [upto, rate] of slabs) {
    if (taxable > from) tax += (Math.min(taxable, upto) - from) * rate;
    from = upto;
  }
  return tax * 1.04;
}

export interface Breakup {
  earnings: LineItem[];
  deductions: LineItem[];
  gross: number;
}

const PT = 200;

function build(gross: number) {
  const basic = Math.round(gross * 0.4);
  const hra = Math.round(basic * 0.5);
  const pf = Math.round(basic * 0.12);
  const tax = Math.round(yearlyTax(gross * 12) / 12);
  return { basic, hra, pf, tax, net: gross - pf - PT - tax };
}

/**
 * Works backwards from a monthly Net Pay to a standard salary structure:
 * Basic 40% of gross, HRA 50% of basic, rest Special Allowance,
 * PF 12% of basic, PT 200, income tax estimated. Net Pay matches exactly.
 */
export function breakupForNet(targetNet: number): Breakup {
  const net = Math.round(targetNet);
  let gross = net;
  while (build(gross).net < net && gross < net * 4) gross++;

  const b = build(gross);
  const surplus = b.net - net; // < Rs 1-2 when found; absorbed in Special Allowance
  const finalGross = gross - surplus;
  const special = finalGross - b.basic - b.hra;

  return {
    gross: finalGross,
    earnings: [
      { label: 'Basic Pay', amount: b.basic },
      { label: 'House Rent Allowance', amount: b.hra },
      { label: 'Special Allowance', amount: special },
      { label: 'Others', amount: 0 },
      { label: 'Bonus', amount: 0 },
    ],
    deductions: [
      { label: 'Provident Fund', amount: b.pf },
      { label: 'Professional Tax', amount: PT },
      { label: 'Income Tax', amount: b.tax },
      { label: 'Advanced Tax', amount: 0 },
    ],
  };
}
