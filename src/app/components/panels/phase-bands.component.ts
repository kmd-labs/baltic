import { Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ContentService } from '../../core/content/content.service';
import { EVENTS, PHASES } from '../../core/data/timeline';

/**
 * Phase bands and event-section diamonds drawn over the same 20 → 0 ka range as the
 * design-system timeline slider below it.
 */
@Component({
  selector: 'app-phase-bands',
  standalone: true,
  template: `
    @let c = content.content();
    @if (part() === 'bands') {
    <div class="bands">
      @for (p of phases; track p.id) {
        <div
          class="band"
          [attr.data-cls]="p.cls"
          [class.band--active]="p.from >= t() && p.to < t()"
          [style.left.%]="pos(p.from)"
          [style.width.%]="pos(p.to) - pos(p.from)"
          [title]="c?.phases?.[p.id]?.name ?? p.id">
          {{ c?.phases?.[p.id]?.short ?? '' }}
        </div>
      }
      @for (e of events; track e.id) {
        <button
          type="button"
          class="mark"
          [class.mark--active]="e.t === t()"
          [style.left.%]="pos(e.t)"
          [title]="c?.events?.[e.id]?.label ?? e.id"
          [attr.aria-label]="c?.events?.[e.id]?.label ?? e.id"
          (click)="pick.emit(e.t)"></button>
      }
    </div>
    } @else {
    <div class="ticks" aria-hidden="true">
      @for (k of ticks; track k) {
        <span [style.left.%]="pos(k)">{{ k === 0 ? '0' : k / 1000 + ' ka' }}</span>
      }
    </div>
    }
  `,
  styleUrl: './panels.scss'
})
export class PhaseBandsComponent {
  readonly t = input.required<number>();
  readonly part = input<'bands' | 'ticks'>('bands');
  readonly pick = output<number>();
  readonly i18n = inject(I18nService);
  readonly content = inject(ContentService);
  readonly phases = PHASES;
  readonly events = EVENTS;
  readonly ticks = [20000, 16000, 12000, 8000, 4000, 0];

  pos(t: number): number {
    return ((20000 - t) / 20000) * 100;
  }
}
