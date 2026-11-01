import { Component, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  Globe,
  BookOpen,
  Library,
  Info,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Maximize2,
  GraduationCap,
  Box
} from 'lucide-angular';
import {
  ButtonComponent,
  DropdownComponent,
  DropdownOption,
  PopupComponent,
  PopupService,
  SplashComponent,
  SplashService,
  AboutService,
  TimelineSliderComponent,
  TooltipComponent,
  BreakpointService
} from '@kmd/design-system';
import { I18nService } from './core/i18n/i18n.service';
import { Lang } from './core/i18n/i18n.types';
import { BlockComponent } from './components/block/block.component';
import { GlobeComponent, GlobeLabel, GlobeLayers, GlobePointer } from './components/globe/globe.component';
import { PaleoDataService } from './core/data/paleo-data.service';
import { ContentService } from './core/content/content.service';
import { FRAMES, phaseAt } from './core/data/timeline';
import { PLACES, SILLS } from './core/data/geo';
import { PhaseCardComponent } from './components/panels/phase-card.component';
import { TransectPanelComponent } from './components/panels/transect-panel.component';
import { PhaseBandsComponent } from './components/panels/phase-bands.component';
import { InfoPopupComponent } from './components/panels/info-popup.component';
import { LayersMenuComponent, LayerItem } from './components/header/layers-menu.component';
import { TourComponent, TourStep } from './components/tour/tour.component';
import type { TourStepId } from './core/i18n/i18n.types';

