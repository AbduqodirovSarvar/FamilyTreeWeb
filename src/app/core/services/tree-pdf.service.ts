import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

/**
 * Renders a DOM subtree to a downloadable PDF.
 *
 * Implementation notes:
 *   - html2canvas-pro is used instead of plain html2canvas because the
 *     codebase relies on CSS variables (`var(--…)`), modern color functions
 *     and box-shadow tinting that the original fork still struggles with.
 *   - Both libraries are loaded via dynamic import so SSR doesn't try to
 *     execute their browser-only code, and they don't bloat the initial
 *     bundle for visitors who never hit the download button.
 *   - We capture at 2× pixel ratio so the PDF stays sharp on retina displays
 *     and when zoomed in inside a PDF viewer. Higher than 2 blows up memory
 *     for large families without a meaningful quality gain.
 *   - The PDF page is auto-sized to the captured canvas (A4 / A3 fixed
 *     pages would force scaling/cropping). Keeping a 1:1 mapping means the
 *     output looks identical to the on-screen tree.
 */
@Injectable({ providedIn: 'root' })
export class TreePdfService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** True while a capture is in flight — UI binds a spinner to this. */
  private busy = false;

  isBusy(): boolean { return this.busy; }

  /**
   * Capture `target` and trigger a browser download of the resulting PDF.
   *
   * @param target    The DOM element to capture. Should be at its natural
   *                  unscaled size — callers are responsible for resetting
   *                  any pan/zoom transforms before calling.
   * @param fileName  Output file name (without extension). Spaces and
   *                  unsafe characters are sanitized.
   */
  async exportElementToPdf(target: HTMLElement, fileName: string): Promise<void> {
    if (!this.isBrowser) return;
    if (this.busy) return;
    this.busy = true;
    try {
      // Dynamic imports so neither lib ever lands in the SSR bundle.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf')
      ]);

      // Inter is loaded from Google Fonts via <link>. If the user clicks
      // the download button before the font finishes loading, html2canvas
      // captures fallback glyphs and the PDF looks off. fonts.ready
      // resolves once every declared @font-face is loaded.
      if (document.fonts?.ready) {
        try { await document.fonts.ready; } catch { /* progressive — ignore */ }
      }

      // Resolve the surface background for the captured area. Using the
      // computed token keeps light/dark themes consistent in the export.
      const bg = getComputedStyle(document.documentElement)
        .getPropertyValue('--canvas-bg')
        .trim() || '#ffffff';

      const canvas = await html2canvas(target, {
        backgroundColor: bg,
        scale: 2,
        useCORS: true,
        logging: false,
        // Avoid tainting from images served by the public-tree API
        // when CORS isn't pre-flighted on every asset.
        allowTaint: true
      });

      // Sub-pixel rounding can leave a 1px stripe on the right/bottom edges
      // when html2canvas trims; the +1 gives the PDF page a hair of slack.
      const widthPx = canvas.width + 1;
      const heightPx = canvas.height + 1;

      // px → pt at 96dpi: 1px = 0.75pt. jsPDF's "pt" unit is what
      // standard A-series page sizes use, so the math stays simple.
      const widthPt = widthPx * 0.75;
      const heightPt = heightPx * 0.75;

      const pdf = new jsPDF({
        orientation: widthPt > heightPt ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [widthPt, heightPt],
        compress: true
      });

      // JPEG keeps the file an order of magnitude smaller than PNG for
      // photo-heavy trees (member portraits dominate the bytes). Quality
      // 0.92 is visually lossless for screenshots.
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, widthPt, heightPt, undefined, 'FAST');

      pdf.save(`${this.sanitizeFileName(fileName)}.pdf`);
    } finally {
      this.busy = false;
    }
  }

  /** Strip characters that browsers / OSes refuse in download names. */
  private sanitizeFileName(raw: string): string {
    const cleaned = raw
      .normalize('NFKD')
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    return cleaned || 'shajara';
  }
}
