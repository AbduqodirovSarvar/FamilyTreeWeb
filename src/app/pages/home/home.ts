import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { SettingsPanelComponent } from '../../components/settings-panel/settings-panel';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, SettingsPanelComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly familyName = signal('');
  readonly error = signal<string | null>(null);

  /** Public admin app — destination of the "create your own tree" CTA.
   *  Read once at construction; the env value can't change at runtime.
   *  Empty string hides the CTA section entirely. */
  protected readonly adminUrl: string = environment.adminUrl ?? '';

  submit(): void {
    const raw = this.familyName().trim();
    if (!raw) {
      this.error.set(this.i18n.t('home.errorRequired'));
      return;
    }
    // Whitespace becomes a hyphen so the URL stays single-segment.
    const slug = raw.replace(/\s+/g, '-');
    this.error.set(null);
    this.router.navigate(['/', slug]);
  }
}
