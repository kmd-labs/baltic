import { Component, effect, inject, input, output } from '@angular/core';
import { ThemeService } from '@kmd/design-system/services/theme.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { PaleoDataService } from '../../core/data/paleo-data.service';
import { TransectService } from '../../core/data/transect.service';
import { FRAMES, nearestFrame } from '../../core/data/timeline';
import { CanvasPanel } from './canvas-panel';

const SAMPLES = 160;
const T_MAX = 20000;

/**
 * The whole history of the active transect at once (decision 2026-11-09): distance along the
 * section across, time 20 ka → today down, colour = what lay there — water by depth (sea blue,
 * lake green), ice, or land by height. Each frame of the timeline is one row, running to the next
 * frame. A click picks that time.
 */
@Component({
  selector: 'app-transect-history',
  standalone: true,
  template: `<canvas #cv [attr.aria-label]="i18n.t().transectHistoryAria" role="img" (click)="onClick($event)"></canvas>`,
  styles: [
    `
      :host { display: flex; min-width: 0; min-height: 0; }
      canvas { display: block; width: 100%; height: 100%; cursor: pointer; }
    `
  ]
})
export class TransectHistoryComponent extends CanvasPanel {
  readonly t = input.required<number>();
  readonly pickTime = output<number>();
  readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly data = inject(PaleoDataService);
  private readonly transects = inject(TransectService);
  private readonly pad = { l: 30, r: 4, t: 4, b: 12 };

  constructor() {
    super();
    effect(() => {
      this.t();
      this.data.version();
      this.data.state();
      this.transects.line();
      this.i18n.lang();
      this.redraw();
    });
  }

  onClick(e: MouseEvent): void {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (e.clientY - r.top - this.pad.t) / (r.height - this.pad.t - this.pad.b)));
    this.pickTime.emit(nearestFrame(T_MAX - u * T_MAX));
  }

  protected draw(x: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.data.state() !== 'ready') return;
    const tok = (k: string, fb: string) => this.theme.getTokenColor(k, fb);
    const rgb = (css: string) => {
      x.fillStyle = css;
      const hex = x.fillStyle as string; // canvas normalises to #rrggbb
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const mix = (a: number[], b: number[], k: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
    const sea0 = rgb(tok('paleo-water-shallow', '#bae6fd'));
    const sea1 = rgb(tok('paleo-marine', '#3d6aa3'));
    const lake0 = rgb(tok('water-lake-0', '#d8f0e6'));
    const lake1 = rgb(tok('water-lake-1', '#4f9a80'));
    const land0 = rgb(tok('paleo-land-low', '#e9e3d3'));
    const land1 = rgb(tok('paleo-land-high', '#a89878'));
    const ice = tok('paleo-ice-section', 'rgba(207,216,227,0.9)');

    const { l, r, t: pt, b } = this.pad;
    const W = w - l - r;
    const H = h - pt - b;
    const Y = (t: number) => pt + ((T_MAX - t) / T_MAX) * H;
    const line = this.transects.line().points;

    for (let i = 0; i < FRAMES.length; i++) {
      const t = FRAMES[i];
      const tNext = i + 1 < FRAMES.length ? FRAMES[i + 1] : 0;
      const y0 = Y(t);
      const y1 = i + 1 < FRAMES.length ? Y(tNext) : Y(0) + 1;
      const prof = this.data.transect(t, line, SAMPLES);
      if (!prof) {
        x.fillStyle = tok('line', 'rgba(15,23,42,0.1)');
        x.fillRect(l, y0, W, Math.max(1, y1 - y0));
        continue;
      }
      const cw = W / prof.points.length;
      prof.points.forEach((p, k) => {
        let col: string;
        if (p.ice) col = ice;
        else if (p.level != null) {
          const depth = Math.max(0, p.level - p.hPaleo);
          const kk = Math.min(1, depth / 150);
          col = p.level > 0 ? mix(lake0, lake1, kk) : mix(sea0, sea1, kk);
        } else col = mix(land0, land1, Math.min(1, Math.max(0, p.hPaleo) / 400));
        x.fillStyle = col;
        x.fillRect(l + k * cw, y0, cw + 0.6, Math.max(1, y1 - y0) + 0.6);
      });
    }

    // Time axis and the current time.
    const font = this.theme.getFontFamily();
    x.font = `10px ${font}`;
    x.fillStyle = tok('text-dim', '#64748b');
    x.textAlign = 'right';
    x.textBaseline = 'middle';
    for (const t of [20000, 10000, 0]) x.fillText(t ? `${t / 1000} ka` : '0', l - 4, Math.min(h - b - 2, Math.max(pt + 4, Y(t))));
    x.strokeStyle = tok('accent', '#d37400');
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(l, Y(this.t()));
    x.lineTo(l + W, Y(this.t()));
    x.stroke();
    x.textBaseline = 'alphabetic';
    x.fillStyle = tok('text-desc', '#334155');
    x.font = `600 10px ${font}`;
    x.textAlign = 'left';
    x.fillText('A', l, h - 1);
    x.textAlign = 'right';
    x.fillText('B', l + W, h - 1);
  }
}
