import { Injectable, computed, effect, signal } from '@angular/core';
import { Dict, Lang } from './i18n.types';
import { EN } from './en';
import { PL } from './pl';

const DICTS: Record<Lang, Dict> = { en: EN, pl: PL };
const STORAGE_KEY = 'baltic.lang';

/**
 * Manages UI language and localized texts.
 * Resolves initial language from localStorage ('baltic.lang') or Navigator API,
 * falling back to 'en', and persists selection to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly dicts = DICTS;
  readonly langs: Lang[] = ['en', 'pl'];
  readonly lang = signal<Lang>(this.resolveInitialLang());
  readonly t = computed(() => DICTS[this.lang()]);

  constructor() {
    effect(() => {
      const currentLang = this.lang();
      const d = this.t();
      if (typeof document !== 'undefined') {
        document.documentElement.lang = d.htmlLang;
        document.title = d.docTitle;
      }
      this.persistLang(currentLang);
    });
  }

  setLang(lang: Lang) {
    this.lang.set(lang);
  }

  private resolveInitialLang(): Lang {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (this.isSupportedLang(stored)) {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }

    if (typeof navigator !== 'undefined') {
      const candidates = [
        ...(Array.isArray(navigator.languages) ? navigator.languages : []),
        navigator.language
      ].filter(Boolean);

      for (const candidate of candidates) {
        const prefix = candidate.slice(0, 2).toLowerCase();
        if (this.isSupportedLang(prefix)) {
          return prefix;
        }
      }
    }

    return 'en';
  }

  private isSupportedLang(val: string | null | undefined): val is Lang {
    return val === 'en' || val === 'pl';
  }

  private persistLang(lang: Lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage unavailable
    }
  }
}
