import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { Gender } from '../../core/models/gender.enum';
import { TreeMember } from '../../core/models/tree.model';
import { I18nService } from '../../core/services/i18n.service';
import { ImageUrlService } from '../../core/services/image-url.service';

@Component({
  selector: 'app-member-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './member-card.html',
  styleUrl: './member-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberCardComponent {
  private readonly _member = signal<TreeMember | null>(null);
  @Input({ required: true }) set member(value: TreeMember) { this._member.set(value); }
  get member(): TreeMember { return this._member()!; }

  /** Label shown under the name on the small card (e.g. "Bosh ota-bobo"). */
  @Input({ required: true }) relation!: string;

  readonly Gender = Gender;
  private readonly imageUrl = inject(ImageUrlService);
  protected readonly i18n = inject(I18nService);

  readonly avatarUrl = computed(() => this.imageUrl.resolvePath(this._member()?.imageUrl));

  shortName(): string {
    const m = this._member();
    if (!m) return '—';
    const parts = [m.firstName, m.lastName].filter(Boolean);
    return parts.slice(0, 2).join(' ').trim() || '—';
  }

  fullName(): string {
    const m = this._member();
    if (!m) return '—';
    return [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || '—';
  }

  birthYear(): string {
    return this.year(this.member.birthDay);
  }

  /** "1 Yanvar 2000" — long date for the tooltip. */
  birthDateLong(): string { return this.dateLong(this.member.birthDay); }
  deathDateLong(): string | null {
    return this.member.deathDay ? this.dateLong(this.member.deathDay) : null;
  }

  /** Years lived (or current age for the living). null if birth date is missing. */
  age(): number | null {
    if (!this.member.birthDay) return null;
    const start = new Date(this.member.birthDay);
    if (isNaN(start.getTime())) return null;
    const end = this.member.deathDay ? new Date(this.member.deathDay) : new Date();
    if (isNaN(end.getTime())) return null;
    let years = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < start.getDate())) years--;
    return Math.max(0, years);
  }

  genderLabel(): string {
    return this.i18n.t(this.member.gender === Gender.MALE ? 'member.male' : 'member.female');
  }

  statusLabel(): string {
    if (this.member.deathDay) return this.i18n.t('member.deceased');
    if (!this.member.birthDay) return this.i18n.t('member.partial');
    return this.i18n.t('member.alive');
  }

  statusClass(): 'alive' | 'pending' | 'deceased' {
    if (this.member.deathDay) return 'deceased';
    if (!this.member.birthDay) return 'pending';
    return 'alive';
  }

  // ─── private formatters ───────────────────────────────────────
  private year(d: string | null | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.getFullYear().toString();
  }

  /**
   * Format `YYYY-MM-DD` (the shape DateOnly serialises to) as `dd.mm.yyyy` plus
   * a locale-appropriate year suffix (`y.` / `г.` / nothing).
   * Parsed by regex rather than `new Date()` to avoid the UTC-rollback bug
   * (e.g. "2000-01-15" → Jan 14 in negative-offset timezones).
   */
  private dateLong(d: string | null | undefined): string {
    if (!d) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (!m) return '';
    const lang = this.i18n.lang();
    const suffix = lang === 'uz' ? ' y.' : lang === 'ru' ? ' г.' : '';
    return `${m[3]}.${m[2]}.${m[1]}${suffix}`;
  }
}
