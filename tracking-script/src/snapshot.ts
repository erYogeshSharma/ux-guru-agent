import { CONFIG } from "./config";
import { SnapshotPayload } from "./types";

export class SnapshotManager {
  /** Lazy loader for html2canvas so we only fetch the hefty dependency when first needed. */
  private html2canvasLoader: (() => Promise<any>) | null = null;
  /** Timer id for the consolidated (idle) snapshot capture. */
  private idleTimer: number | null = null;
  /** Tracks if a capture is currently running to avoid re-entrancy. */
  private isCapturing = false;
  /** Callback used to actually emit the snapshot event. */
  private sendEventCallback: (type: string, payload: any) => void;
  /** Indicates if there have been requests since last schedule (for debug). */
  private pendingRequestCount = 0;
  /** Timestamp of last successful capture (ms epoch). */
  private lastCaptureTime = 0;
  /** Timestamp of last successful snapshot send (ms epoch). */
  private lastSentTime = 0;
  /** Scroll position captured at time of the latest request (used for accurate viewport snapshot). */
  private requestedScrollX: number | null = null;
  private requestedScrollY: number | null = null;
  /** Simple hash of last viewport state to detect duplicates. */
  private lastViewportHash: number | null = null;

  constructor(sendEventCallback: (type: string, payload: any) => void) {
    this.sendEventCallback = sendEventCallback;
  }

