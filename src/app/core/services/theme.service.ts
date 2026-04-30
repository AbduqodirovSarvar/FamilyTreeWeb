import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'ft.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /** Raw user preference — light/dark/system. */
  readonly mode = signal<ThemeMode>(this.readInitial());

  /** Tracks the OS-level dark preference so 'system' mode stays in sync. */
  private readonly systemDark = signal(false);

  /** Resolved theme actually applied to the document. */
  readonly effective = computed<EffectiveTheme>(() => {
    const m = this.mode();
    if (m === 'system') return this.systemDark() ? 'dark' : 'light';
    return m;
  });

  constructor() {
    if (this.isBrowser) {
      // Sync the system preference and watch for changes (e.g. user flips OS theme).
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemDark.set(mq.matches);
      mq.addEventListener('change', e => this.systemDark.set(e.matches));

      // Whenever the resolved theme changes, write it back to <html data-theme="...">
      // and persist the user's chosen mode.
      effect(() => {
        const theme = this.effective();
        document.documentElement.dataset['theme'] = theme;
      });

      effect(() => {
        try { localStorage.setItem(STORAGE_KEY, this.mode()); } catch { /* private mode etc. */ }
      });
    }
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  /** Cycle light → dark → system → light. Useful for a single button. */
  cycle(): void {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const i = order.indexOf(this.mode());
    this.mode.set(order[(i + 1) % order.length]);
  }

  private readInitial(): ThemeMode {
    if (!this.isBrowser) return 'system';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch { /* localStorage may be blocked */ }
    return 'system';
  }
}
