import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { amountInWords } from './number-to-words';
import { Payslip } from './payslip.model';
import { fileName, formatDate, money, netPayText, slipTitle, sum } from './payslip.utils';

/** Layout measured from the reference slip (A4, all values in mm). */
const L = {
  x: 18.7,
  w: 172.8,
  top: 23,
  headerH: 23.6,
  infoH: 36.7,
  tableHeadH: 6.6,
  rowH: 4.6,
  grossH: 7.3,
  tailH: 55.5,
  pad: 5.4, // left text padding
  valueX: 46.1, // offset of ":" column (left block)
  rightLabelX: 88.1,
  rightValueX: 122.9,
  divX: 87.2,
  amountR: 86.5,
  rightAmountR: 167.4,
};

interface Img {
  data: string;
  format: 'PNG' | 'JPEG';
  w: number;
  h: number;
}

@Injectable({ providedIn: 'root' })
export class PdfService {
  async download(slip: Payslip, logo?: string | null, signature?: string | null) {
    const doc = await this.build(slip, logo, signature);
    doc.save(fileName(slip));
  }

  async build(slip: Payslip, logo?: string | null, signature?: string | null) {
    const [logoImg, signImg] = await Promise.all([this.load(logo), this.load(signature)]);
    const { jsPDF } = await import('jspdf'); // lazy: keeps the initial bundle small
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const { x, w, top } = L;

    const rows = Math.max(slip.earnings.length, slip.deductions.length, 1);
    const headerB = top + L.headerH;
    const infoB = headerB + L.infoH;
    const tableHeadB = infoB + L.tableHeadH;
    const rowsB = tableHeadB + rows * L.rowH;
    const grossB = rowsB + L.grossH;
    const bottom = grossB + L.tailH;
    const right = x + w;
    const mid = x + L.divX;

    doc.setTextColor(0);
    doc.setDrawColor(0);

    // ---- frame & rules
    doc.setLineWidth(0.55);
    doc.rect(x, top, w, bottom - top);
    doc.setLineWidth(0.3);
    for (const y of [headerB, infoB, tableHeadB, rowsB, grossB]) doc.line(x, y, right, y);
    doc.line(mid, infoB, mid, grossB);

    // ---- header
    doc.setFont('helvetica', 'normal').setFontSize(10);
    const cx = x + w / 2 + 1;
    doc.text(slipTitle(slip), cx, top + 3.4, { align: 'center', baseline: 'middle' });
    doc.text(slip.companyName, cx, top + 12, { align: 'center', baseline: 'middle' });
    doc.text(slip.companyAddress, cx, top + 16.7, { align: 'center', baseline: 'middle' });
    doc.text(slip.companyPhone, cx, top + 21.2, { align: 'center', baseline: 'middle' });
    if (logoImg) this.fit(doc, logoImg, x + 2.5, top + 4.5, 38, 15);

    // ---- employee info
    const left: [string, string][] = [
      ['Emp ID', slip.empId],
      ['Emp Name', slip.empName],
      ['Designation', slip.designation],
      ['Date of Joining', formatDate(slip.doj)],
      ['Business Unit', slip.businessUnit],
      ['PAN', slip.pan],
    ];
    const rightCol: [string, string][] = [
      ['PF No.', slip.pfNo],
      ['Work Days', String(slip.workDays)],
      ['LOP Days', String(slip.lopDays)],
      ['Bank Name', slip.bankName],
      ['Bank A/C No', slip.bankAccount],
      ['UAN', slip.uan],
    ];
    // Long values shrink (down to 7pt) so they never run into the next column.
    const leftMaxW = x + L.rightLabelX - (x + L.valueX) - 3;
    const rightMaxW = right - (x + L.rightValueX) - 3;
    left.forEach(([k, v], i) => {
      const y = headerB + 3 + i * 5.3;
      doc.setFont('helvetica', 'bold').text(k, x + L.pad, y, { baseline: 'middle' });
      doc.setFont('helvetica', 'normal');
      this.fitText(doc, `: ${v}`, x + L.valueX, y, leftMaxW);
    });
    rightCol.forEach(([k, v], i) => {
      const y = headerB + 3 + i * 5.3;
      doc.setFont('helvetica', 'bold').text(k, x + L.rightLabelX, y, { baseline: 'middle' });
      doc.setFont('helvetica', 'normal');
      this.fitText(doc, `: ${v}`, x + L.rightValueX, y, rightMaxW);
    });

    // ---- earnings / deductions
    const hy = infoB + L.tableHeadH / 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Earnings', x + L.pad, hy, { baseline: 'middle' });
    doc.text('Amount', x + L.amountR, hy, { align: 'right', baseline: 'middle' });
    doc.text('Deductions', mid + 1, hy, { baseline: 'middle' });
    doc.text('Amount', x + L.rightAmountR, hy, { align: 'right', baseline: 'middle' });

    doc.setFont('helvetica', 'normal');
    for (let i = 0; i < rows; i++) {
      const y = tableHeadB + L.rowH / 2 + i * L.rowH;
      const e = slip.earnings[i];
      const d = slip.deductions[i];
      if (e) {
        doc.text(e.label, x + L.pad, y, { baseline: 'middle' });
        doc.text(money(e.amount), x + L.amountR, y, { align: 'right', baseline: 'middle' });
      }
      if (d) {
        doc.text(d.label, mid + 1, y, { baseline: 'middle' });
        doc.text(money(d.amount), x + L.rightAmountR, y, { align: 'right', baseline: 'middle' });
      }
    }

    const gy = rowsB + L.grossH / 2;
    const gross = sum(slip.earnings);
    const ded = sum(slip.deductions);
    doc.setFont('helvetica', 'bold');
    doc.text('GROSS EARNINGS', x + L.pad, gy, { baseline: 'middle' });
    doc.text(money(gross), x + L.amountR, gy, { align: 'right', baseline: 'middle' });
    doc.text('GROSS DEDUCTIONS', mid + 1, gy, { baseline: 'middle' });
    doc.text(money(ded), x + L.rightAmountR, gy, { align: 'right', baseline: 'middle' });

    // ---- net pay
    const net = gross - ded;
    const ny = grossB + 6.9;
    doc.setFont('helvetica', 'bold').text('NET PAY', x + L.pad, ny, { baseline: 'middle' });
    doc.setFont('helvetica', 'normal');
    doc.text('In Words', x + L.pad, ny + 4.6, { baseline: 'middle' });
    doc.text(`: Rs. ${netPayText(net)}`, x + L.valueX, ny, { baseline: 'middle' });
    const wordsW = right - (x + L.valueX) - L.pad;
    const wordLines: string[] = doc.splitTextToSize(`: ${amountInWords(net)}`, wordsW);
    wordLines.forEach((line, i) =>
      doc.text(line, x + L.valueX, ny + 4.6 + i * 4.6, { baseline: 'middle' }),
    );

    // ---- signature / stamp (user supplied) + footer
    if (signImg) this.fit(doc, signImg, right - 40, grossB + 19, 24, 22);
    doc.text(slip.footerNote, x + L.pad, bottom - 6.9, { baseline: 'middle' });

    return doc;
  }