  private async loadHtml2Canvas(): Promise<any> {
    if (!this.html2canvasLoader) {
      this.html2canvasLoader = async () => {
        try {
          // @ts-ignore - dynamic import name
          const mod = await import("html2canvas");
          return mod && mod.default ? mod.default : mod;
        } catch (e) {
          // fallback to CDN
          return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src =
              "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
            script.onload = () => {
              // @ts-ignore
              if (window.html2canvas) resolve((window as any).html2canvas);
              else reject(new Error("html2canvas not available after load"));
            };
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
      };
    }
    return this.html2canvasLoader();
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed reading blob"));
      reader.onload = () => {
        const result = reader.result as string | null;
        if (!result) return reject(new Error("Empty blob result"));
        const idx = result.indexOf(",");
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Public API: request a snapshot. Instead of immediately capturing we
   * simply (re)start a 1s idle timer. If more requests arrive inside the
   * window we only keep one capture – this prevents flooding during bursts
   * of DOM mutations, scroll, key presses, etc.
   */
  requestSnapshot(): void {
    this.pendingRequestCount++;

    // Record scroll position at request time so we can force html2canvas to use it later.
    // prefer pageXOffset/pageYOffset which better reflects the actual viewport
    // position across browsers (and matches html2canvas expectations)
    this.requestedScrollX = window.pageXOffset;
    this.requestedScrollY = window.pageYOffset;

    if (this.idleTimer) window.clearTimeout(this.idleTimer);

    this.idleTimer = window.setTimeout(() => {
      // When the timer fires we do a single capture representing the
      // stabilized state after the burst of activity.
      const count = this.pendingRequestCount;
      this.pendingRequestCount = 0;
      this.captureAndSendSnapshot(count);
    }, CONFIG.SNAPSHOT_IDLE_DELAY);
  }

  /**
   * For mutation observers: only schedule if we haven't just sent a
   * snapshot very recently. Prevents feedback loops where the act of
   * capturing mutates the DOM (e.g., canvas insertion) and triggers more captures.
   */
  shouldScheduleAfterMutation(): boolean {
    if (this.isCapturing) return false;
    const since = Date.now() - this.lastSentTime; // Use lastSentTime instead of lastCaptureTime
    return since > CONFIG.SNAPSHOT_IDLE_DELAY; // require at least idle delay between mutation-driven captures
  }

  /**
   * Core capture routine – performs html2canvas snapshot while respecting
   * pixel caps and dynamic quality/scale adjustments.
   * @param consolidatedRequestCount how many raw requests were collapsed
   */
  private async captureAndSendSnapshot(
    consolidatedRequestCount: number
  ): Promise<void> {
    if (this.isCapturing) {
      // Another capture is already underway; we skip – subsequent activity
      // will schedule again if needed.
      return;
    }

    // We'll compute a lightweight viewport hash after we ensure the window is
    // scrolled to the position we intend to capture. This avoids false-positives
    // when the scheduled/target scroll differs from the current window values.

    this.isCapturing = true;
    try {
      const html2canvas = await this.loadHtml2Canvas();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      // Use the scroll position saved when the snapshot was requested to ensure
      // we don't always capture the initial (top) viewport.
      const targetScrollX = this.requestedScrollX ?? window.scrollX;
      const targetScrollY = this.requestedScrollY ?? window.scrollY;
      // If the user has scrolled further since scheduling, prefer most recent window values.
      // (This guards against multiple queued requests consolidating into one capture.)
      if (
        window.scrollY !== targetScrollY ||
        window.scrollX !== targetScrollX
      ) {
        window.scrollTo(targetScrollX, targetScrollY);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      } else {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }

      // Now compute the viewport hash for the exact viewport we will capture
      const currentViewportHash = this.createViewportHash(
        targetScrollX,
        targetScrollY
      );
      if (
        this.lastViewportHash !== null &&
        currentViewportHash === this.lastViewportHash
      ) {
        console.log(
          `[Tracker] Skipping duplicate viewport (hash=${currentViewportHash}) scrollY=${targetScrollY}`
        );
        this.lastCaptureTime = Date.now();
        this.requestedScrollX = null;
        this.requestedScrollY = null;
        return;
      }
      let scale = Math.min(window.devicePixelRatio, CONFIG.MAX_DPR_MULTIPLIER);
      const maxPixels = CONFIG.MAX_SNAPSHOT_PIXELS;
      const estPixels = viewportWidth * viewportHeight * scale * scale;
      if (estPixels > maxPixels) {
        scale = Math.sqrt(maxPixels / (viewportWidth * viewportHeight));
      }
      // Use documentElement as the root for html2canvas and explicitly pass
      // x/y so html2canvas crops to the requested viewport. Passing x/y is
      // more reliable than relying solely on scrollX/scrollY when pages
      // use different scrolling strategies.
      const canvas = await html2canvas(document.documentElement, {
        useCORS: true,
        allowTaint: false,
        scale,
        width: viewportWidth,
        height: viewportHeight,
        // x/y specify the top-left corner of the region to capture
        x: targetScrollX,
        y: targetScrollY,
        // set scroll offsets to 0 because we've applied x/y explicitly
        scrollX: 0,
        scrollY: 0,
        // windowWidth/windowHeight describe the layout viewport used by
        // the page during rendering. Use full document dimensions so
        // elements positioned outside the viewport are rendered correctly.
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        removeContainer: true, // help prevent mutation observer / layout side effects
      });
      const pixelCount = canvas.width * canvas.height;
      let quality = 0.8;
      if (pixelCount > 2_000_000) quality = 0.6;
      else if (pixelCount > 1_000_000) quality = 0.7;
      let blob: Blob | null = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b: Blob | null) => resolve(b), "image/webp", quality)
      );
      if (!blob) {
        blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b: Blob | null) => resolve(b), "image/jpeg", quality)
        );
      }
      if (!blob) return;
      const base64 = await this.blobToBase64(blob);

      // Update the viewport hash since we successfully captured
      this.lastViewportHash = currentViewportHash;

      const payload: SnapshotPayload = {
        data: base64,
        width: canvas.width,
        height: canvas.height,
        viewportWidth,
        viewportHeight,
        scrollX: targetScrollX,
        scrollY: targetScrollY,
        mime: blob.type,
        quality,
        scale,
      };
      // Include the collapsed request count as debug metadata (optional header field)
      this.sendEventCallback(CONFIG.EVENT_TYPES.SNAPSHOT, payload);
      // eslint-disable-next-line no-console
      console.log(
        `[Tracker] Snapshot sent (${blob.size} bytes, consolidated ${consolidatedRequestCount} requests)`
      );
      const now = Date.now();
      this.lastCaptureTime = now;
      this.lastSentTime = now; // Track when we actually sent a snapshot
      // Reset stored requested scroll so next consolidated batch re-reads
      this.requestedScrollX = null;
      this.requestedScrollY = null;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Tracker] Snapshot failed", e);
    } finally {
      this.isCapturing = false;
    }
  }

  /**
   * Create a lightweight hash of the current viewport state to detect changes
   * without generating a full snapshot.
   */
  private createViewportHash(
    overrideScrollX?: number | null,
    overrideScrollY?: number | null
  ): number {
    const viewport = {
      // Use page offsets which reflect the layout viewport consistently
      scrollX: overrideScrollX ?? window.pageXOffset,
      scrollY: overrideScrollY ?? window.pageYOffset,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      // Include some DOM structure info
      bodyHeight: document.body.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      // Simple text content sample to detect content changes
      textContent: document.body.textContent?.slice(0, 1000) || "",
    };

    const str = JSON.stringify(viewport);
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash;
  }
}
