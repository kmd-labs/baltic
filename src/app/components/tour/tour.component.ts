import { Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TourStepId } from '../../core/i18n/i18n.types';

export interface TourStep {
  id: TourStepId;
  /** CSS selector of the element to highlight. */
  target: string;
}

/**
 * Guided tour, started from the "Tutorial" pill (never automatically). Each step highlights one
 * control with its number; the rest of the screen is dimmed. Back / Next / Finish, × and Esc.
 */
@Component({
  selector: 'app-tour',
  standalone: true,
  template: `
    @if (index() >= 0 && rect(); as r) {
      @let tr = i18n.t();
      @let step = steps()[index()];
      <div class="blocker" aria-hidden="true"></div>
      <div
        class="spot"
        [style.left.px]="r.left - pad"
        [style.top.px]="r.top - pad"
        [style.width.px]="r.width + pad * 2"
        [style.height.px]="r.height + pad * 2">
        <span class="spot__num" [class.spot__num--in]="r.left < 16 || r.top < 16">{{ index() + 1 }}</span>
      </div>
      <div
        #card
        class="card"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="'tour-title'"
        [style.left.px]="cardPos().left"
        [style.top.px]="cardPos().top">
        <div class="card__head">
          <span class="card__step">{{ tr.tourStepOf(index() + 1, steps().length) }}</span>
          <button type="button" class="card__x" [attr.aria-label]="tr.tourClose" (click)="close()">×</button>
        </div>
        <h2 id="tour-title" class="card__title">{{ tr.tourSteps[step.id].title }}</h2>
        <p class="card__text">{{ tr.tourSteps[step.id].text }}</p>
        <div class="card__actions">
          <button type="button" class="btn btn--ghost" [disabled]="index() === 0" (click)="go(index() - 1)">{{ tr.tourPrev }}</button>
          @if (index() < steps().length - 1) {
            <button #next type="button" class="btn" (click)="go(index() + 1)">{{ tr.tourNext }}</button>
          } @else {
            <button #next type="button" class="btn" (click)="close()">{{ tr.tourDone }}</button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host { position: fixed; inset: 0; z-index: 200; pointer-events: none; }
      .blocker { position: fixed; inset: 0; pointer-events: auto; }
      .spot {
        position: fixed; border-radius: 14px; pointer-events: none;
        box-shadow: 0 0 0 2px var(--color-accent), 0 0 0 9999px rgba(15, 23, 42, 0.38);
        transition: left 0.25s ease, top 0.25s ease, width 0.25s ease, height 0.25s ease;
      }
      .spot__num {
        position: absolute; top: -11px; left: -11px; display: grid; place-items: center; width: 22px; height: 22px;
        border-radius: 50%; background: var(--color-accent); color: #fff; font-size: 12px; font-weight: 700;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      }
      .spot__num--in { top: 4px; left: 4px; }
      .card {
        position: fixed; width: min(320px, calc(100vw - 24px)); padding: 14px 16px 12px; border-radius: 14px;
        background: var(--color-panel-bg-heavy); box-shadow: 0 16px 40px rgba(15, 23, 42, 0.28);
        pointer-events: auto; transition: left 0.25s ease, top 0.25s ease;
      }
      .card__head { display: flex; justify-content: space-between; align-items: center; }
      .card__step { font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-dim); }
      .card__x { border: 0; background: transparent; font-size: 18px; line-height: 1; color: var(--color-text-dim); cursor: pointer; padding: 0 2px; }
      .card__x:hover { color: var(--color-text-bright); }
      .card__title { margin: 4px 0 4px; font-size: 15px; font-weight: 700; color: var(--color-text-bright); }
      .card__text { margin: 0 0 12px; font-size: 12.5px; line-height: 1.45; color: var(--color-text-desc); }
      .card__actions { display: flex; justify-content: flex-end; gap: 6px; }
      .btn {
        height: 30px; padding: 0 14px; border: 0; border-radius: 999px; font: inherit; font-size: 12.5px; font-weight: 600;
        background: var(--color-text-bright); color: #fff; cursor: pointer;
      }
      .btn--ghost { background: var(--color-btn-bg); color: var(--color-text-main); }
      .btn:disabled { opacity: 0.4; cursor: default; }
      .btn:focus-visible, .card__x:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) { .spot, .card { transition: none; } }
    `
  ]
})
export class TourComponent implements OnDestroy {
  readonly steps = input.required<TourStep[]>();
  /** Fired before a step is shown, so the host can make its target visible (open the dock, switch tab). */
  readonly stepShown = output<TourStepId>();
  readonly closed = output<void>();
  readonly i18n = inject(I18nService);
  private readonly zone = inject(NgZone);

  @ViewChild('card') cardRef?: ElementRef<HTMLElement>;

  readonly pad = 6;
  readonly index = signal(-1);
  readonly rect = signal<DOMRect | null>(null);
  private readonly viewport = signal({ w: window.innerWidth, h: window.innerHeight });
  private raf = 0;
  private returnFocus: HTMLElement | null = null;

  /** Card next to the highlighted element: below if there is room, else above; kept on screen. */
  readonly cardPos = computed(() => {
    const r = this.rect();
    const { w, h } = this.viewport();
    if (!r) return { left: 0, top: 0 };
    const cw = Math.min(320, w - 24);
    const ch = 170;
    const below = r.bottom + this.pad + 12;
    const top = below + ch < h ? below : Math.max(12, r.top - this.pad - 12 - ch);
    const left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), w - cw - 12);
    return { left, top };
  });

  start(): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.go(0);
    this.zone.runOutsideAngular(() => this.track());
  }

  go(i: number): void {
    const step = this.steps()[i];
    if (!step) return;
    this.stepShown.emit(step.id);
    this.index.set(i);
    // The target may appear only after the host reacted (dock expanded, tab switched).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.measure();
        // Focus the primary action (Next / Finish) once the card is rendered.
        setTimeout(() => this.cardRef?.nativeElement.querySelector<HTMLElement>('.card__actions .btn:last-child')?.focus());
      })
    );
  }

  close(): void {
    this.index.set(-1);
    this.rect.set(null);
    cancelAnimationFrame(this.raf);
    this.closed.emit();
    this.returnFocus?.focus?.();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (this.index() < 0) return;
    if (e.key === 'Escape') this.close();
    else if (e.key === 'ArrowRight') this.go(this.index() + 1);
    else if (e.key === 'ArrowLeft') this.go(this.index() - 1);
  }

  /** Follow the target while the tour is open (layout changes, resize). */
  private track(): void {
    const loop = () => {
      if (this.index() < 0) return;
      this.measure();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private measure(): void {
    const step = this.steps()[this.index()];
    const el = step ? (document.querySelector(step.target) as HTMLElement | null) : null;
    const r = el?.getBoundingClientRect() ?? null;
    const prev = this.rect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw !== this.viewport().w || vh !== this.viewport().h) this.zone.run(() => this.viewport.set({ w: vw, h: vh }));
    if (r && (!prev || r.left !== prev.left || r.top !== prev.top || r.width !== prev.width || r.height !== prev.height)) {
      this.zone.run(() => this.rect.set(r));
    }
  }
}
