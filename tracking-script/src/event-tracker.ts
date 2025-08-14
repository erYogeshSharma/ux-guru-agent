import { CONFIG } from "./config";
import {
  CursorMovePayload,
  ClickPayload,
  WindowDimensionPayload,
  ScrollPayload,
} from "./types";
import { throttle } from "./utils";

export class EventTracker {
  /** Emits raw events (cursor, click, etc.) downstream (WebSocket manager). */
  private sendEventCallback: (type: string, payload: any) => void;
  /** Callback to request a consolidated snapshot (idle based). */
  private requestSnapshotCallback: () => void;
  /** Last time we emitted a mouse move (throttle enforcement). */
  private lastMouseMove = 0;
  /** Track last scroll position to avoid redundant scroll events. */
  private lastScrollPosition = { x: window.scrollX, y: window.scrollY };
  /** Optional predicate to guard mutation-driven snapshot loops. */
  private shouldScheduleAfterMutation?: () => boolean;
  /** Timer used to detect end-of-scroll (idle) before taking a snapshot. */
  private scrollIdleTimer: number | null = null;

  constructor(
    sendEventCallback: (type: string, payload: any) => void,
    requestSnapshotCallback: () => void,
    shouldScheduleAfterMutation?: () => boolean
  ) {
    this.sendEventCallback = sendEventCallback;
    this.requestSnapshotCallback = requestSnapshotCallback;
    this.shouldScheduleAfterMutation = shouldScheduleAfterMutation;
  }

  private sendWindowDimensions(): void {
    const payload: WindowDimensionPayload = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    this.sendEventCallback(CONFIG.EVENT_TYPES.WINDOW_DIMENSION, payload);
  }

  private handleMouseMove = (e: MouseEvent): void => {
    const now = Date.now();
    if (now - this.lastMouseMove >= CONFIG.MOUSE_MOVE_INTERVAL) {
      const payload: CursorMovePayload = { x: e.clientX, y: e.clientY };
      this.sendEventCallback(CONFIG.EVENT_TYPES.CURSOR_MOVE, payload);
      this.lastMouseMove = now;
    }
  };

  private handleClick = (e: MouseEvent): void => {
    const payload: ClickPayload = { x: e.clientX, y: e.clientY };
    this.sendEventCallback(CONFIG.EVENT_TYPES.CLICK, payload);
    this.requestSnapshotCallback();
  };

  private handleScroll = throttle((): void => {
    const currentScrollX = window.scrollX;
    const currentScrollY = window.scrollY;

    // Only send scroll event and schedule snapshot if scroll position changed significantly
    const scrollThreshold = 10; // pixels
    if (
      Math.abs(currentScrollX - this.lastScrollPosition.x) > scrollThreshold ||
      Math.abs(currentScrollY - this.lastScrollPosition.y) > scrollThreshold
    ) {
      console.log("[Tracker] Scroll detected, scheduling snapshot", {
        x: currentScrollX,
        y: currentScrollY,
        deltaX: currentScrollX - this.lastScrollPosition.x,
        deltaY: currentScrollY - this.lastScrollPosition.y,
      });

      const payload: ScrollPayload = {
        scrollX: currentScrollX,
        scrollY: currentScrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };

      this.sendEventCallback(CONFIG.EVENT_TYPES.SCROLL, payload);

      // Reset scroll idle timer – snapshot only after no scroll for idle delay
      if (this.scrollIdleTimer) window.clearTimeout(this.scrollIdleTimer);
      this.scrollIdleTimer = window.setTimeout(() => {
        this.requestSnapshotCallback();
      }, CONFIG.SNAPSHOT_IDLE_DELAY);

      this.lastScrollPosition = { x: currentScrollX, y: currentScrollY };
    }
  }, 100); // throttle scroll events to max 10 per second

  private handleResize = (): void => {
    this.sendWindowDimensions();
    this.requestSnapshotCallback();
  };

  private handleKeyDown = (): void => {
    this.requestSnapshotCallback();
  };

  private setupMutationObserver(): void {
    // We still observe mutations for potential future features (DOM diffing),
    // but we no longer trigger snapshots directly from them to avoid loops.
    const mutationObserver = new MutationObserver(() => {
      /* intentionally no snapshot scheduling here */
    });

    if (document.body) {
      mutationObserver.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    } else {
      window.addEventListener(
        "DOMContentLoaded",
        () => {
          if (document.body) {
            mutationObserver.observe(document.body, {
              attributes: true,
              childList: true,
              subtree: true,
            });
          }
        },
        { once: true }
      );
    }
  }

  startTracking(): void {
    // Send initial window dimensions
    this.sendWindowDimensions();

    // Event listeners
    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("click", this.handleClick);

    // Add scroll listeners to both window and document for better coverage
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    document.addEventListener("scroll", this.handleScroll, { passive: true });

    document.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("load", () => {
      this.sendWindowDimensions();
      this.requestSnapshotCallback();
    });
    window.addEventListener("resize", this.handleResize);

    // DOM mutation observer
    this.setupMutationObserver();

    console.log("[Tracker] Event tracking started - scroll listeners attached");

    // Test scroll detection
    console.log(
      "[Tracker] Initial scroll position:",
      window.scrollX,
      window.scrollY
    );
  }
}