  /** Draws text on one line, shrinking the font (min 7pt) and finally truncating with "…" to fit maxW. */
  private fitText(doc: jsPDF, text: string, x: number, y: number, maxW: number) {
    const base = doc.getFontSize();
    let size = base;
    while (size > 7 && doc.setFontSize(size).getTextWidth(text) > maxW) size -= 0.25;
    let out = text;
    while (out.length > 1 && doc.getTextWidth(out) > maxW) out = out.slice(0, -2).trimEnd() + '…';
    doc.text(out, x, y, { baseline: 'middle' });
    doc.setFontSize(base);
  }

  private fit(doc: jsPDF, img: Img, x: number, y: number, maxW: number, maxH: number) {
    const r = Math.min(maxW / img.w, maxH / img.h);
    const w = img.w * r;
    const h = img.h * r;
    doc.addImage(img.data, img.format, x + (maxW - w) / 2, y + (maxH - h) / 2, w, h);
  }

  private load(src?: string | null): Promise<Img | null> {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
      const el = new Image();
      el.onload = () =>
        resolve({
          data: src,
          format: src.startsWith('data:image/png') ? 'PNG' : 'JPEG',
          w: el.naturalWidth,
          h: el.naturalHeight,
        });
      el.onerror = () => resolve(null);
      el.src = src;
    });
  }
}
