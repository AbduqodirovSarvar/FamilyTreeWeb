import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
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
import { TreePdfService } from '../../core/services/tree-pdf.service';
import { TreeNodeComponent } from '../../components/tree-node/tree-node';
import { SettingsPanelComponent } from '../../components/settings-panel/settings-panel';

const ZOOM_MIN = 0.1;
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
  private readonly pdfService = inject(TreePdfService);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly i18n = inject(I18nService);

  @ViewChild('viewport', { static: false }) viewportRef?: ElementRef<HTMLDivElement>;
  @ViewChild('stage', { static: false }) stageRef?: ElementRef<HTMLDivElement>;

  readonly familyName: WritableSignal<string> = signal('');
  readonly tree: WritableSignal<FamilyTree | null> = signal(null);
  readonly loading: WritableSignal<boolean> = signal(false);
  readonly error: WritableSignal<string | null> = signal(null);

  /** True while a PDF capture is in flight — toolbar binds a spinner to it
   *  and we apply `.exporting` on the page so transient UI (zoom toolbar,
   *  settings dropdown) is hidden from the screenshot. */
  readonly exportingPdf: WritableSignal<boolean> = signal(false);

  readonly zoom: WritableSignal<number> = signal(1);
  readonly panX: WritableSignal<number> = signal(0);
  readonly panY: WritableSignal<number> = signal(0);

  readonly forest: Signal<TreeNode[]> = computed(() => this.tree()?.roots ?? []);
  readonly totalMembers: Signal<number> = computed(() => this.tree()?.totalMembers ?? 0);

  readonly transform: Signal<string> = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`
  );

  readonly zoomPercent: Signal<number> = computed(() => Math.round(this.zoom() * 100));

  // Active pointers — keyed by pointerId so each touch is tracked
  // independently. One = pan, two = pinch zoom.
  private readonly activePointers = new Map<number, { x: number; y: number }>();
  readonly dragging: WritableSignal<boolean> = signal(false);
  private lastX = 0;
  private lastY = 0;
  private lastPinchDistance = 0;

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

  /**
   * Capture the rendered tree and download it as a PDF. Resets pan/zoom
   * to identity first so the capture sees the full unscaled stage; the
   * `.exporting` flag toggles overlay UI off (zoom toolbar / settings) so
   * the screenshot stays clean. We restore the previous transform after.
   */
  async downloadPdf(): Promise<void> {
    if (this.exportingPdf() || !this.tree()) return;
    const stage = this.stageRef?.nativeElement;
    if (!stage) return;

    const prevZoom = this.zoom();
    const prevPanX = this.panX();
    const prevPanY = this.panY();

    this.exportingPdf.set(true);
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);

    // Force a synchronous repaint so html2canvas captures the
    // identity-transformed stage, not the previous panned/zoomed frame.
    this.cdr.detectChanges();
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

    try {
      const t = this.tree();
      const baseName = t?.name || t?.familyName || this.familyName() || 'shajara';
      await this.pdfService.exportElementToPdf(stage, baseName);
    } catch (err) {
      this.error.set(this.i18n.t('tree.errorPdf'));
    } finally {
      this.zoom.set(prevZoom);
      this.panX.set(prevPanX);
      this.panY.set(prevPanY);
      this.exportingPdf.set(false);
    }
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
   * Zoom around an arbitrary viewport point so the world point under it
   * stays put — same trick used by every map app. (cx, cy) are in
   * viewport-centre coordinates.
   */
  private zoomAt(cx: number, cy: number, newZoom: number): void {
    const oldZoom = this.zoom();
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom));
    if (clamped === oldZoom) return;
    const ratio = clamped / oldZoom;
    this.panX.update(p => cx - (cx - p) * ratio);
    this.panY.update(p => cy - (cy - p) * ratio);
    this.zoom.set(clamped);
  }

  /** Convert client-space coordinates into viewport-centre coordinates. */
  private toViewportCoords(clientX: number, clientY: number): { x: number; y: number } | null {
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport) return null;
    const rect = viewport.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }

  /** Wheel — zoom toward the cursor. */
  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const point = this.toViewportCoords(event.clientX, event.clientY);
    if (!point) return;
    const direction = event.deltaY > 0 ? -1 : 1;
    this.zoomAt(point.x, point.y, this.zoom() + direction * ZOOM_STEP);
  }

  // ─── Pointer events (mouse + touch + pen, unified) ─────────────
  onPointerDown(event: PointerEvent): void {
    // Ignore non-primary mouse buttons; touches always come through.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    if (this.activePointers.size === 1) {
      this.dragging.set(true);
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    } else if (this.activePointers.size === 2) {
      this.dragging.set(false);
      this.lastPinchDistance = this.currentPinchDistance();
    }
  }

  /** Native HTML5 image-drag would steal the pointer mid-pan — kill it. */
  onDragStart(event: DragEvent): void {
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.activePointers.has(event.pointerId)) return;
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size >= 2) {
      // Pinch — zoom toward the midpoint of the two touches.
      const newDistance = this.currentPinchDistance();
      if (this.lastPinchDistance > 0 && newDistance > 0) {
        const ratio = newDistance / this.lastPinchDistance;
        const mid = this.currentPinchMidpoint();
        if (mid) this.zoomAt(mid.x, mid.y, this.zoom() * ratio);
      }
      this.lastPinchDistance = newDistance;
      return;
    }

    if (this.dragging()) {
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.panX.update(p => p + dx);
      this.panY.update(p => p + dy);
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.activePointers.has(event.pointerId)) return;
    this.activePointers.delete(event.pointerId);
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }

    if (this.activePointers.size === 0) {
      this.dragging.set(false);
      this.lastPinchDistance = 0;
    } else if (this.activePointers.size === 1) {
      // Coming out of a pinch — reseat the drag anchor on the surviving
      // finger so the world doesn't jump on the next move.
      const remaining = Array.from(this.activePointers.values())[0];
      this.lastX = remaining.x;
      this.lastY = remaining.y;
      this.lastPinchDistance = 0;
      this.dragging.set(true);
    }
  }

  private currentPinchDistance(): number {
    const pts = Array.from(this.activePointers.values());
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  private currentPinchMidpoint(): { x: number; y: number } | null {
    const pts = Array.from(this.activePointers.values());
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return this.toViewportCoords((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === '+' || event.key === '=') { this.zoomIn(); event.preventDefault(); }
    else if (event.key === '-' || event.key === '_') { this.zoomOut(); event.preventDefault(); }
    else if (event.key === '0') { this.resetView(); event.preventDefault(); }
  }
}
