import { Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ContentService } from '../../core/content/content.service';
import { PaleoDataService } from '../../core/data/paleo-data.service';
import { EVENTS, eventAt, phaseAt } from '../../core/data/timeline';

/**
 * Phase card from the mockup, laid out to fit without scrolling: name and badges, the event
 * note, description, indicator species, model-vs-literature level check and metrics, and the
 * event sections of the phase as buttons (they replace the pins on the timeline).
 */
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
      <p class="phase-desc">
        @if (event(); as ev) {
          <b>{{ c.events[ev.id].label }}.</b> {{ c.events[ev.id].note }}
        }
        {{ c.phases[ph.id].desc }}
        @if (c.phases[ph.id].species; as sp) {
          <span class="dim">{{ tr.indicatorSpecies }}: <i>{{ sp }}</i>.</span>
        }
      </p>
    }
    @if (stats(); as s) {
      <dl class="kv kv--3">
        @if (lakeLevel() > 0 || litLevel() > 0) {
          <div>
            <dt>{{ tr.kvLevelModel }}</dt>
            <dd>{{ lakeLevel() > 0 ? signedM(lakeLevel()) + ' m · ' + tr.levelSill : tr.levelOcean }}</dd>
          </div>
          <div>
            <dt>{{ tr.kvLevelLit }}</dt>
            <dd>
              {{ signedM(litLevel()) }} m
              <span class="badge" [class.badge--ok]="levelOk()" [class.badge--warn]="!levelOk()">
                {{ levelOk() ? tr.levelMatch : tr.levelMismatch(fmt(levelDiff(), 0)) }}
              </span>
            </dd>
          </div>
        } @else {
          <div>
            <dt>{{ tr.kvLevel }}</dt>
            <dd>
              {{ tr.levelOcean }}
              <span class="badge" [class.badge--ok]="s.connected" [class.badge--warn]="!s.connected">
                {{ s.connected ? tr.levelConnected : tr.levelIsolated }}
              </span>
            </dd>
          </div>
        }
        <div>
          <dt>{{ tr.kvArea }}</dt>
          <dd>{{ s.areaKm2 > 1000 ? tr.areaValue(fmt(s.areaKm2 / 1000, 0)) : '—' }}</dd>
        </div>
        <div>
          <dt>{{ tr.kvVolume }}</dt>
          <dd>{{ s.volumeKm3 > 100 ? tr.volumeValue(fmt(s.volumeKm3 / 1000, 1)) : '—' }}</dd>
        </div>
        <div>
          <dt>{{ tr.kvMaxDepth }}</dt>
          <dd>{{ s.maxDepthM > 1 ? fmt(s.maxDepthM, 0) + ' m' : '—' }}</dd>
        </div>
      </dl>
    }
    @if (c && phaseEvents().length) {
      <div class="events" role="group" [attr.aria-label]="tr.phaseEvents">
        <span class="events__label">{{ tr.phaseEvents }}</span>
        @for (e of phaseEvents(); track e.id) {
          <button type="button" class="event" [class.event--active]="e.t === t()" (click)="pickTime.emit(e.t)">
            {{ c.events[e.id].label }} · {{ fmt(e.t) }}
          </button>
        }
      </div>
    }
  `,
  styleUrl: './panels.scss'
})
export class PhaseCardComponent {
  readonly t = input.required<number>();
  readonly pickTime = output<number>();
  readonly i18n = inject(I18nService);
  readonly content = inject(ContentService);
  private readonly data = inject(PaleoDataService);

  readonly phase = computed(() => phaseAt(this.t()));
  readonly event = computed(() => eventAt(this.t()));
  readonly phaseEvents = computed(() => EVENTS.filter(e => phaseAt(e.t).id === this.phase().id));
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
