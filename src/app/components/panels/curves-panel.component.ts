import { Component, computed, effect, inject, input, output } from '@angular/core';
import { ThemeService } from '@kmd/design-system/services/theme.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ContentService } from '../../core/content/content.service';
import { PaleoDataService } from '../../core/data/paleo-data.service';
import { CURVE_POINTS } from '../../core/data/geo';
import { FRAMES, nearestFrame } from '../../core/data/timeline';
import { CanvasPanel } from './canvas-panel';

const SERIES_COLORS = ['#1f3f73', '#5a8fc4', '#2f9a83'];

/** RSL through time at Umeå, Stockholm, Gdańsk and a clicked point. Click to jump in time. */
@Component({
  selector: 'app-curves-panel',
  standalone: true,
  template: `
    @let tr = i18n.t();
    <div class="panel__head">
      <h3 class="panel__title">{{ tr.curvesTitle }}</h3>
      <span class="panel__meta">{{ tr.curvesMeta }}</span>
    </div>
    <div class="legend">
      @for (s of series(); track s.id) {
        <span><i class="ln" [style.border-color]="s.color"></i>{{ s.name }}</span>
      }
      @if (probe()) {
        <button type="button" class="legend__clear" [attr.aria-label]="tr.curvesClear" (click)="clearProbe.emit()">×</button>
      } @else {
        <span class="dim">{{ tr.curvesHint }}</span>
      }
    </div>
    <canvas #cv [attr.aria-label]="tr.curvesAria" role="img" (click)="onClick($event)"></canvas>
  `,
  styleUrl: './panels.scss'
})
export class CurvesPanelComponent extends CanvasPanel {
  readonly t = input.required<number>();
  readonly probe = input<{ lon: number; lat: number } | null>(null);
  readonly pickTime = output<number>();
  readonly clearProbe = output<void>();
  readonly i18n = inject(I18nService);
  private readonly content = inject(ContentService);
  private readonly theme = inject(ThemeService);
  private readonly data = inject(PaleoDataService);
  private readonly pad = { l: 36, r: 10, t: 6, b: 14 };

  readonly series = computed(() => {
    const places = this.content.content()?.places;
    const out: { id: string; name: string; lon: number; lat: number; color: string; width: number }[] = CURVE_POINTS.map(
      (p, i) => ({ id: p.id, name: places?.[p.id] ?? p.id, lon: p.lon, lat: p.lat, color: SERIES_COLORS[i], width: 1.5 })
    );
    const pr = this.probe();
    if (pr) {
      out.push({
        id: 'probe',
        name: this.i18n.t().curvesProbe,
        lon: pr.lon,
        lat: pr.lat,
        color: this.theme.getTokenColor('accent', '#d37400'),
        width: 2.2
      });
    }
    return out;
  });

  private readonly values = computed(() => {
    if (this.data.state() !== 'ready') return null;
    return this.series().map(s => this.data.rslSeries(s.lon, s.lat, FRAMES));
  });

  constructor() {
    super();
    effect(() => {
      this.t();
      this.values();
      this.redraw();
    });
  }

  onClick(e: MouseEvent): void {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (e.clientX - r.left - this.pad.l) / (r.width - this.pad.l - this.pad.r)));
    this.pickTime.emit(nearestFrame(20000 - u * 20000));
  }

  protected draw(x: CanvasRenderingContext2D, w: number, h: number): void {
    const vals = this.values();
    if (!vals) return;
    const series = this.series();
    const tok = (k: string, fb: string) => this.theme.getTokenColor(k, fb);
    const font = this.theme.getFontFamily();
    const pad = this.pad;
    const r0 = -140;
    const r1 = 320;
    const X = (t: number) => pad.l + ((20000 - t) / 20000) * (w - pad.l - pad.r);
    const Y = (v: number) => pad.t + ((r1 - Math.min(r1, Math.max(r0, v))) / (r1 - r0)) * (h - pad.t - pad.b);

    x.font = `10px ${font}`;
    x.textAlign = 'right';
    x.textBaseline = 'middle';
    x.fillStyle = tok('text-dim', '#64748b');
    for (const v of [-100, 0, 100, 200, 300]) {
      x.strokeStyle = v === 0 ? tok('line-strong', 'rgba(15,23,42,0.2)') : tok('line', 'rgba(15,23,42,0.1)');
      x.beginPath();
      x.moveTo(pad.l, Y(v));
      x.lineTo(w - pad.r, Y(v));
      x.stroke();
      x.fillText((v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v), pad.l - 5, Y(v));
    }
    series.forEach((s, k) => {
      x.strokeStyle = s.color;
      x.lineWidth = s.width;
      x.beginPath();
      let on = false;
      FRAMES.forEach((t, i) => {
        const v = vals[k][i];
        if (v == null) {
          on = false;
          return;
        }
        if (on) x.lineTo(X(t), Y(v));
        else x.moveTo(X(t), Y(v));
        on = true;
      });
      x.stroke();
    });
    x.textAlign = 'center';
    x.textBaseline = 'bottom';
    x.fillStyle = tok('text-dim', '#64748b');
    for (let t = 20000; t >= 0; t -= 4000) x.fillText(t ? `${t / 1000} ka` : '0', Math.min(w - pad.r - 8, Math.max(pad.l + 12, X(t))), h);
    x.strokeStyle = tok('accent', '#d37400');
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(X(this.t()), pad.t);
    x.lineTo(X(this.t()), h - pad.b);
    x.stroke();
  }
}
