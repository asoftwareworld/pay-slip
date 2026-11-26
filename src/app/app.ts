import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { AgreementPage } from './agreement/agreement';
import { amountInWords } from './number-to-words';
import { breakupForNet } from './payslip.calc';
import { DEFAULT_PAYSLIP, LineItem, MONTHS, Payslip } from './payslip.model';
import { PdfService } from './pdf.service';
import { daysInMonth, formatDate, money, netPayText, slipTitle, sum } from './payslip.utils';

const STORAGE_KEY = 'payslip-app:v1';

interface Saved {
  slip: Payslip;
  logo: string | null;
  signature: string | null;
}

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, AgreementPage],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly pdf = inject(PdfService);

  readonly months = MONTHS;
  readonly years = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 8 + i);
  readonly logo = signal<string | null>(null);
  readonly signature = signal<string | null>(null);
  readonly busy = signal(false);
  readonly view = signal<'payslip' | 'agreement'>('payslip');
  readonly targetNet = new FormControl<number | null>(null);
  readonly targetError = signal<string | null>(null);

  readonly form = this.buildForm(this.restore());

  private readonly raw = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });

  readonly slip = computed<Payslip>(() => {
    this.raw();
    return this.form.getRawValue() as Payslip;
  });
  readonly gross = computed(() => sum(this.slip().earnings));
  readonly totalDed = computed(() => sum(this.slip().deductions));
  readonly net = computed(() => this.gross() - this.totalDed());
  readonly netText = computed(() => netPayText(this.net()));
  readonly words = computed(() => amountInWords(this.net()));
  readonly title = computed(() => slipTitle(this.slip()));
  readonly rows = computed(() => {
    const { earnings, deductions } = this.slip();
    const n = Math.max(earnings.length, deductions.length);
    return Array.from({ length: n }, (_, i) => ({
      e: earnings[i] as LineItem | undefined,
      d: deductions[i] as LineItem | undefined,
    }));
  });

  readonly money = money;
  readonly formatDate = formatDate;

  get earnings() {
    return this.form.controls.earnings;
  }
  get deductions() {
    return this.form.controls.deductions;
  }

  constructor() {
    this.form.valueChanges.subscribe(() => this.persist());
  }

  add(list: 'earnings' | 'deductions') {
    this.form.controls[list].push(this.lineGroup({ label: '', amount: 0 }));
  }

  remove(list: 'earnings' | 'deductions', i: number) {
    this.form.controls[list].removeAt(i);
  }

  setWorkDaysFromMonth() {
    const { month, year } = this.form.getRawValue();
    this.form.controls.workDays.setValue(daysInMonth(month, year));
  }

  async onImage(event: Event, target: 'logo' | 'signature') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      alert('Please choose a PNG or JPG image.');
      return;
    }
    const data = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(file);
    });
    (target === 'logo' ? this.logo : this.signature).set(data);
    this.persist();
  }

  clearImage(target: 'logo' | 'signature') {
    (target === 'logo' ? this.logo : this.signature).set(null);
    this.persist();
  }

  async download() {
    this.busy.set(true);
    try {
      await this.pdf.download(this.slip(), this.logo(), this.signature());
    } finally {
      this.busy.set(false);
    }
  }

  reset() {
    if (!confirm('Reset all fields to sample data?')) return;
    this.syncArrays(DEFAULT_PAYSLIP);
    this.form.patchValue(DEFAULT_PAYSLIP);
    this.logo.set(null);
    this.signature.set(null);
    this.persist();
  }

  // ---- internals
  applyTargetNet() {
    const target = this.targetNet.value;
    if (!target || target <= 0) {
      this.targetError.set('Enter a Net Pay greater than 0.');
      return;
    }
    this.targetError.set(null);
    const b = breakupForNet(target);
    this.syncArrays(b);
    this.persist();
  }

  private syncArrays(s: Pick<Payslip, 'earnings' | 'deductions'>) {
    for (const key of ['earnings', 'deductions'] as const) {
      const arr = this.form.controls[key];
      arr.clear();
      s[key].forEach((i) => arr.push(this.lineGroup(i)));
    }
  }

  private lineGroup(i: LineItem) {
    return this.fb.group({
      label: this.fb.control(i.label),
      amount: new FormControl<number>(i.amount, { nonNullable: true }),
    });
  }

  private buildForm(s: Payslip) {
    return this.fb.group({
      companyName: s.companyName,
      companyAddress: s.companyAddress,
      companyPhone: s.companyPhone,
      month: s.month,
      year: s.year,
      empId: s.empId,
      empName: s.empName,
      designation: s.designation,
      doj: s.doj,
      businessUnit: s.businessUnit,
      pan: s.pan,
      pfNo: s.pfNo,
      workDays: new FormControl<number>(s.workDays, { nonNullable: true }),
      lopDays: new FormControl<number>(s.lopDays, { nonNullable: true }),
      bankName: s.bankName,
      bankAccount: s.bankAccount,
      uan: s.uan,
      earnings: new FormArray(s.earnings.map((i) => this.lineGroup(i))),
      deductions: new FormArray(s.deductions.map((i) => this.lineGroup(i))),
      footerNote: s.footerNote,
    });
  }

  private restore(): Payslip {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null;
      if (saved?.slip) {
        queueMicrotask(() => {
          this.logo.set(saved.logo);
          this.signature.set(saved.signature);
        });
        return { ...DEFAULT_PAYSLIP, ...saved.slip };
      }
    } catch {
      /* ignore corrupt storage */
    }
    return DEFAULT_PAYSLIP;
  }

  private persist() {
    try {
      const saved: Saved = { slip: this.slip(), logo: this.logo(), signature: this.signature() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* storage unavailable or full */
    }
  }
}
