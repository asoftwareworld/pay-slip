import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { Agreement, Clause, agreementFileName, longDate } from './agreement.model';
import { parseBold, plainText } from './agreement.template';

const M = 20; // page margin (mm)
const TOP = 22;
const BOTTOM = 297 - 22;
const W = 210 - 2 * M;
const LINE = 5;

interface Img {
  data: string;
  format: 'PNG' | 'JPEG';
  w: number;
  h: number;
}

@Injectable({ providedIn: 'root' })
export class AgreementPdfService {
  async download(a: Agreement, logo: string | null, addressee: string, subject: string, intro: string, clauses: Clause[]) {
    const doc = await this.build(a, logo, addressee, subject, intro, clauses);
    doc.save(agreementFileName(a));
  }

  async build(a: Agreement, logo: string | null, addressee: string, subject: string, intro: string, clauses: Clause[]) {
    const [{ jsPDF }, logoImg] = await Promise.all([import('jspdf'), this.load(logo)]);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = TOP;

    const ensure = (h: number) => {
      if (y + h > BOTTOM) {
        doc.addPage();
        y = TOP;
      }
    };
    /** Word-wrapped paragraph; **text** is drawn bold. */
    const paragraph = (text: string, size = 10, style: 'normal' | 'bold' = 'normal', gap = 2.5) => {
      doc.setFontSize(size);
      const toks: { t: string; b: boolean }[] = [];
      for (const seg of parseBold(text)) {
        for (const part of seg.text.split(/(\s+)/)) {
          if (part) toks.push({ t: part, b: seg.bold || style === 'bold' });
        }
      }
      const widthOf = (k: { t: string; b: boolean }) => {
        doc.setFont('helvetica', k.b ? 'bold' : 'normal');
        return doc.getTextWidth(k.t);
      };
      const isSpace = (k: { t: string }) => /^\s+$/.test(k.t);
      let line: typeof toks = [];
      let lineW = 0;
      const flush = () => {
        while (line.length && isSpace(line[line.length - 1])) line.pop();
        ensure(LINE);
        let cx = M;
        for (const k of line) {
          doc.setFont('helvetica', k.b ? 'bold' : 'normal');
          doc.text(k.t, cx, y, { baseline: 'top' });
          cx += widthOf(k);
        }
        y += LINE;
        line = [];
        lineW = 0;
      };
      for (const k of toks) {
        const w = widthOf(k);
        if (isSpace(k)) {
          if (line.length) {
            line.push(k);
            lineW += w;
          }
          continue;
        }
        if (line.length && lineW + w > W) flush();
        line.push(k);
        lineW += w;
      }
      if (line.length) flush();
      y += gap;
    };

    // ---- header
    if (logoImg) {
      const r = Math.min(50 / logoImg.w, 20 / logoImg.h);
      const w = logoImg.w * r;
      const x = a.logoAlign === 'center' ? (210 - w) / 2 : a.logoAlign === 'right' ? 210 - M - w : M;
      doc.addImage(logoImg.data, logoImg.format, x, y, w, logoImg.h * r);
      y += 20 + 5;
    }
    // ---- addressee ("To," block, left aligned)
    const toLines = addressee.split('\n').map((l) => l.trim()).filter(Boolean);
    toLines.forEach((line) => paragraph(line, 10, 'normal', 0));
    if (toLines.length) y += 5;

    // ---- subject (centered)
    doc.setFont('helvetica', 'bold').setFontSize(14);
    const subjectLines: string[] = doc.splitTextToSize(plainText(subject), W);
    for (const line of subjectLines) {
      doc.text(line, 105, y, { align: 'center', baseline: 'top' });
      y += 7;
    }
    y += 5;

    paragraph(intro, 10, 'normal', 4);

    // ---- clauses
    clauses.forEach((clause, i) => {
      ensure(LINE * 3); // keep heading with at least some text
      paragraph(`${i + 1}. ${clause.title.toUpperCase()}`, 10.5, 'bold', 1.5);
      clause.paras.forEach((p, j) => paragraph(`${i + 1}.${j + 1}  ${p}`));
      y += 1.5;
    });

    // ---- signatures
    ensure(60);
    y += 2;
    paragraph(
      'IN WITNESS WHEREOF, the Parties have signed this Agreement on the date written at the beginning of it.',
      10,
      'normal',
      10,
    );
    const colW = (W - 15) / 2;
    const blocks = [
      { x: M, head: `For ${a.companyName}`, name: a.companySignatory, title: a.companySignatoryTitle },
      { x: M + colW + 15, head: 'Consultant', name: a.consultantName, title: '' },
    ];
    const top = y;
    for (const b of blocks) {
      doc.setFont('helvetica', 'bold').setFontSize(10);
      doc.text(doc.splitTextToSize(b.head, colW) as string[], b.x, top, { baseline: 'top' });
      doc.setDrawColor(0).setLineWidth(0.3);
      doc.line(b.x, top + 22, b.x + colW, top + 22);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${b.name}`, b.x, top + 25, { baseline: 'top', maxWidth: colW });
      if (b.title) doc.text(`Designation: ${b.title}`, b.x, top + 30, { baseline: 'top', maxWidth: colW });
      doc.text(`Date: ${longDate(a.date)}`, b.x, top + (b.title ? 35 : 30), { baseline: 'top' });
    }

    // ---- page numbers
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(110);
      doc.text(`Page ${p} of ${pages}`, 105, 297 - 12, { align: 'center' });
    }
    doc.setTextColor(0);
    return doc as jsPDF;
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
