import { Injectable, effect, inject, signal } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import type { Lang, PhaseId } from '../i18n/i18n.types';
import type { EventId } from '../data/timeline';
import type { PlaceId, SillId } from '../data/geo';

/** Long-form content in src/assets/content/{lang}/postglacial.json (I-03). */
export interface PostglacialContent {
  phases: Record<PhaseId, { name: string; short: string; water: string; psu: string; desc: string; species: string | null }>;
  events: Record<EventId, { label: string; note: string }>;
  sills: Record<SillId, string>;
  places: Record<PlaceId, string>;
  glossary: [string, string][];
  sources: [string, string][];
  about: string[];
}

/** Loads the content file of the current language; data files carry ids only. */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly i18n = inject(I18nService);
  private readonly cache = new Map<Lang, PostglacialContent>();
  readonly content = signal<PostglacialContent | null>(null);

  constructor() {
    effect(() => {
      const lang = this.i18n.lang();
      const hit = this.cache.get(lang);
      if (hit) {
        this.content.set(hit);
        return;
      }
      fetch(`assets/content/${lang}/postglacial.json`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`content: HTTP ${r.status}`))))
        .then((c: PostglacialContent) => {
          this.cache.set(lang, c);
          if (this.i18n.lang() === lang) this.content.set(c);
        })
        .catch(err => console.warn('Could not load content:', err));
    });
  }
}
