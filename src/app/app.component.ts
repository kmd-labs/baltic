import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Globe, Activity, Layers, BookOpen } from 'lucide-angular';
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
    TooltipComponent
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

  readonly globeIcon = Globe;
  readonly bookOpenIcon = BookOpen;

  readonly currentView = signal<string>('primary');
  readonly sliderValue = signal<number>(0);

  readonly langOptions = computed<DropdownOption<Lang>[]>(() =>
    this.i18n.langs.map(l => ({
      value: l,
      label: this.i18n.dicts[l].langName,
      shortLabel: l.toUpperCase(),
      badge: l.toUpperCase()
    }))
  );

  readonly viewOptions = computed<DropdownOption<string>[]>(() => {
    const t = this.i18n.t();
    return [
      { value: 'primary', label: t.viewPrimary, icon: Activity },
      { value: 'secondary', label: t.viewSecondary, icon: Layers }
    ];
  });

  readonly currentViewIcon = computed(
    () => this.viewOptions().find(o => o.value === this.currentView())?.icon ?? Activity
  );

  readonly isPopupOpen = computed(() => this.popup.config() !== null);

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
