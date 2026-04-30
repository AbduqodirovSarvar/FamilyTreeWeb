import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { Lang, TRANSLATIONS } from '../i18n/translations';

const STORAGE_KEY = 'ft.lang';
const SUPPORTED: Lang[] = ['uz', 'ru', 'en'];

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly lang = signal<Lang>(this.readInitial());

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        try { localStorage.setItem(STORAGE_KEY, this.lang()); } catch { /* private mode etc. */ }
        document.documentElement.lang = this.lang();
      });
    }
  }

  setLang(lang: Lang): void {
    if (SUPPORTED.includes(lang)) this.lang.set(lang);
  }

  /**
   * Look up `key` in the active language. Reading `lang()` here makes any
   * template binding `{{ i18n.t('key') }}` reactively re-render on switch.
   * Missing keys fall back to the key itself so the UI doesn't render blanks.
   */
  t = (key: string, params?: Record<string, string | number>): string => {
    const dict = TRANSLATIONS[this.lang()];
    let str = dict?.[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(v));
      }
    }
    return str;
  };

  private readInitial(): Lang {
    if (this.isBrowser) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
        if (stored && SUPPORTED.includes(stored)) return stored;
      } catch { /* ignore */ }
      // Fall back to a coarse browser-language sniff so RU/EN visitors don't see UZ.
      const nav = navigator.language?.toLowerCase() ?? '';
      if (nav.startsWith('ru')) return 'ru';
      if (nav.startsWith('en')) return 'en';
    }
    return 'uz';
  }
}
