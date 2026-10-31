import { Component, inject, input } from '@angular/core';
import { ContentService } from '../../core/content/content.service';

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
          <ol class="info">
            @for (s of c.sources; track s[0]) {
              <li><b>{{ s[0] }}</b> — {{ s[1] }}</li>
            }
          </ol>
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
      ol.info { padding-left: 18px; display: grid; gap: 6px; }
    `
  ]
})
export class InfoPopupComponent {
  readonly kind = input.required<'glossary' | 'sources' | 'about'>();
  readonly content = inject(ContentService);
}
