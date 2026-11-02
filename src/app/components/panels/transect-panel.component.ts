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
      <span><i class="sw" style="background: var(--color-paleo-ice-section)"></i>{{ tr.transectIce }}</span>
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
    this.data.version();
    if (this.data.state() !== 'ready') return '';
    // The interpolated level, the one the scene draws — not the nearest frame's (`A-01`).
    const s = this.data.sceneWater(this.t());
    if (!s) return '';
    const tr = this.i18n.t();
    return s.lakeLevelM > 0 ? tr.transectMetaLake('+' + Math.round(s.lakeLevelM)) : tr.transectMetaOcean;
  });

  constructor() {
    super();
    effect(() => {
      this.t();
      this.data.state();
      this.data.version();
      this.content.content();
      this.redraw();
    });
  }

  protected draw(x: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.data.state() !== 'ready') return;
    const t = this.t();
    const profile = this.data.transect(t);
    if (!profile) return;
    const { total, points } = profile;
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
    // Ice: a band marking where the sheet lies. The band cannot be drawn to the elevation axis —
    // this chart spans 780 m and the sheet is ~3000 m thick (the globe shows the body itself,
    // C-07) — so the *shape* goes inside it instead: a profile normalised to its own maximum,
    // labelled with that maximum in metres (C-07b). The reader gets what the plastic profile
    // actually says, which is that the sheet thickens inland, without the chart implying that
    // 3000 m of ice fits in 780 m of axis. Drawn as one rectangle per contiguous run, so the
    // translucent fill does not double up at the segment joins, with the margins picked out:
    // that edge is the part worth reading.
    const iceTop = pad.t;
    const iceBottom = h - pad.b;
    x.fillStyle = tok('paleo-ice-section', 'rgba(207,216,227,0.62)');
    x.strokeStyle = tok('paleo-ice-edge', '#7dd3fc');
    x.lineWidth = 1;
    for (let i = 0; i < points.length; i++) {
      if (!points[i].ice) continue;
      let j = i;
      while (j + 1 < points.length && points[j + 1].ice) j++;
      const x0 = X(points[i].km);
      const x1 = j + 1 < points.length ? X(points[j + 1].km) : X(total);
      x.fillRect(x0, iceTop, x1 - x0, iceBottom - iceTop);
      // Half-pixel offset keeps a 1 px line crisp.
      x.beginPath();
      for (const edgeX of [x0, x1]) {
        x.moveTo(Math.round(edgeX) + 0.5, iceTop);
        x.lineTo(Math.round(edgeX) + 0.5, iceBottom);
      }
      x.stroke();
      i = j;
    }

    // The thickness profile inside the band, normalised to the maximum over the whole transect so
    // the two runs of a split margin stay comparable, plus that maximum as a label.
    const iceMax = points.reduce((m, p) => Math.max(m, p.iceM), 0);
    if (iceMax > 0) {
      const base = iceBottom - 4;
      const span = iceBottom - iceTop - 12;
      x.beginPath();
      let open = false;
      for (const p of points) {
        if (p.iceM <= 0) {
          open = false;
          continue;
        }
        const px = X(p.km);
        const py = base - (p.iceM / iceMax) * span;
        if (open) x.lineTo(px, py);
        else x.moveTo(px, py);
        open = true;
      }
      x.strokeStyle = tok('paleo-ice-edge', '#7dd3fc');
      x.lineWidth = 1.5;
      x.stroke();
      x.fillStyle = tok('text-secondary', '#5b6472');
      x.font = `11px ${this.theme.getFontFamily()}`;
      x.textAlign = 'left';
      x.fillText(this.i18n.t().transectIceMax(Math.round(iceMax).toLocaleString(this.i18n.t().numberLocale)), pad.l + 6, iceTop + 13);
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

    // Place names and the A/B markers come from the content file and the dictionary; there are no
    // fallback literals, so a chart drawn before the content arrives carries no labels rather than
    // English ones in a Polish session (`I-03b`).
    const places = this.content.content()?.places;
    if (places) {
      const tr = this.i18n.t();
      x.font = `600 10px ${font}`;
      x.fillStyle = tok('text-desc', '#334155');
      x.textBaseline = 'alphabetic';
      x.textAlign = 'left';
      x.fillText(tr.transectPointA(places.umea), pad.l + 2, h - 3);
      x.textAlign = 'right';
      x.fillText(tr.transectPointB(places.gdansk), w - pad.r, h - 3);
      const g = points.reduce((best, p) => (Math.abs(p.lat - 57.3) < Math.abs(best.lat - 57.3) ? p : best), points[0]);
      x.textAlign = 'center';
      x.fillText(places.gotland, X(g.km), h - 3);
    }
  }
}
