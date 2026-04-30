import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  OnInit,
  Signal,
  signal,
  ViewChild,
  WritableSignal,
  inject
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { FamilyService } from '../../core/services/family.service';
import { FamilyTree, TreeNode } from '../../core/models/tree.model';
import { I18nService } from '../../core/services/i18n.service';
import { TreeNodeComponent } from '../../components/tree-node/tree-node';
import { SettingsPanelComponent } from '../../components/settings-panel/settings-panel';

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.15;

@Component({
  selector: 'app-family-tree-page',
  standalone: true,
  imports: [CommonModule, RouterLink, TreeNodeComponent, SettingsPanelComponent],
  templateUrl: './family-tree-page.html',
  styleUrl: './family-tree-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyTreePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly familyService = inject(FamilyService);
  protected readonly i18n = inject(I18nService);

  @ViewChild('viewport', { static: false }) viewportRef?: ElementRef<HTMLDivElement>;

  readonly familyName: WritableSignal<string> = signal('');
  readonly tree: WritableSignal<FamilyTree | null> = signal(null);
  readonly loading: WritableSignal<boolean> = signal(false);
  readonly error: WritableSignal<string | null> = signal(null);

  readonly zoom: WritableSignal<number> = signal(1);
  readonly panX: WritableSignal<number> = signal(0);
  readonly panY: WritableSignal<number> = signal(0);

  readonly forest: Signal<TreeNode[]> = computed(() => this.tree()?.roots ?? []);
  readonly totalMembers: Signal<number> = computed(() => this.tree()?.totalMembers ?? 0);

  readonly transform: Signal<string> = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`
  );

  readonly zoomPercent: Signal<number> = computed(() => Math.round(this.zoom() * 100));

  // Pan state — only mutated during an active drag.
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const name = params.get('familyName')?.trim() ?? '';
      if (!name) {
        this.router.navigate(['/']);
        return;
      }
      this.familyName.set(name);
      this.resetView();
      this.load(name);
    });
  }

  private load(familyName: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.tree.set(null);

    this.familyService.getPublicTreeByName(familyName)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: response => {
          if (!response?.data) {
            this.router.navigate(['/not-found'], { queryParams: { name: familyName } });
            return;
          }
          this.tree.set(response.data);
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 404) {
            this.router.navigate(['/not-found'], { queryParams: { name: familyName } });
            return;
          }
          this.error.set(err?.error?.message ?? err?.message ?? this.i18n.t('tree.errorLoad'));
        }
      });
  }

  // ─── Zoom controls ─────────────────────────────────────────────
  zoomIn(): void { this.zoom.update(z => Math.min(z + ZOOM_STEP, ZOOM_MAX)); }
  zoomOut(): void { this.zoom.update(z => Math.max(z - ZOOM_STEP, ZOOM_MIN)); }
  resetView(): void {
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  /**
   * Zoom toward the cursor — multiply the new/old scale ratio onto the offset
   * from the viewport's centre so the point under the cursor stays put.
   */
  onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && Math.abs(event.deltaY) < 4) {
      // Let trackpad pinch through; ignore tiny scroll noise.
    }
    event.preventDefault();

    const viewport = this.viewportRef?.nativeElement;
    if (!viewport) return;

    const oldZoom = this.zoom();
    const direction = event.deltaY > 0 ? -1 : 1;
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldZoom + direction * ZOOM_STEP));
    if (newZoom === oldZoom) return;

    const rect = viewport.getBoundingClientRect();
    const cx = event.clientX - rect.left - rect.width / 2;
    const cy = event.clientY - rect.top - rect.height / 2;
    const ratio = newZoom / oldZoom;

    this.panX.update(p => cx - (cx - p) * ratio);
    this.panY.update(p => cy - (cy - p) * ratio);
    this.zoom.set(newZoom);
  }

  // ─── Pan (drag) ────────────────────────────────────────────────
  onPointerDown(event: PointerEvent): void {
    // Only left-button or touch — never start a pan from a node click.
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.dragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.panX.update(p => p + dx);
    this.panY.update(p => p + dy);
  }

  onPointerUp(event: PointerEvent): void {
    this.dragging = false;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === '+' || event.key === '=') { this.zoomIn(); event.preventDefault(); }
    else if (event.key === '-' || event.key === '_') { this.zoomOut(); event.preventDefault(); }
    else if (event.key === '0') { this.resetView(); event.preventDefault(); }
  }
}
