import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { I18nService } from '../../core/services/i18n.service';
import { SettingsPanelComponent } from '../../components/settings-panel/settings-panel';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, SettingsPanelComponent],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundPage {
  protected readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);

  /** Optional `?name=` — the family the visitor was looking for. */
  readonly searched = toSignal(
    this.route.queryParamMap.pipe(map(p => p.get('name'))),
    { initialValue: null }
  );
}
