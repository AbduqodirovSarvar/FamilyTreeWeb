import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './core/services/i18n.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly i18n = inject(I18nService);

  /** Footer copyright year — captured at app boot; the page lifetime is
   *  short enough that we don't bother recomputing on a date rollover. */
  protected readonly year = new Date().getFullYear();

  /** Public admin app URL — drives the footer "create your own tree" link.
   *  Mirrors the home-page CTA so the link stays visible on every page,
   *  not just the landing one. Empty string hides the link. */
  protected readonly adminUrl: string = environment.adminUrl ?? '';
}
