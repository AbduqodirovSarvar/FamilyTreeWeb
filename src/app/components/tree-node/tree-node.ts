import { ChangeDetectionStrategy, Component, computed, inject, Input, Signal, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gender } from '../../core/models/gender.enum';
import { SpouseGroup, TreeNode } from '../../core/models/tree.model';
import { I18nService } from '../../core/services/i18n.service';
import { MemberCardComponent } from '../member-card/member-card';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule, MemberCardComponent],
  templateUrl: './tree-node.html',
  styleUrl: './tree-node.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreeNodeComponent {
  private readonly _node: WritableSignal<TreeNode | null> = signal<TreeNode | null>(null);

  @Input({ required: true }) set node(v: TreeNode) {
    this._node.set(v);
  }
  get node(): TreeNode { return this._node()!; }

  @Input() isRoot = false;
  /** Family surname — used as fallback for spouse-group labels. */
  @Input() familyName?: string | null = null;

  /** Spouse-groups that actually have children — empty groups are filtered out. */
  readonly visibleSpouseGroups: Signal<SpouseGroup[]> = computed(() =>
    (this._node()?.spouses ?? []).filter(g => g.children.length > 0)
  );

  /** Whether this hub has any descendants worth rendering below it. */
  readonly hasAnyChildren: Signal<boolean> = computed(() => {
    const n = this._node();
    if (!n) return false;
    return n.commonChildren.length > 0 || this.visibleSpouseGroups().length > 0;
  });

  /**
   * Polygamous when the primary has 2+ spouses. Each marriage gets its own hub
   * so it is visually unambiguous which children belong to which wife.
   */
  readonly isPolygamous: Signal<boolean> = computed(() =>
    (this._node()?.spouses ?? []).length > 1
  );

  private readonly i18n = inject(I18nService);

  primaryRelation(): string {
    if (this.isRoot) return this.i18n.t('node.head');
    return this.i18n.t(this.node.primary.gender === Gender.MALE ? 'node.son' : 'node.daughter');
  }

  spouseLabel(index: number): string {
    return index === 0
      ? this.i18n.t('node.spouse')
      : this.i18n.t('node.spouseN', { n: index + 1 });
  }

  spouseGroupLabel(group: SpouseGroup): string {
    const last = (group.spouse.lastName ?? '').trim();
    const first = (group.spouse.firstName ?? '').trim();
    const tag = (last || first || this.familyName || '').toUpperCase();
    return tag
      ? this.i18n.t('node.familyChildren', { tag })
      : this.i18n.t('node.children');
  }

  commonChildrenLabel(): string {
    return this.i18n.t('node.commonChildren');
  }
}
