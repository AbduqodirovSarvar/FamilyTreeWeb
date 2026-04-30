import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { LANG_OPTIONS, Lang } from '../../core/i18n/translations';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPanelComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(I18nService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly open = signal(false);
  readonly langs = LANG_OPTIONS;

  toggleTheme(): void { this.theme.cycle(); }
  pickLang(code: Lang): void { this.i18n.setLang(code); this.open.set(false); }
  togglePanel(): void { this.open.update(v => !v); }

  themeIcon(): 'sun' | 'moon' | 'system' {
    const m = this.theme.mode();
    if (m === 'light') return 'sun';
    if (m === 'dark') return 'moon';
    return 'system';
  }

  themeLabel(): string {
    const m = this.theme.mode();
    if (m === 'light') return this.i18n.t('settings.themeLight');
    if (m === 'dark') return this.i18n.t('settings.themeDark');
    return this.i18n.t('settings.themeSystem');
  }

  /** Close the language popover when clicking elsewhere. */
  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
