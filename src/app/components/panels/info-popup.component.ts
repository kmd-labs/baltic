import { Component, inject, input } from '@angular/core';
import { ContentService } from '../../core/content/content.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { PaleoDataService } from '../../core/data/paleo-data.service';

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
                  @if (licenceOf(s.sourceId); as lic) {
                    <dt>{{ i18n.t().srcLicence }}</dt>
                    <dd>
                      {{ lic.licence }}
                      @if (lic.attribution) { <span class="src__attr">{{ lic.attribution }}</span> }
                    </dd>
                  }
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
      /* The verbatim text a licence requires: shown, and visibly a quotation rather than our prose. */
      .src__attr { display: block; margin-top: 2px; font-style: italic; color: var(--color-text-dim); }
    `
  ]
})
export class InfoPopupComponent {
  readonly kind = input.required<'glossary' | 'sources' | 'about'>();
  readonly content = inject(ContentService);
  readonly i18n = inject(I18nService);
  private readonly data = inject(PaleoDataService);

  /**
   * Licence and attribution from the published registry (`sources.json`, generated from
   * `SOURCES.md`) rather than from the translated prose beside it — the panel used to carry its own
   * paraphrase of the GEBCO terms, which is how a licence statement drifts from the document that
   * is supposed to be its single source of truth (`I-04b`).
   *
   * Null for entries that describe cited facts rather than a licensed file: a chronology taken from
   * a publication has a citation, not a licence.
   */
  licenceOf(id: string | null): { licence: string; attribution?: string } | null {
    if (!id) return null;
    const entry = this.data.sources().find(s => s.id === id);
    return entry ? { licence: entry.licence, attribution: entry.attribution } : null;
  }
}
