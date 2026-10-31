import { Component, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  Globe,
  Mountain,
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
  Maximize2
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
import { GlobeComponent, GlobeLabel, GlobeLayers, GlobePointer } from './components/globe/globe.component';
import { PaleoDataService } from './core/data/paleo-data.service';
import { ContentService } from './core/content/content.service';
import { FRAMES, nearestFrame, phaseAt } from './core/data/timeline';
import { PLACES, SILLS } from './core/data/geo';
import { PhaseCardComponent } from './components/panels/phase-card.component';
import { TransectPanelComponent } from './components/panels/transect-panel.component';
import { CurvesPanelComponent } from './components/panels/curves-panel.component';
import { PhaseBandsComponent } from './components/panels/phase-bands.component';
import { InfoPopupComponent } from './components/panels/info-popup.component';

type Tab = 'phase' | 'transect' | 'curves';
type LayerId = keyof GlobeLayers;

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
    PhaseCardComponent,
    TransectPanelComponent,
    CurvesPanelComponent,
    PhaseBandsComponent
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

  readonly icons = { Globe, Mountain, BookOpen, Library, Info, Play, Pause, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus, Maximize2 };

  readonly currentView = signal<string>('paleo');
  /** Shown time, cal yr BP. */
  readonly t = signal<number>(initialTime());
  readonly phase = computed(() => phaseAt(this.t()));
  readonly playing = signal(false);
  readonly collapsed = signal(false);
  readonly tab = signal<Tab>('phase');
  readonly exaggeration = signal(10);
  readonly probe = signal<{ lon: number; lat: number } | null>(null);
  readonly pointer = signal<GlobePointer | null>(null);
  readonly layers = signal<GlobeLayers>({ ice: true, band: true, today: true, prev: true, sills: true, transect: true, labels: true });

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
    if (!p || this.data.state() !== 'ready') return null;
    const frame = this.data.frame(this.t());
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

  readonly viewOptions = computed<DropdownOption<string>[]>(() => [{ value: 'paleo', label: this.i18n.t().viewPaleo, icon: Mountain }]);
  readonly isPopupOpen = computed(() => this.popup.config() !== null);

  private playTimer: ReturnType<typeof setInterval> | null = null;

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

  setT(t: number): void {
    this.t.set(nearestFrame(t));
  }

  step(dir: -1 | 1): void {
    const i = FRAMES.indexOf(this.t());
    this.t.set(FRAMES[Math.min(FRAMES.length - 1, Math.max(0, i + dir))]);
  }

  togglePlay(): void {
    if (this.playing()) {
      this.stop();
      return;
    }
    if (this.t() === 0) this.t.set(FRAMES[0]);
    this.playing.set(true);
    this.playTimer = setInterval(() => {
      const i = FRAMES.indexOf(this.t());
      if (i >= FRAMES.length - 1) this.stop();
      else this.t.set(FRAMES[i + 1]);
    }, 800);
  }

  private stop(): void {
    this.playing.set(false);
    if (this.playTimer) clearInterval(this.playTimer);
    this.playTimer = null;
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

/** `?t=11650` (cal BP) or `?ka=11` opens a given frame; defaults to 11 650 cal BP. */
function initialTime(): number {
  if (typeof location === 'undefined') return 11650;
  const q = new URLSearchParams(location.search);
  const t = q.has('t') ? Number(q.get('t')) : q.has('ka') ? Number(q.get('ka')) * 1000 : NaN;
  return Number.isFinite(t) && t >= 0 && t <= 20000 ? nearestFrame(t) : 11650;
}
