import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Globe, Mountain, BookOpen } from 'lucide-angular';
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
import { GlobeComponent } from './components/globe/globe.component';
import { PaleoDataService } from './core/data/paleo-data.service';
import { phaseAt } from './core/data/phases';

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
    GlobeComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  readonly i18n = inject(I18nService);
  readonly bp = inject(BreakpointService);
  readonly popup = inject(PopupService);
  readonly about = inject(AboutService);
  readonly splash = inject(SplashService);
  readonly data = inject(PaleoDataService);

  readonly globeIcon = Globe;
  readonly bookOpenIcon = BookOpen;

  readonly currentView = signal<string>('paleo');
  /** Shown time in ka BP; the slider runs from −20 (left) to 0 (right). */
  readonly ka = signal<number>(initialKa());
  readonly phase = computed(() => phaseAt(this.ka()));

  readonly langOptions = computed<DropdownOption<Lang>[]>(() =>
    this.i18n.langs.map(l => ({
      value: l,
      label: this.i18n.dicts[l].langName,
      shortLabel: l.toUpperCase(),
      badge: l.toUpperCase()
    }))
  );

  readonly viewOptions = computed<DropdownOption<string>[]>(() => [
    { value: 'paleo', label: this.i18n.t().viewPaleo, icon: Mountain }
  ]);

  readonly isPopupOpen = computed(() => this.popup.config() !== null);

  setFromSlider(v: number) {
    this.ka.set(Math.round(-v));
  }

  openGlossary() {
    this.popup.open({
      id: 'glossary',
      title: computed(() => this.i18n.t().glossary),
      description: computed(() => this.i18n.t().glossaryDesc),
      size: 'md',
      actions: [{ label: computed(() => this.i18n.t().close), variant: 'default' }]
    });
  }
}

/** `?ka=13` opens a given frame (0–20 ka BP); defaults to 11 ka. */
function initialKa(): number {
  if (typeof location === 'undefined') return 11;
  const v = Number(new URLSearchParams(location.search).get('ka'));
  return Number.isFinite(v) && v >= 0 && v <= 20 && location.search.includes('ka=') ? Math.round(v) : 11;
}
