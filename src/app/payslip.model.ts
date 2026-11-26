export interface LineItem {
  label: string;
  amount: number;
}

export interface Payslip {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  month: number; // 0-11
  year: number;

  empId: string;
  empName: string;
  designation: string;
  doj: string; // ISO yyyy-mm-dd
  businessUnit: string;
  pan: string;

  pfNo: string;
  workDays: number;
  lopDays: number;
  bankName: string;
  bankAccount: string;
  uan: string;

  earnings: LineItem[];
  deductions: LineItem[];
  footerNote: string;
}

export const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

export const DEFAULT_PAYSLIP: Payslip = {
  companyName: 'Your Company Pvt Ltd',
  companyAddress: 'Street, City - 000 000',
  companyPhone: 'Tel - +91 0000000000',
  month: new Date().getMonth(),
  year: new Date().getFullYear(),

  empId: 'E-0001',
  empName: 'Employee Name',
  designation: 'Software Engineer',
  doj: '2022-01-01',
  businessUnit: 'Engineering',
  pan: 'ABCDE1234F',

  pfNo: '',
  workDays: 30,
  lopDays: 0,
  bankName: 'Bank Name',
  bankAccount: '000000000000',
  uan: '',

  earnings: [
    // Gross 3,00,000 / month: Basic 40%, HRA 50% of basic, rest special allowance
    { label: 'Basic Pay', amount: 120000 },
    { label: 'House Rent Allowance', amount: 60000 },
    { label: 'Special Allowance', amount: 120000 },
    { label: 'Others', amount: 0 },
    { label: 'Bonus', amount: 0 },
  ],
  deductions: [
    { label: 'Provident Fund', amount: 14400 }, // 12% of basic
    { label: 'Professional Tax', amount: 200 },
    { label: 'Income Tax', amount: 52552 }, // Net Pay = 2,32,848
    { label: 'Advanced Tax', amount: 0 },
  ],
  footerNote: 'This document contains confidential information',
};