type Tab = 'phase' | 'transect';
type LayerId = keyof GlobeLayers;
type StageView = 'globe' | 'block';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    ButtonComponent,
    DropdownComponent,
    PopupComponent,
    SplashComponent,
    TimelineSliderComponent,
    TooltipComponent,
    GlobeComponent,
    BlockComponent,
    PhaseCardComponent,
    TransectPanelComponent,
    PhaseBandsComponent,
    LayersMenuComponent,
    TourComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnDestroy {
  readonly i18n = inject(I18nService);
  readonly bp = inject(BreakpointService);
  readonly popup = inject(PopupService);
  readonly about = inject(AboutService);
  readonly splash = inject(SplashService);
  readonly data = inject(PaleoDataService);
  readonly content = inject(ContentService);

  @ViewChild(GlobeComponent) globe?: GlobeComponent;
  @ViewChild(BlockComponent) blockView?: BlockComponent;

  /** Whichever stage is mounted; both expose the same zoom controls. */
  private stage(): GlobeComponent | BlockComponent | undefined {
    return this.globe ?? this.blockView;
  }

  zoomBy(factor: number): void {
    this.stage()?.zoomBy(factor);
  }

  fitView(): void {
    this.stage()?.fit();
  }
  @ViewChild(TourComponent) tour?: TourComponent;

  /**
   * Tutorial steps in the order of the brief: play, layers, glossary, sources, phase, transect,
   * KMD — with the view switcher added after playback, because what the relief block shows is not
   * guessable from the pill and it is the one control that changes the whole stage.
   */
  readonly tourSteps: TourStep[] = [
    { id: 'play', target: '[data-tour="play"]' },
    { id: 'view', target: '[data-tour="view"]' },
    { id: 'layers', target: '[data-tour="layers"]' },
    { id: 'glossary', target: '[data-tour="glossary"]' },
    { id: 'sources', target: '[data-tour="sources"]' },
    { id: 'phase', target: '[data-tour="phase"]' },
    { id: 'transect', target: '[data-tour="transect"]' },
    { id: 'about', target: '[data-tour="about"]' }
  ];

  readonly icons = { Globe, BookOpen, Library, Info, Play, Pause, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus, Maximize2, GraduationCap, Box };

  /**
   * Stage to render. The relief block is an alternative to the globe, not a replacement — the
   * switcher sits as its own pill top-left (AGENTS.md puts view switching top-right, but that pill
   * holds the layers menu here).
   */
  readonly view = signal<StageView>('globe');

  readonly viewOptions = computed<DropdownOption<StageView>[]>(() => {
    const t = this.i18n.t();
    return [
      { value: 'globe', label: t.viewGlobe, shortLabel: t.viewGlobe, icon: Globe },
      { value: 'block', label: t.viewBlock, shortLabel: t.viewBlock, icon: Box }
    ];
  });

  /** Shown time, cal yr BP. */
  readonly t = signal<number>(initialTime());
  readonly phase = computed(() => phaseAt(this.t()));
  readonly playing = signal(false);
  readonly collapsed = signal(false);
  readonly tab = signal<Tab>('phase');
  readonly pointer = signal<GlobePointer | null>(null);
  readonly layers = signal<GlobeLayers>({ ice: true, band: true, today: true, prev: true, sills: true, transect: true, labels: true });

  readonly layerItems = computed<LayerItem[]>(() => this.layerList().map(l => ({ ...l, on: this.layers()[l.id] })));

  readonly layerList = computed<{ id: LayerId; label: string }[]>(() => {
    const t = this.i18n.t();
    return [
      { id: 'ice', label: t.layerIce },
      { id: 'band', label: t.layerBand },
      { id: 'today', label: t.layerToday },
      { id: 'prev', label: t.layerPrev },
      { id: 'sills', label: t.layerSills },
      { id: 'transect', label: t.layerTransect },
      { id: 'labels', label: t.layerLabels }
    ];
  });

  readonly labels = computed<GlobeLabel[]>(() => {
    const c = this.content.content();
    if (!c) return [];
    return [
      ...PLACES.filter(p => p.id !== 'gotland').map(p => ({ id: 'p-' + p.id, text: c.places[p.id], lon: p.lon, lat: p.lat, kind: 'place' as const })),
      ...SILLS.map(s => ({ id: 's-' + s.id, text: c.sills[s.id], lon: s.lon, lat: s.lat, kind: 'sill' as const }))
    ];
  });

  readonly readout = computed(() => this.i18n.t().calBp(this.fmt(this.t())));
  readonly calendar = computed(() => this.i18n.t().calendar(1950 - this.t(), n => this.fmt(n)));

  readonly tooltip = computed(() => {
    const p = this.pointer();
    this.data.version();
    if (!p || this.data.state() !== 'ready') return null;
    const frame = this.data.frame(this.t());
    if (!frame) return null;
    const info = this.data.pointInfo(frame, p.lon, p.lat);
    if (!info) return null;
    const tr = this.i18n.t();
    const what = info.ice ? tr.tipIce : info.water === 'ocean' ? tr.tipOcean : info.water === 'lake' ? tr.tipLake : tr.tipLand;
    return {
      x: p.x,
      y: p.y,
      coords: `${this.fmt(Math.abs(info.lat), 2)}° ${info.lat >= 0 ? 'N' : 'S'} · ${this.fmt(Math.abs(info.lon), 2)}° ${info.lon >= 0 ? 'E' : 'W'}`,
      what,
      seabed: !info.ice && info.water === 'dry' && info.hNow < 0 ? tr.tipSeabed : '',
      rel: this.signed(info.hPaleo),
      today: this.signed(info.hNow),
      rsl: this.signed(info.rsl)
    };
  });

  readonly langOptions = computed<DropdownOption<Lang>[]>(() =>
    this.i18n.langs.map(l => ({
      value: l,
      label: this.i18n.dicts[l].langName,
      shortLabel: l.toUpperCase(),
      badge: l.toUpperCase()
    }))
  );

  readonly isPopupOpen = computed(() => this.popup.config() !== null);

  /** Model years per second of playback: the full 20 ka in ~16 s, matching the old 27 × 800 ms. */
  private readonly SWEEP_YR_PER_S = 1250;
  /**
   * Playback advances time continuously, but the signal is updated at ~30 Hz rather than every
   * frame: it is smooth for the ice morph and the moving shoreline, at a third of the change
   * detection and RSL resampling of a 60 Hz update.
   */
  private readonly TICK_MS = 33;
  /**
   * Cap on a manual step. At playback speed a one-frame step takes 800 ms, which is what makes it
   * look the same as play, but a long jump should not keep the user waiting.
   */
  private readonly STEP_MAX_MS = 1200;
  /** Playback and the step tween share one handle: only one of them may drive time. */
  private timeRaf: number | null = null;
  /**
   * Where a step tween is heading, or null when none is running. Repeated clicks step from here
   * rather than from the animated position, so clicking three times advances three frames instead
   * of re-targeting the one the animation has not reached yet.
   */
  private glideTarget: number | null = null;

  ngOnDestroy(): void {
    this.stop();
  }

  fmt(n: number, digits = 0): string {
    return n.toLocaleString(this.i18n.t().numberLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  signed(n: number): string {
    const r = Math.round(n);
    return (r > 0 ? '+' : r < 0 ? '−' : '±') + this.fmt(Math.abs(r)) + ' m';
  }

  /**
   * Time is continuous — the ice body morphs between the DATED-1 slices and RSL is interpolated
   * between the source layers, so there is nothing left to snap to.
   */
  setT(t: number): void {
    // Dragging the slider takes over from whatever was driving time.
    if (this.timeRaf !== null) this.stop();
    this.t.set(Math.round(Math.min(FRAMES[0], Math.max(0, t))));
  }

  /**
   * Steps to the next timeline frame, which is still where the event sections live, animating the
   * way playback does so the ice morph and the moving shoreline read the same as under play.
   */
  step(dir: -1 | 1): void {
    const base = this.glideTarget ?? this.t();
    // FRAMES runs oldest first, so dir = 1 (forward in time) means a smaller cal BP.
    const reach = dir === 1 ? FRAMES.filter(f => f < base) : FRAMES.filter(f => f > base);
    if (!reach.length) return;
    this.glideTo(dir === 1 ? Math.max(...reach) : Math.min(...reach));
  }

  /**
   * Animates time to `target` at playback speed, capped by `STEP_MAX_MS`. Eased at both ends so a
   * step settles instead of stopping dead; playback itself stays linear.
   */
  private glideTo(target: number): void {
    const from = this.t();
    // A manual step takes over: a tween and the playback loop cannot both drive time.
    this.stop();
    const dist = Math.abs(target - from);
    if (dist < 1) {
      this.t.set(target);
      return;
    }
    this.glideTarget = target;
    const dur = Math.min(this.STEP_MAX_MS, (dist / this.SWEEP_YR_PER_S) * 1000);
    const start = performance.now();
    let shown = start;
    const tick = (now: number): void => {
      const k = (now - start) / dur;
      if (k >= 1) {
        this.timeRaf = null;
        this.glideTarget = null;
        this.t.set(target);
        return;
      }
      if (now - shown >= this.TICK_MS) {
        shown = now;
        const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
        this.t.set(Math.round(from + (target - from) * e));
      }
      this.timeRaf = requestAnimationFrame(tick);
    };
    this.timeRaf = requestAnimationFrame(tick);
  }

  togglePlay(): void {
    if (this.playing()) {
      this.stop();
      return;
    }
    if (this.t() <= 0) this.t.set(FRAMES[0]);
    this.playing.set(true);
    let last = performance.now();
    let acc = 0;
    const tick = (now: number): void => {
      if (!this.playing()) return;
      acc += now - last;
      last = now;
      if (acc >= this.TICK_MS) {
        const next = this.t() - (acc / 1000) * this.SWEEP_YR_PER_S;
        acc = 0;
        if (next <= 0) {
          this.t.set(0);
          this.stop();
          return;
        }
        this.t.set(Math.round(next));
      }
      this.timeRaf = requestAnimationFrame(tick);
    };
    this.timeRaf = requestAnimationFrame(tick);
  }

  private stop(): void {
    this.playing.set(false);
    if (this.timeRaf !== null) cancelAnimationFrame(this.timeRaf);
    this.timeRaf = null;
    this.glideTarget = null;
  }

  startTour(): void {
    this.stop();
    this.tour?.start();
  }

  /** Make the target of a tutorial step visible: panels expanded, the right tab on narrow screens. */
  onTourStep(id: TourStepId): void {
    if (id === 'phase' || id === 'transect') {
      this.collapsed.set(false);
      this.tab.set(id);
    }
  }

  toggleLayer(id: LayerId): void {
    this.layers.update(l => ({ ...l, [id]: !l[id] }));
  }

  openInfo(kind: 'glossary' | 'sources' | 'about'): void {
    const tr = () => this.i18n.t();
    this.popup.open({
      id: kind,
      title: () => (kind === 'glossary' ? tr().glossary : kind === 'sources' ? tr().sources : tr().aboutTitle),
      component: InfoPopupComponent,
      componentInputs: { kind },
      size: 'md',
      actions: [{ label: () => tr().close, variant: 'default' }]
    });
  }
}

/** `?t=11650` (cal BP) or `?ka=11` opens a given frame; defaults to the start of the timeline (20 000 cal BP). */
function initialTime(): number {
  if (typeof location === 'undefined') return 20000;
  const q = new URLSearchParams(location.search);
  const t = q.has('t') ? Number(q.get('t')) : q.has('ka') ? Number(q.get('ka')) * 1000 : NaN;
  return Number.isFinite(t) && t >= 0 && t <= 20000 ? Math.round(t) : 20000;
}
