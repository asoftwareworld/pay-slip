const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t}-${o}` : t;
}

function wholeToWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  if (crore) parts.push(`${wholeToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) {
    parts.push(parts.length ? `and ${twoDigits(rest)}` : twoDigits(rest));
  }
  return parts.join(' ');
}

/** Indian-system amount in words, e.g. "One Lakh Eighty Thousand Eight Hundred and Eighty-Two Rupees Only" */
export function amountInWords(amount: number): string {
  const value = Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
  const rupees = Math.floor(value / 100);
  const paise = value % 100;
  let out = `${wholeToWords(rupees)} Rupees`;
  if (paise) out += ` and ${twoDigits(paise)} Paise`;
  return `${out} Only`;
}
