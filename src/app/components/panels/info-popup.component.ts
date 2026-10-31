import { Component, inject, input } from '@angular/core';
import { ContentService } from '../../core/content/content.service';
import { I18nService } from '../../core/i18n/i18n.service';

/** Body of the glossary / sources / about popups, from the content file of the current language. */
@Component({
  selector: 'app-info-popup',
  standalone: true,
  template: `
    @let c = content.content();
    @if (c) {
      @switch (kind()) {
        @case ('glossary') {
          <dl class="info">
            @for (g of c.glossary; track g[0]) {
              <dt>{{ g[0] }}</dt>
              <dd>{{ g[1] }}</dd>
            }
          </dl>
        }
        @case ('sources') {
          <div class="src">
            @for (s of c.sources; track s.name) {
              <section class="src__item">
                <h3>{{ s.name }}</h3>
                <dl>
                  <dt>{{ i18n.t().srcUse }}</dt><dd>{{ s.use }}</dd>
                  <dt>{{ i18n.t().srcOrigin }}</dt><dd>{{ s.origin }}</dd>
                  <dt>{{ i18n.t().srcLicence }}</dt><dd>{{ s.licence }}</dd>
                  <dt>{{ i18n.t().srcNote }}</dt><dd>{{ s.note }}</dd>
                </dl>
              </section>
            }
          </div>
        }
        @case ('about') {
          @for (p of c.about; track $index) {
            <p class="info">{{ p }}</p>
          }
        }
      }
    }
  `,
  styles: [
    `
      .info { margin: 0 0 10px; font-size: 13px; line-height: 1.5; color: var(--color-text-desc); max-width: 65ch; }
      dl.info { display: grid; gap: 10px; }
      dt { font-weight: 600; color: var(--color-text-bright); }
      dd { margin: 2px 0 0; }
      .src { display: grid; gap: 14px; max-width: 70ch; }
      .src__item h3 { margin: 0 0 4px; font-size: 13.5px; font-weight: 600; color: var(--color-text-bright); }
      .src__item dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 0; font-size: 12.5px; line-height: 1.45; }
      .src__item dt { font-weight: 500; color: var(--color-text-dim); }
      .src__item dd { margin: 0; color: var(--color-text-desc); overflow-wrap: anywhere; }
    `
  ]
})
export class InfoPopupComponent {
  readonly kind = input.required<'glossary' | 'sources' | 'about'>();
  readonly content = inject(ContentService);
  readonly i18n = inject(I18nService);
}
