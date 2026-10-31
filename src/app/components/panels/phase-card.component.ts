import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ContentService } from '../../core/content/content.service';
import { PaleoDataService } from '../../core/data/paleo-data.service';
import { eventAt, phaseAt } from '../../core/data/timeline';

/** Phase card from the mockup: name, badges, event note, description, level check, metrics. */
@Component({
  selector: 'app-phase-card',
  standalone: true,
  template: `
    @let tr = i18n.t();
    @let c = content.content();
    @let ph = phase();
    <div class="panel__head">
      <h3 class="panel__title">{{ tr.phaseTitle }}</h3>
      <span class="panel__meta">{{ fmt(ph.from) }}–{{ fmt(ph.to) }} cal BP</span>
    </div>
    @if (c) {
      <h2 class="phase-name">{{ c.phases[ph.id].name }}</h2>
      <div class="badges">
        <span class="badge" [attr.data-cls]="ph.cls">{{ c.phases[ph.id].water }}</span>
        <span class="badge">{{ tr.badgePsu(c.phases[ph.id].psu) }}</span>
        <span class="badge">{{ interpolated() ? tr.badgeInterpolated : tr.badgeModelled }}</span>
        @if (iceNearest()) {
          <span class="badge">{{ tr.badgeIceNearest }}</span>
        }
        <span class="badge">{{ tr.badgeDatum }}</span>
        @if (event()?.disputed) {
          <span class="badge badge--warn">{{ tr.badgeDisputed }}</span>
        }
      </div>
      @if (event(); as ev) {
        <p class="phase-desc"><b>{{ c.events[ev.id].label }}.</b> {{ c.events[ev.id].note }}</p>
      }
      <p class="phase-desc">{{ c.phases[ph.id].desc }}</p>
      @if (c.phases[ph.id].species; as sp) {
        <div class="phase-species">{{ tr.indicatorSpecies }}: <i>{{ sp }}</i></div>
      }
    }
    @if (stats(); as s) {
      <dl class="kv">
        @if (lakeLevel() > 0 || litLevel() > 0) {
          <dt>{{ tr.kvLevelModel }}</dt>
          <dd>{{ lakeLevel() > 0 ? tr.levelLake(signedM(lakeLevel())) + ' · ' + tr.levelSill : tr.levelOcean }}</dd>
          <dt>{{ tr.kvLevelLit }}</dt>
          <dd>
            {{ signedM(litLevel()) }}
            <span class="badge" [class.badge--ok]="levelOk()" [class.badge--warn]="!levelOk()">
              {{ levelOk() ? tr.levelMatch : tr.levelMismatch(fmt(levelDiff(), 0)) }}
            </span>
          </dd>
        } @else {
          <dt>{{ tr.kvLevel }}</dt>
          <dd>
            {{ tr.levelOcean }}
            <span class="badge" [class.badge--ok]="s.connected" [class.badge--warn]="!s.connected">
              {{ s.connected ? tr.levelConnected : tr.levelIsolated }}
            </span>
          </dd>
        }
        <dt>{{ tr.kvOutlet }}</dt>
        <dd class="dim">{{ tr.outletPending }}</dd>
        <dt>{{ tr.kvArea }}</dt>
        <dd>{{ s.areaKm2 > 1000 ? tr.areaValue(fmt(s.areaKm2 / 1000, 0)) : '—' }}</dd>
        <dt>{{ tr.kvVolume }}</dt>
        <dd>{{ s.volumeKm3 > 100 ? tr.volumeValue(fmt(s.volumeKm3 / 1000, 1)) : '—' }}</dd>
        <dt>{{ tr.kvMaxDepth }}</dt>
        <dd>{{ s.maxDepthM > 1 ? fmt(s.maxDepthM, 0) + ' m' : '—' }}</dd>
        <dt>{{ tr.kvOcean }}</dt>
        <dd class="dim">{{ tr.oceanPending }}</dd>
      </dl>
    }
    <div class="sal" [attr.aria-label]="tr.salinityScale">
      <div class="sal__bar"></div>
      <div class="sal__ticks"><span>{{ tr.salinityFresh }}</span><span>5</span><span>18</span><span>{{ tr.salinityMarine }}</span></div>
    </div>
  `,
  styleUrl: './panels.scss'
})
export class PhaseCardComponent {
  readonly t = input.required<number>();
  readonly i18n = inject(I18nService);
  readonly content = inject(ContentService);
  private readonly data = inject(PaleoDataService);

  readonly phase = computed(() => phaseAt(this.t()));
  readonly event = computed(() => eventAt(this.t()));
  readonly frame = computed(() => {
    this.data.version();
    return this.data.state() === 'ready' ? this.data.frame(this.t()) : null;
  });
  readonly stats = computed(() => this.frame()?.stats ?? null);
  readonly lakeLevel = computed(() => this.frame()?.lakeLevelM ?? 0);
  readonly litLevel = computed(() => this.frame()?.literatureLevelM ?? 0);
  readonly levelDiff = computed(() => Math.abs(this.lakeLevel() - this.litLevel()));
  /** Same tolerance as the mockup's sill-check: within 5 m. */
  readonly levelOk = computed(() => this.levelDiff() <= 5);
  /** RSL is interpolated in time except at the source steps; 0 ka is a source step. */
  readonly interpolated = computed(() => this.t() !== 0);
  readonly iceNearest = computed(() => {
    const ice = this.frame()?.ice;
    return !!ice && !ice.exact;
  });

  signedM(n: number): string {
    const r = Math.round(n);
    return (r > 0 ? '+' : r < 0 ? '−' : '±') + this.fmt(Math.abs(r));
  }

  fmt(n: number, digits = 0): string {
    return n.toLocaleString(this.i18n.t().numberLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
}
