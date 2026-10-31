import { Component, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ContentService } from '../../core/content/content.service';
import { PHASES } from '../../core/data/timeline';

/**
 * Phase bands drawn over the same 20 → 0 ka range as the design-system timeline slider below
 * it. Event sections are listed in the phase card, not pinned here.
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
          <span class="band__label">{{ c?.phases?.[p.id]?.short ?? '' }}</span>
        </div>
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
  readonly i18n = inject(I18nService);
  readonly content = inject(ContentService);
  readonly phases = PHASES;
  readonly ticks = [20000, 16000, 12000, 8000, 4000, 0];

  pos(t: number): number {
    return ((20000 - t) / 20000) * 100;
  }
}
