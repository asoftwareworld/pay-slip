export type FeeType = 'monthly' | 'hourly' | 'project';
export type LogoAlign = 'left' | 'center' | 'right';

export interface Agreement {
  addressee: string; // "To," block shown above the subject; may contain {{variables}}
  subject: string; // centered heading; may contain {{variables}}
  logoAlign: LogoAlign;
  date: string; // ISO yyyy-mm-dd
  place: string;

  companyName: string;
  companyAddress: string;
  companySignatory: string;
  companySignatoryTitle: string;

  consultantName: string;
  consultantAddress: string;
  consultantPan: string;
  consultantRole: string;

  services: string;
  startDate: string; // ISO
  termMonths: number;

  feeType: FeeType;
  feeAmount: number;
  paymentDays: number;
  gstApplicable: boolean;
  gstRate: number;

  noticeDays: number;
  confidentialityYears: number;
  governingLaw: string; // e.g. India
  courtCity: string;
}

export interface Clause {
  title: string;
  paras: string[];
}

/** User-edited agreement text. Clause body = paragraphs separated by a blank line. */
export interface CustomContent {
  intro: string;
  clauses: { title: string; body: string }[];
}

export const splitParas = (body: string): string[] =>
  body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

const today = () => new Date().toISOString().slice(0, 10);

export const DEFAULT_AGREEMENT: Agreement = {
  addressee: 'To,\n{{consultantName}},\n{{consultantAddress}}',
  subject: 'Subject: Consultant Agreement of {{consultantName}} as {{consultantRole}} at {{companyName}}',
  logoAlign: 'center',
  date: today(),
  place: 'City',

  companyName: 'Your Company Pvt Ltd',
  companyAddress: 'Street, City - 000 000',
  companySignatory: 'Authorised Signatory',
  companySignatoryTitle: 'Director',

  consultantName: 'Consultant Name',
  consultantAddress: 'Street, City - 000 000',
  consultantPan: '',
  consultantRole: 'Technical Consultant',

  services:
    'Software development and related technical consulting, including design, development, testing and documentation of software as reasonably requested by the Company from time to time.',
  startDate: today(),
  termMonths: 6,

  feeType: 'monthly',
  feeAmount: 100000,
  paymentDays: 15,
  gstApplicable: false,
  gstRate: 18,

  noticeDays: 30,
  confidentialityYears: 3,
  governingLaw: 'India',
  courtCity: 'City',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${Number(m[3])} ${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : (iso ?? '');
}


export const agreementFileName = (a: Agreement) =>
  `Consultancy Agreement - ${(a.consultantName || 'Consultant').trim().replace(/[^\w ]+/g, '')}.pdf`;
