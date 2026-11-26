import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { AgreementPdfService } from './agreement-pdf.service';
import { Agreement, CustomContent, DEFAULT_AGREEMENT, FeeType, LogoAlign, longDate } from './agreement.model';
import { VARIABLES, defaultTemplate, render, renderContent, variablesFor } from './agreement.template';

const STORAGE_KEY = 'agreement-app:v2';

interface Saved {
  agreement: Agreement;
  logo: string | null;
  content: CustomContent;
}

@Component({
  selector: 'app-agreement',
  imports: [ReactiveFormsModule],
  templateUrl: './agreement.html',
  styleUrl: './agreement.css',
})
export class AgreementPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly pdf = inject(AgreementPdfService);

  readonly logo = signal<string | null>(null);
  readonly busy = signal(false);
  readonly variables = VARIABLES;
  readonly feeTypes: { value: FeeType; label: string }[] = [
    { value: 'monthly', label: 'Monthly fee' },
    { value: 'hourly', label: 'Per hour' },
    { value: 'project', label: 'Fixed project fee' },
  ];

  /** Editable clause text. {{variables}} inside it follow the form fields live. */
  readonly content = signal<CustomContent>(defaultTemplate());

  readonly form = this.buildForm(this.restore());
  private readonly raw = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });

  readonly ag = computed<Agreement>(() => {
    this.raw();
    return this.form.getRawValue() as Agreement;
  });
  private readonly rendered = computed(() => renderContent(this.content(), variablesFor(this.ag())));
  readonly intro = computed(() => this.rendered().intro);
  readonly addresseeText = computed(() => render(this.ag().addressee, variablesFor(this.ag())));
  readonly subjectText = computed(() => render(this.ag().subject, variablesFor(this.ag())));
  readonly logoAligns: { value: LogoAlign; label: string }[] = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ];
  readonly clauses = computed(() => this.rendered().clauses);
  readonly longDate = longDate;

  /** Last clause text box the user was typing in, so a variable chip can insert there. */
  private lastField: HTMLInputElement | HTMLTextAreaElement | null = null;

  constructor() {
    this.form.valueChanges.subscribe(() => this.persist());
  }

  // ---- clause editing
  private update(fn: (c: CustomContent) => CustomContent) {
    this.content.set(fn(this.content()));
    this.persist();
  }
  setIntro(intro: string) {
    this.update((c) => ({ ...c, intro }));
  }
  setClause(i: number, patch: Partial<{ title: string; body: string }>) {
    this.update((c) => ({ ...c, clauses: c.clauses.map((x, k) => (k === i ? { ...x, ...patch } : x)) }));
  }
  addClause() {
    this.update((c) => ({ ...c, clauses: [...c.clauses, { title: 'New clause', body: '' }] }));
  }
  removeClause(i: number) {
    this.update((c) => ({ ...c, clauses: c.clauses.filter((_, k) => k !== i) }));
  }
  moveClause(i: number, dir: -1 | 1) {
    this.update((c) => {
      const j = i + dir;
      if (j < 0 || j >= c.clauses.length) return c;
      const list = [...c.clauses];
      [list[i], list[j]] = [list[j], list[i]];
      return { ...c, clauses: list };
    });
  }
  resetClauses() {
    if (!confirm('Reset all clause text to the default template? Your edits will be lost.')) return;
    this.content.set(defaultTemplate());
    this.persist();
  }

  trackField(event: Event) {
    const t = event.target;
    if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type === 'text')) {
      this.lastField = t;
    }
  }

  insertVariable(name: string) {
    const el = this.lastField;
    if (!el || !el.isConnected) {
      alert('Pehle kisi clause ke text box mein click karo, phir variable chuno.');
      return;
    }
    const token = `{{${name}}}`;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.setRangeText(token, start, end, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }

  // ---- logo / pdf / reset
  async onLogo(event: Event) {
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
    this.logo.set(data);
    this.persist();
  }

  clearLogo() {
    this.logo.set(null);
    this.persist();
  }

  async download() {
    this.busy.set(true);
    try {
      await this.pdf.download(this.ag(), this.logo(), this.addresseeText(), this.subjectText(), this.intro(), this.clauses());
    } finally {
      this.busy.set(false);
    }
  }

  reset() {
    if (!confirm('Reset all agreement fields and clauses to the sample template?')) return;
    this.form.reset(DEFAULT_AGREEMENT);
    this.content.set(defaultTemplate());
    this.logo.set(null);
    this.persist();
  }

  private buildForm(a: Agreement) {
    const num = (v: number) => new FormControl<number>(v, { nonNullable: true });
    return this.fb.group({
      addressee: a.addressee,
      subject: a.subject,
      logoAlign: new FormControl<LogoAlign>(a.logoAlign, { nonNullable: true }),
      date: a.date,
      place: a.place,
      companyName: a.companyName,
      companyAddress: a.companyAddress,
      companySignatory: a.companySignatory,
      companySignatoryTitle: a.companySignatoryTitle,
      consultantName: a.consultantName,
      consultantAddress: a.consultantAddress,
      consultantPan: a.consultantPan,
      consultantRole: a.consultantRole,
      services: a.services,
      startDate: a.startDate,
      termMonths: num(a.termMonths),
      feeType: new FormControl<FeeType>(a.feeType, { nonNullable: true }),
      feeAmount: num(a.feeAmount),
      paymentDays: num(a.paymentDays),
      gstApplicable: new FormControl<boolean>(a.gstApplicable, { nonNullable: true }),
      gstRate: num(a.gstRate),
      noticeDays: num(a.noticeDays),
      confidentialityYears: num(a.confidentialityYears),
      governingLaw: a.governingLaw,
      courtCity: a.courtCity,
    });
  }

  private restore(): Agreement {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null;
      if (saved?.agreement) {
        queueMicrotask(() => {
          this.logo.set(saved.logo);
          if (saved.content?.clauses) this.content.set(saved.content);
        });
        return { ...DEFAULT_AGREEMENT, ...saved.agreement };
      }
    } catch {
      /* ignore corrupt storage */
    }
    return DEFAULT_AGREEMENT;
  }

  private persist() {
    try {
      const saved: Saved = { agreement: this.ag(), logo: this.logo(), content: this.content() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* storage unavailable or full */
    }
  }
}
