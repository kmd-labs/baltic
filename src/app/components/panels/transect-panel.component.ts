import { Component, computed, effect, inject, input } from '@angular/core';
import { ThemeService } from '@kmd/design-system/services/theme.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ContentService } from '../../core/content/content.service';
import { PaleoDataService } from '../../core/data/paleo-data.service';
import { phaseAt } from '../../core/data/timeline';
import { CanvasPanel } from './canvas-panel';

/** Elevation profile Umeå → Gdańsk in the frame: land and floor, water, ice, today's floor. */
@Component({
  selector: 'app-transect-panel',
  standalone: true,
  template: `
    @let tr = i18n.t();
    <div class="panel__head">
      <h3 class="panel__title">{{ tr.transectTitle }}</h3>
      <span class="panel__meta">{{ meta() }}</span>
    </div>
    <div class="legend">
      <span><i class="ln" style="border-color: var(--color-paleo-earth-line)"></i>{{ tr.transectFloor }}</span>
      <span><i class="ln ln--dash"></i>{{ tr.transectToday }}</span>
      <span><i class="sw" style="background: var(--color-paleo-ice-band)"></i>{{ tr.transectIce }}</span>
    </div>
    <canvas #cv [attr.aria-label]="tr.transectAria" role="img"></canvas>
  `,
  styleUrl: './panels.scss'
})
export class TransectPanelComponent extends CanvasPanel {
  readonly t = input.required<number>();
  readonly i18n = inject(I18nService);
  private readonly content = inject(ContentService);
  private readonly theme = inject(ThemeService);
  private readonly data = inject(PaleoDataService);

  readonly meta = computed(() => {
    if (this.data.state() !== 'ready') return '';
    const f = this.data.frame(this.t());
    const tr = this.i18n.t();
    return f.lakeLevelM > 0 ? tr.transectMetaLake('+' + Math.round(f.lakeLevelM)) : tr.transectMetaOcean;
  });

  constructor() {
    super();
    effect(() => {
      this.t();
      this.data.state();
      this.content.content();
      this.redraw();
    });
  }

  protected draw(x: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.data.state() !== 'ready') return;
    const t = this.t();
    const f = this.data.frame(t);
    const { total, points } = this.data.transect(f);
    const tok = (k: string, fb: string) => this.theme.getTokenColor(k, fb);
    const font = this.theme.getFontFamily();
    const pad = { l: 34, r: 6, t: 8, b: 16 };
    const z0 = -320;
    const z1 = 460;
    const X = (s: number) => pad.l + (s / total) * (w - pad.l - pad.r);
    const Y = (z: number) => pad.t + ((z1 - Math.min(z1, Math.max(z0, z))) / (z1 - z0)) * (h - pad.t - pad.b);

    x.font = `10px ${font}`;
    x.textAlign = 'right';
    x.textBaseline = 'middle';
    x.fillStyle = tok('text-dim', '#64748b');
    for (const z of [-200, 0, 200, 400]) {
      x.strokeStyle = tok('line', 'rgba(15,23,42,0.1)');
      x.beginPath();
      x.moveTo(pad.l, Y(z));
      x.lineTo(w - pad.r, Y(z));
      x.stroke();
      x.fillText((z > 0 ? '+' : z < 0 ? '−' : '') + Math.abs(z), pad.l - 5, Y(z));
    }

    const cls = phaseAt(t).cls;
    const water = tok(cls === 'marine' ? 'paleo-marine' : cls === 'brackish' ? 'paleo-brackish' : 'paleo-fresh', '#8dbcdc');
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (a.level != null && b.level != null) {
        x.fillStyle = water;
        x.globalAlpha = 0.85;
        x.beginPath();
        x.moveTo(X(a.km), Y(a.level));
        x.lineTo(X(b.km), Y(b.level));
        x.lineTo(X(b.km), Y(b.hPaleo));
        x.lineTo(X(a.km), Y(a.hPaleo));
        x.closePath();
        x.fill();
        x.globalAlpha = 1;
      }
    }
    // Ice: no thickness yet (C-07) — a band above the surface marks where the ice lies.
    x.fillStyle = tok('paleo-ice-band', 'rgba(255,255,255,0.45)');
    for (let i = 0; i < points.length - 1; i++) {
      if (!points[i].ice) continue;
      x.fillRect(X(points[i].km), pad.t, X(points[i + 1].km) - X(points[i].km) + 0.5, h - pad.t - pad.b);
    }

    x.beginPath();
    points.forEach((p, i) => (i ? x.lineTo(X(p.km), Y(p.hPaleo)) : x.moveTo(X(p.km), Y(p.hPaleo))));
    x.lineTo(X(total), h - pad.b);
    x.lineTo(X(0), h - pad.b);
    x.closePath();
    x.fillStyle = tok('paleo-earth', '#d6cfb9');
    x.fill();
    x.beginPath();
    points.forEach((p, i) => (i ? x.lineTo(X(p.km), Y(p.hPaleo)) : x.moveTo(X(p.km), Y(p.hPaleo))));
    x.strokeStyle = tok('paleo-earth-line', '#8c8369');
    x.lineWidth = 1.2;
    x.stroke();

    x.setLineDash([3, 3]);
    x.strokeStyle = tok('text-dim', '#64748b');
    x.lineWidth = 1;
    x.beginPath();
    points.forEach((p, i) => (i ? x.lineTo(X(p.km), Y(p.hNow)) : x.moveTo(X(p.km), Y(p.hNow))));
    x.stroke();
    x.setLineDash([]);

    const places = this.content.content()?.places;
    x.font = `600 10px ${font}`;
    x.fillStyle = tok('text-desc', '#334155');
    x.textBaseline = 'alphabetic';
    x.textAlign = 'left';
    x.fillText(`A · ${places?.umea ?? 'Umeå'}`, pad.l + 2, h - 3);
    x.textAlign = 'right';
    x.fillText(`${places?.gdansk ?? 'Gdańsk'} · B`, w - pad.r, h - 3);
    const g = points.reduce((best, p) => (Math.abs(p.lat - 57.3) < Math.abs(best.lat - 57.3) ? p : best), points[0]);
    x.textAlign = 'center';
    x.fillText(places?.gotland ?? 'Gotland', X(g.km), h - 3);
  }
}
