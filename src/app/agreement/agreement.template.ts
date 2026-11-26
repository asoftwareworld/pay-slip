import { amountInWords } from '../number-to-words';
import { Agreement, Clause, CustomContent, longDate, splitParas } from './agreement.model';

const inr = (n: number) => `Rs. ${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

function endDate(startIso: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startIso ?? '');
  if (!m || !(months > 0)) return '';
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + months, Number(m[3]) - 1))
    .toISOString()
    .slice(0, 10);
}

/** Variables usable in clause text as {{name}}. Values follow the form fields live. */
export const VARIABLES: { name: string; hint: string }[] = [
  { name: 'companyName', hint: 'Company name' },
  { name: 'companyAddress', hint: 'Company address' },
  { name: 'companySignatory', hint: 'Company signatory' },
  { name: 'companySignatoryTitle', hint: 'Signatory designation' },
  { name: 'consultantName', hint: 'Consultant name' },
  { name: 'consultantAddress', hint: 'Consultant address' },
  { name: 'consultantRole', hint: 'Consultant role / designation' },
  { name: 'consultantPanText', hint: ', PAN … (blank if empty)' },
  { name: 'date', hint: 'Agreement date' },
  { name: 'place', hint: 'Place' },
  { name: 'services', hint: 'Description of services' },
  { name: 'startDate', hint: 'Start date' },
  { name: 'endDate', hint: 'End date (start + term)' },
  { name: 'termText', hint: 'e.g. 6 months' },
  { name: 'feeAmount', hint: 'e.g. Rs. 1,00,000' },
  { name: 'feeAmountWords', hint: 'Fee amount in words' },
  { name: 'feeText', hint: 'e.g. a fee of Rs. … per month' },
  { name: 'invoiceTiming', hint: 'When invoices are raised' },
  { name: 'paymentDaysText', hint: 'e.g. 15 days' },
  { name: 'taxClause', hint: 'GST / tax sentence' },
  { name: 'noticeText', hint: 'e.g. 30 days' },
  { name: 'confidentialityText', hint: 'e.g. 3 years' },
  { name: 'governingLaw', hint: 'Governing law' },
  { name: 'courtCity', hint: 'City of courts' },
];

export function variablesFor(a: Agreement): Record<string, string> {
  const amt = inr(a.feeAmount);
  const words = amountInWords(a.feeAmount);
  const feeText =
    a.feeType === 'hourly'
      ? `a fee of ${amt} (${words}) per hour for Services actually performed`
      : a.feeType === 'project'
        ? `a fixed fee of ${amt} (${words}) for the complete performance of the Services`
        : `a fee of ${amt} (${words}) per month`;
  const taxClause = a.gstApplicable
    ? `The Fees are exclusive of GST at ${a.gstRate}%, which the Consultant shall charge separately on a valid tax invoice.`
    : 'The Fees are inclusive of all taxes and charges payable by the Consultant, other than taxes the Company is required by law to deduct at source.';
  const end = endDate(a.startDate, a.termMonths);

  return {
    companyName: a.companyName,
    companyAddress: a.companyAddress,
    companySignatory: a.companySignatory,
    companySignatoryTitle: a.companySignatoryTitle,
    consultantName: a.consultantName,
    consultantAddress: a.consultantAddress,
    consultantRole: a.consultantRole,
    consultantPanText: a.consultantPan.trim() ? `, PAN ${a.consultantPan.trim()}` : '',
    date: longDate(a.date),
    place: a.place,
    services: a.services.trim() || '[Describe the Services]',
    startDate: longDate(a.startDate),
    endDate: end ? longDate(end) : '',
    termText: plural(a.termMonths, 'month'),
    feeAmount: amt,
    feeAmountWords: words,
    feeText,
    invoiceTiming: a.feeType === 'project' ? 'as per the agreed milestones' : 'at the end of each month',
    paymentDaysText: plural(a.paymentDays, 'day'),
    taxClause,
    noticeText: plural(a.noticeDays, 'day'),
    confidentialityText: plural(a.confidentialityYears, 'year'),
    governingLaw: a.governingLaw,
    courtCity: a.courtCity,
  };
}

export interface Seg {
  text: string;
  bold: boolean;
}

/** Splits text on ** markers: "a **b** c" -> [a, b(bold), c]. An unmatched ** stays as plain text. */
export function parseBold(text: string): Seg[] {
  const parts = text.split('**');
  if (parts.length % 2 === 0) return [{ text, bold: false }]; // odd number of markers
  return parts.map((p, i) => ({ text: p, bold: i % 2 === 1 })).filter((s) => s.text !== '');
}

export const plainText = (text: string) => parseBold(text).map((s) => s.text).join('');

/** Replaces {{name}} with its value; unknown names are left visible so typos are easy to spot. */
export function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

export function renderContent(content: CustomContent, vars: Record<string, string>) {
  return {
    intro: render(content.intro, vars),
    clauses: content.clauses.map<Clause>((c) => ({
      title: render(c.title, vars),
      paras: splitParas(render(c.body, vars)),
    })),
  };
}

const c = (title: string, ...paras: string[]) => ({ title, body: paras.join('\n\n') });

export function defaultTemplate(): CustomContent {
  return {
    intro:
      'This Consultancy Agreement (the “Agreement”) is made on {{date}} at {{place}} between ' +
      '{{companyName}}, having its office at {{companyAddress}} (the “Company”), and ' +
      '{{consultantName}}, residing at {{consultantAddress}}{{consultantPanText}} (the “Consultant”). ' +
      'The Company and the Consultant are together called the “Parties” and each a “Party”.',
    clauses: [
      c(
        'Appointment and Services',
        'The Company appoints the Consultant, and the Consultant agrees, to provide the following services (the “Services”):',
        '{{services}}',
        'The Consultant shall perform the Services with reasonable skill, care and diligence and in line with the reasonable instructions of the Company regarding deliverables and timelines.',
      ),
      c(
        'Term',
        'This Agreement starts on {{startDate}} (the “Effective Date”) and, unless ended earlier under the Termination clause, continues for {{termText}} until {{endDate}}. It may be extended only by a written agreement signed by both Parties.',
      ),
      c(
        'Fees and Payment',
        'The Company shall pay the Consultant {{feeText}} (the “Fees”).',
        'The Consultant shall raise an invoice {{invoiceTiming}}. The Company shall pay each undisputed invoice within {{paymentDaysText}} of receiving it.',
        '{{taxClause}}',
        'The Company may deduct tax at source as required by applicable law and shall give the Consultant the related tax deduction certificate. Unless approved by the Company in writing in advance, the Consultant bears their own expenses.',
      ),
      c(
        'Independent Contractor',
        'The Consultant is an independent contractor. Nothing in this Agreement creates an employment, partnership, joint venture or agency relationship between the Parties.',
        'The Consultant decides how, when and where to perform the Services (subject to agreed deliverables), is responsible for their own taxes, statutory dues and insurance, and is not entitled to employee benefits from the Company.',
      ),
      c(
        'Confidentiality',
        'The Consultant shall keep confidential all non-public information of the Company and its clients that is disclosed or learned in connection with this Agreement (“Confidential Information”), use it only to perform the Services, and not disclose it to anyone without the Company’s written consent.',
        'This clause does not apply to information that is or becomes public without the Consultant’s fault, was lawfully known to the Consultant before disclosure, or must be disclosed by law (in which case the Consultant shall inform the Company first where permitted).',
        'These obligations continue during the term of this Agreement and for {{confidentialityText}} after it ends.',
      ),
      c(
        'Intellectual Property',
        'All work product, deliverables and materials created by the Consultant specifically for the Company under this Agreement (“Work Product”) belong to the Company on full payment of the Fees. The Consultant assigns all rights in the Work Product to the Company for that purpose.',
        'The Consultant keeps ownership of their pre-existing tools, know-how and materials and grants the Company a non-exclusive, perpetual licence to use them as part of the Work Product.',
        'The Consultant confirms that the Work Product will not knowingly infringe the rights of any third party.',
      ),
      c(
        'Termination',
        'Either Party may terminate this Agreement at any time by giving the other Party {{noticeText}}’ written notice.',
        'Either Party may terminate immediately by written notice if the other Party commits a material breach and fails to fix it within 7 days of a written request to do so.',
        'On termination, the Company shall pay the Fees for Services performed up to the termination date, and the Consultant shall hand over all Work Product and return or delete all Confidential Information. The clauses on Confidentiality, Intellectual Property, Limitation of Liability and Governing Law survive termination.',
      ),
      c(
        'Limitation of Liability',
        'To the extent permitted by law, neither Party is liable to the other for indirect, incidental or consequential loss. The Consultant’s total liability under this Agreement is limited to the Fees paid or payable in the three (3) months before the claim arose, except for breach of confidentiality, wilful misconduct or fraud.',
      ),
      c(
        'Governing Law and Disputes',
        'This Agreement is governed by the laws of {{governingLaw}}.',
        'The Parties shall first try to settle any dispute amicably through discussion. If it is not settled within 30 days, the courts at {{courtCity}} shall have exclusive jurisdiction.',
      ),
      c(
        'General',
        'This Agreement is the entire agreement between the Parties on its subject and replaces all earlier discussions and understandings. It can be changed only in writing signed by both Parties.',
        'If any part of this Agreement is held invalid, the rest stays in force. A delay in exercising a right is not a waiver of it. Neither Party may assign this Agreement without the other’s written consent.',
        'Notices must be in writing and sent to the addresses given above (or any updated address notified in writing). This Agreement may be signed in counterparts, including electronically, each of which is an original.',
      ),
    ],
  };
}
