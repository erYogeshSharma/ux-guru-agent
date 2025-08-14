import { CONFIG } from "./config";

/**
 * Optimized viewport tracker that intelligently determines when to capture
 * screenshots vs when to just track scroll position for smooth replay
 */
export class ViewportTracker {
  private lastScrollX = 0;
  private lastScrollY = 0;
  private sendEventCallback: (type: string, payload: any) => void;
  private scrollDebounceTimer: number | null = null;

  constructor(sendEventCallback: (type: string, payload: any) => void) {
    this.sendEventCallback = sendEventCallback;
    this.setupScrollTracking();
  }

  private setupScrollTracking(): void {
    const handleScroll = () => {
      const currentScrollX = window.pageXOffset;
      const currentScrollY = window.pageYOffset;

      // Only send if scroll position actually changed
      if (
        currentScrollX !== this.lastScrollX ||
        currentScrollY !== this.lastScrollY
      ) {
        this.lastScrollX = currentScrollX;
        this.lastScrollY = currentScrollY;

        // Debounce scroll events to avoid spam
        if (this.scrollDebounceTimer) {
          window.clearTimeout(this.scrollDebounceTimer);
        }

        this.scrollDebounceTimer = window.setTimeout(() => {
          this.sendEventCallback(CONFIG.EVENT_TYPES.SCROLL, {
            scrollX: currentScrollX,
            scrollY: currentScrollY,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
          });
        }, 50); // 50ms debounce for smooth but efficient tracking
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
  }

  /**
   * Calculate if scroll distance is significant enough to warrant a new snapshot
   */
  shouldTriggerSnapshot(): boolean {
    const deltaX = Math.abs(window.pageXOffset - this.lastScrollX);
    const deltaY = Math.abs(window.pageYOffset - this.lastScrollY);
    const viewportHeight = window.innerHeight;

    // Trigger snapshot if scrolled more than half a viewport
    return deltaY > viewportHeight * 0.5 || deltaX > window.innerWidth * 0.5;
  }
}
