/**
 * CustomEventTracker - A comprehensive class for tracking custom events on top of rrweb
 *
 * This class provides semantic tracking of user interactions and behaviors
 * that complement the raw DOM events captured by rrweb.
 */

import { record } from "rrweb";

// Define custom event types for better type safety
export interface BaseCustomEvent {
  sessionId: string;
  userId: string;
  timestamp: number;
  url: string;
}

// 1. Navigation Events
export interface NavigationEvent extends BaseCustomEvent {
  type: "page_view" | "route_change" | "hash_change" | "back_forward";
  data: {
    from?: string;
    to: string;
    title?: string;
    referrer?: string;
  };
}

// 2. Interaction Events
export interface InteractionEvent extends BaseCustomEvent {
  type:
    | "click"
    | "dblclick"
    | "hover"
    | "scroll"
    | "drag_drop"
    | "context_menu"
    | "focus_blur";
  data: {
    element: {
      tag: string;
      text?: string;
      id?: string;
      className?: string;
      path: string;
      component?: string;
    };
    position?: { x: number; y: number };
    scrollDepth?: number;
    viewport?: { width: number; height: number };
  };
}

// 3. Form Events
export interface FormEvent extends BaseCustomEvent {
  type: "input_change" | "form_submit" | "form_error" | "form_abandon";
  data: {
    formId?: string;
    fieldName?: string;
    fieldType?: string;
    value?: string; // Be careful with sensitive data
    errorMessage?: string;
    formPath: string;
    fieldCount?: number;
    completedFields?: number;
  };
}

// 4. Media Events
export interface MediaEvent extends BaseCustomEvent {
  type:
    | "video_play"
    | "video_pause"
    | "video_seek"
    | "video_end"
    | "audio_play"
    | "audio_pause";
  data: {
    mediaId?: string;
    duration?: number;
    currentTime?: number;
    volume?: number;
    playbackRate?: number;
    src?: string;
  };
}

// 5. Engagement Events
export interface EngagementEvent extends BaseCustomEvent {
  type: "time_on_page" | "idle" | "active_again" | "copy_paste" | "download";
  data: {
    duration?: number;
    fileName?: string;
    copiedText?: string;
    idleTime?: number;
    pageVisibleTime?: number;
  };
}

// 6. Error & Friction Events
export interface ErrorEvent extends BaseCustomEvent {
  type:
    | "js_error"
    | "network_error"
    | "rage_click"
    | "dead_click"
    | "slow_page";
  data: {
    message?: string;
    stack?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    url?: string;
    status?: number;
    clickCount?: number;
    loadTime?: number;
    element?: {
      tag: string;
      path: string;
      text?: string;
    };
  };
}

// 7. Business Events
export interface BusinessEvent extends BaseCustomEvent {
  type:
    | "signup_started"
    | "signup_completed"
    | "checkout_started"
    | "checkout_completed"
    | "add_to_cart"
    | "remove_from_cart"
    | "feature_used"
    | "conversion";
  data: {
    featureName?: string;
    productId?: string;
    price?: number;
    currency?: string;
    step?: string;
    category?: string;
    value?: any;
  };
}

// 8. Session Events
export interface SessionEvent extends BaseCustomEvent {
  type:
    | "session_start"
    | "session_end"
    | "user_login"
    | "user_logout"
    | "user_property";
  data: {
    duration?: number;
    propertyName?: string;
    propertyValue?: string;
    loginMethod?: string;
    userRole?: string;
    abTestGroup?: string;
  };
}

// Union type for all custom events
export type CustomEvent =
  | NavigationEvent
  | InteractionEvent
  | FormEvent
  | MediaEvent
  | EngagementEvent
  | ErrorEvent
  | BusinessEvent
  | SessionEvent;

export interface CustomEventTrackerConfig {
  sessionId: string;
  userId: string;
  debug?: boolean;
  enableRageClickDetection?: boolean;
  rageClickThreshold?: number;
  rageClickTimeWindow?: number;
  enableScrollDepthTracking?: boolean;
  scrollDepthThresholds?: number[];
  enableIdleDetection?: boolean;
  idleTimeout?: number;
  enableFormAbandonment?: boolean;
  formAbandonmentTimeout?: number;
}

/**
 * CustomEventTracker class handles semantic user interaction tracking
 * layered on top of rrweb's raw DOM event recording
 */
export class CustomEventTracker {
  private config: Required<CustomEventTrackerConfig>;
  private listeners: (() => void)[] = [];
  private clickHistory: Array<{ timestamp: number; element: Element }> = [];
  private idleTimer: number | null = null;
  private isIdle = false;
  private lastActivityTime = Date.now();
  private pageStartTime = Date.now();
  private formInteractions = new Map<
    string,
    { startTime: number; fields: Set<string> }
  >();
  private scrollDepthReached = new Set<number>();

  constructor(config: CustomEventTrackerConfig) {
    this.config = {
      debug: false,
      enableRageClickDetection: true,
      rageClickThreshold: 3,
      rageClickTimeWindow: 1000,
      enableScrollDepthTracking: true,
      scrollDepthThresholds: [25, 50, 75, 100],
      enableIdleDetection: true,
      idleTimeout: 30000, // 30 seconds
      enableFormAbandonment: true,
      formAbandonmentTimeout: 60000, // 60 seconds
      ...config,
    };

    this.init();
  }

  /**
   * Initialize all event listeners and tracking mechanisms
   */
  private init(): void {
    this.setupNavigationTracking();
    this.setupInteractionTracking();
    this.setupFormTracking();
    this.setupMediaTracking();
    this.setupEngagementTracking();
    this.setupErrorTracking();
    this.setupIdleDetection();

    this.log("CustomEventTracker initialized");
  }

  /**
   * Setup navigation event tracking (page views, route changes, etc.)
   */
  private setupNavigationTracking(): void {
    // Initial page view
    this.trackCustomEvent("page_view", {
      from: document.referrer || undefined,
      to: window.location.href,
      title: document.title,
      referrer: document.referrer,
    });

    // Hash change tracking
    const hashChangeHandler = () => {
      this.trackCustomEvent("hash_change", {
        from: undefined,
        to: window.location.href,
        title: document.title,
      });
    };
    window.addEventListener("hashchange", hashChangeHandler);
    this.listeners.push(() =>
      window.removeEventListener("hashchange", hashChangeHandler)
    );

    // Back/forward button tracking
    const popstateHandler = () => {
      this.trackCustomEvent("back_forward", {
        from: undefined,
        to: window.location.href,
        title: document.title,
      });
    };
    window.addEventListener("popstate", popstateHandler);
    this.listeners.push(() =>
      window.removeEventListener("popstate", popstateHandler)
    );

    // SPA route change detection (for React Router, Next.js, etc.)
    this.interceptPushState();
  }

  /**
   * Intercept pushState and replaceState for SPA navigation tracking
   */
  private interceptPushState(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      const oldUrl = window.location.href;
      originalPushState.apply(history, args);
      setTimeout(() => {
        this.trackCustomEvent("route_change", {
          from: oldUrl,
          to: window.location.href,
          title: document.title,
        });
      }, 0);
    };

    history.replaceState = (...args) => {
      const oldUrl = window.location.href;
      originalReplaceState.apply(history, args);
      setTimeout(() => {
        this.trackCustomEvent("route_change", {
          from: oldUrl,
          to: window.location.href,
          title: document.title,
        });
      }, 0);
    };
  }

  /**
   * Setup interaction event tracking (clicks, hovers, scrolls, etc.)
   */
  private setupInteractionTracking(): void {
    // Click tracking with rage click detection
    const clickHandler = (event: MouseEvent) => {
      const element = event.target as Element;
      this.trackClick(element, event);

      if (this.config.enableRageClickDetection) {
        this.detectRageClick(element, event);
      }
    };
    document.addEventListener("click", clickHandler, true);
    this.listeners.push(() =>
      document.removeEventListener("click", clickHandler, true)
    );

    // Double click tracking
    const dblclickHandler = (event: MouseEvent) => {
      const element = event.target as Element;
      this.trackCustomEvent("dblclick", {
        element: this.getElementInfo(element),
        position: { x: event.clientX, y: event.clientY },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
    };
    document.addEventListener("dblclick", dblclickHandler);
    this.listeners.push(() =>
      document.removeEventListener("dblclick", dblclickHandler)
    );

    // Context menu tracking
    const contextmenuHandler = (event: MouseEvent) => {
      const element = event.target as Element;
      this.trackCustomEvent("context_menu", {
        element: this.getElementInfo(element),
        position: { x: event.clientX, y: event.clientY },
      });
    };
    document.addEventListener("contextmenu", contextmenuHandler);
    this.listeners.push(() =>
      document.removeEventListener("contextmenu", contextmenuHandler)
    );

    // Scroll depth tracking
    if (this.config.enableScrollDepthTracking) {
      this.setupScrollDepthTracking();
    }

    // Focus/blur tracking for form elements
    const focusHandler = (event: FocusEvent) => {
      const element = event.target as Element;
      if (this.isFormElement(element)) {
        this.trackCustomEvent("focus_blur", {
          element: this.getElementInfo(element),
        });
      }
    };
    document.addEventListener("focus", focusHandler, true);
    this.listeners.push(() =>
      document.removeEventListener("focus", focusHandler, true)
    );
  }

  /**
   * Track individual clicks and detect dead clicks
   */
  private trackClick(element: Element, event: MouseEvent): void {
    const elementInfo = this.getElementInfo(element);

    // Check if it's a dead click (non-interactive element)
    const isInteractive = this.isInteractiveElement(element);

    this.trackCustomEvent(isInteractive ? "click" : "dead_click", {
      element: elementInfo,
      position: { x: event.clientX, y: event.clientY },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
  }

  /**
   * Detect rage clicks (rapid repeated clicks on same element)
   */
  private detectRageClick(element: Element, event: MouseEvent): void {
    const now = Date.now();
    this.clickHistory.push({ timestamp: now, element });

    // Clean old clicks outside time window
    this.clickHistory = this.clickHistory.filter(
      (click) => now - click.timestamp <= this.config.rageClickTimeWindow
    );

    // Check for rage clicks on same element
    const sameElementClicks = this.clickHistory.filter(
      (click) => click.element === element
    );

    if (sameElementClicks.length >= this.config.rageClickThreshold) {
      this.trackCustomEvent("rage_click", {
        element: this.getElementInfo(element),
        clickCount: sameElementClicks.length,
        position: { x: event.clientX, y: event.clientY },
      });

      // Clear history to avoid duplicate rage click events
      this.clickHistory = this.clickHistory.filter(
        (click) => click.element !== element
      );
    }
  }

  /**
   * Setup scroll depth tracking
   */
  private setupScrollDepthTracking(): void {
    const scrollHandler = () => {
      const scrollPercent = Math.round(
        (window.scrollY /
          (document.documentElement.scrollHeight - window.innerHeight)) *
          100
      );

      // Track thresholds that haven't been reached yet
      for (const threshold of this.config.scrollDepthThresholds) {
        if (
          scrollPercent >= threshold &&
          !this.scrollDepthReached.has(threshold)
        ) {
          this.scrollDepthReached.add(threshold);
          this.trackCustomEvent("scroll", {
            element: {
              tag: "document",
              path: "document",
              text: `${threshold}% scroll depth`,
            },
            scrollDepth: threshold,
            viewport: { width: window.innerWidth, height: window.innerHeight },
          });
        }
      }
    };

    window.addEventListener("scroll", scrollHandler, { passive: true });
    this.listeners.push(() =>
      window.removeEventListener("scroll", scrollHandler)
    );
  }

  /**
   * Setup form tracking (inputs, submissions, errors, abandonment)
   */
  private setupFormTracking(): void {
    // Input change tracking
    const inputHandler = (event: Event) => {
      const element = event.target as HTMLInputElement;
      if (this.isFormElement(element)) {
        this.trackFormInteraction(element);

        // Don't track sensitive values
        const isSensitive = ["password", "credit-card", "ssn"].includes(
          element.type || element.getAttribute("data-type") || ""
        );

        this.trackCustomEvent("input_change", {
          formId: this.getFormId(element),
          fieldName: element.name || element.id,
          fieldType: element.type,
          value: isSensitive ? "[REDACTED]" : element.value?.substring(0, 100), // Limit length
          formPath: this.getDomPath(element.form || element),
        });
      }
    };
    document.addEventListener("input", inputHandler);
    this.listeners.push(() =>
      document.removeEventListener("input", inputHandler)
    );

    // Form submission tracking
    const submitHandler = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      const formInteraction = this.formInteractions.get(this.getFormId(form));

      this.trackCustomEvent("form_submit", {
        formId: this.getFormId(form),
        formPath: this.getDomPath(form),
        fieldCount: form.elements.length,
        completedFields: formInteraction?.fields.size || 0,
      });

      // Clean up form interaction tracking
      this.formInteractions.delete(this.getFormId(form));
    };
    document.addEventListener("submit", submitHandler);
    this.listeners.push(() =>
      document.removeEventListener("submit", submitHandler)
    );

    // Form error tracking (looking for common error patterns)
    this.setupFormErrorTracking();
  }

  /**
   * Track form interactions for abandonment detection
   */
  private trackFormInteraction(element: HTMLInputElement): void {
    const formId = this.getFormId(element);

    if (!this.formInteractions.has(formId)) {
      this.formInteractions.set(formId, {
        startTime: Date.now(),
        fields: new Set(),
      });

      // Setup abandonment detection
      if (this.config.enableFormAbandonment) {
        setTimeout(() => {
          const interaction = this.formInteractions.get(formId);
          if (interaction && interaction.fields.size > 0) {
            this.trackCustomEvent("form_abandon", {
              formId,
              formPath: this.getDomPath(element.form || element),
              fieldCount: element.form?.elements.length || 1,
              completedFields: interaction.fields.size,
            });
            this.formInteractions.delete(formId);
          }
        }, this.config.formAbandonmentTimeout);
      }
    }

    const interaction = this.formInteractions.get(formId)!;
    interaction.fields.add(element.name || element.id || element.type);
  }

  /**
   * Setup form error tracking
   */
  private setupFormErrorTracking(): void {
    // Watch for common error indicators
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            // Look for error messages
            if (this.isErrorElement(element)) {
              const nearestForm = element.closest("form");
              if (nearestForm) {
                this.trackCustomEvent("form_error", {
                  formId: this.getFormId(nearestForm),
                  errorMessage: element.textContent || "",
                  formPath: this.getDomPath(nearestForm),
                });
              }
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    this.listeners.push(() => observer.disconnect());
  }

  /**
   * Setup media tracking (video, audio events)
   */
  private setupMediaTracking(): void {
    const mediaEvents = ["play", "pause", "seeked", "ended"] as const;

    mediaEvents.forEach((eventType) => {
      const handler = (event: Event) => {
        const media = event.target as HTMLMediaElement;
        const eventMap: Record<string, string> = {
          play:
            media.tagName.toLowerCase() === "video"
              ? "video_play"
              : "audio_play",
          pause:
            media.tagName.toLowerCase() === "video"
              ? "video_pause"
              : "audio_pause",
          seeked:
            media.tagName.toLowerCase() === "video"
              ? "video_seek"
              : "video_seek",
          ended:
            media.tagName.toLowerCase() === "video" ? "video_end" : "video_end",
        };

        this.trackCustomEvent(eventMap[eventType] as any, {
          mediaId: media.id || media.src,
          duration: media.duration,
          currentTime: media.currentTime,
          volume: media.volume,
          playbackRate: media.playbackRate,
          src: media.src,
        });
      };

      document.addEventListener(eventType, handler, true);
      this.listeners.push(() =>
        document.removeEventListener(eventType, handler, true)
      );
    });
  }

  /**
   * Setup engagement tracking (time on page, copy/paste, downloads)
   */
  private setupEngagementTracking(): void {
    // Copy/paste detection
    const copyHandler = () => {
      const selection = window.getSelection()?.toString();
      this.trackCustomEvent("copy_paste", {
        copiedText: selection?.substring(0, 100) || "", // Limit length
      });
    };
    document.addEventListener("copy", copyHandler);
    this.listeners.push(() =>
      document.removeEventListener("copy", copyHandler)
    );

    // Download tracking
    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a") as HTMLAnchorElement;

      if (link && link.download) {
        this.trackCustomEvent("download", {
          fileName: link.download || link.href.split("/").pop() || "",
        });
      }
    };
    document.addEventListener("click", clickHandler);
    this.listeners.push(() =>
      document.removeEventListener("click", clickHandler)
    );
  }

  /**
   * Setup error tracking (JS errors, network errors, slow pages)
   */
  private setupErrorTracking(): void {
    // JavaScript errors
    const errorHandler = (event: Event) => {
      const errorEvent = event as unknown as ErrorEvent;
      this.trackCustomEvent("js_error", {
        message: (errorEvent as any).message,
        filename: (errorEvent as any).filename,
        lineno: (errorEvent as any).lineno,
        colno: (errorEvent as any).colno,
        stack: (errorEvent as any).error?.stack,
      });
    };
    window.addEventListener("error", errorHandler);
    this.listeners.push(() =>
      window.removeEventListener("error", errorHandler)
    );

    // Unhandled promise rejections
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      this.trackCustomEvent("js_error", {
        message: "Unhandled Promise Rejection",
        stack: event.reason?.stack || String(event.reason),
      });
    };
    window.addEventListener("unhandledrejection", rejectionHandler);
    this.listeners.push(() =>
      window.removeEventListener("unhandledrejection", rejectionHandler)
    );

    // Network error tracking (intercept fetch)
    this.interceptFetch();

    // Page load performance
    window.addEventListener("load", () => {
      setTimeout(() => {
        const loadTime =
          performance.timing.loadEventEnd - performance.timing.navigationStart;
        if (loadTime > 5000) {
          // Slow page threshold: 5 seconds
          this.trackCustomEvent("slow_page", {
            loadTime,
            url: window.location.href,
          });
        }
      }, 1000);
    });
  }

  /**
   * Intercept fetch to track network errors
   */
  private interceptFetch(): void {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);

        if (!response.ok) {
          this.trackCustomEvent("network_error", {
            url: args[0]?.toString() || "",
            status: response.status,
            message: response.statusText,
          });
        }

        return response;
      } catch (error) {
        this.trackCustomEvent("network_error", {
          url: args[0]?.toString() || "",
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
  }

  /**
   * Setup idle detection
   */
  private setupIdleDetection(): void {
    if (!this.config.enableIdleDetection) return;

    const resetIdleTimer = () => {
      this.lastActivityTime = Date.now();

      if (this.isIdle) {
        this.isIdle = false;
        this.trackCustomEvent("active_again", {
          idleTime: Date.now() - this.lastActivityTime,
        });
      }

      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
      }

      this.idleTimer = setTimeout(() => {
        this.isIdle = true;
        this.trackCustomEvent("idle", {
          duration: this.config.idleTimeout,
        });
      }, this.config.idleTimeout);
    };

    // Reset timer on user activity
    ["mousedown", "mousemove", "keypress", "scroll", "touchstart"].forEach(
      (event) => {
        document.addEventListener(event, resetIdleTimer, true);
      }
    );

    // Initial timer
    resetIdleTimer();
  }

  /**
   * Track a custom event using rrweb's addCustomEvent
   */
  private trackCustomEvent(type: string, data: any): void {
    const customEvent = {
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      timestamp: Date.now(),
      url: window.location.href,
      type,
      data,
    };

    // Use rrweb's addCustomEvent to add the event to the recording
    if (record && typeof record.addCustomEvent === "function") {
      record.addCustomEvent(type, customEvent);
    }

    this.log(`Custom event tracked: ${type}`, customEvent);
  }

  /**
   * Public method to track business events from application code
   */
  public trackBusinessEvent(
    type: BusinessEvent["type"],
    data: BusinessEvent["data"]
  ): void {
    this.trackCustomEvent(type, data);
  }

  /**
   * Public method to track user properties
   */
  public setUserProperty(propertyName: string, propertyValue: string): void {
    this.trackCustomEvent("user_property", {
      propertyName,
      propertyValue,
    });
  }

  /**
   * Track session end and page time
   */
  public trackSessionEnd(): void {
    const duration = Date.now() - this.pageStartTime;
    this.trackCustomEvent("time_on_page", {
      duration,
      pageVisibleTime: duration, // Could be enhanced with Page Visibility API
    });

    this.trackCustomEvent("session_end", {
      duration,
    });
  }

  /**
   * Helper method to get element information
   */
  private getElementInfo(element: Element) {
    return {
      tag: element.tagName.toLowerCase(),
      text: element.textContent?.trim().substring(0, 100) || undefined,
      id: element.id || undefined,
      className: element.className || undefined,
      path: this.getDomPath(element),
      component: this.getComponentName(element),
    };
  }

  /**
   * Get DOM path to element
   */
  private getDomPath(element: Element | null): string {
    if (!element) return "";

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      } else {
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (child) => child.tagName === current!.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }
        path.unshift(selector);
      }

      current = current.parentElement;
    }

    return path.join(" > ");
  }

  /**
   * Get React/Vue component name if available
   */
  private getComponentName(element: Element): string | undefined {
    // Look for React Fiber
    const fiberKey = Object.keys(element).find((key) =>
      key.startsWith("__reactInternalInstance")
    );
    if (fiberKey) {
      const fiber = (element as any)[fiberKey];
      return fiber?.type?.name || fiber?.elementType?.name;
    }

    // Look for Vue component
    if ((element as any).__vue__) {
      return (element as any).__vue__.$options.name;
    }

    // Look for data attributes that might indicate component
    return (
      element.getAttribute("data-component") ||
      element.getAttribute("data-testid") ||
      undefined
    );
  }

  /**
   * Check if element is a form element
   */
  private isFormElement(element: Element): boolean {
    return ["input", "textarea", "select"].includes(
      element.tagName.toLowerCase()
    );
  }

  /**
   * Check if element is interactive
   */
  private isInteractiveElement(element: Element): boolean {
    const interactiveTags = ["a", "button", "input", "select", "textarea"];
    const hasInteractiveRole = ["button", "link", "tab", "menuitem"].includes(
      element.getAttribute("role") || ""
    );
    const hasClickHandler =
      element.hasAttribute("onclick") ||
      element.hasAttribute("data-click") ||
      (element as HTMLElement).style?.cursor === "pointer";

    return (
      interactiveTags.includes(element.tagName.toLowerCase()) ||
      hasInteractiveRole ||
      hasClickHandler
    );
  }

  /**
   * Check if element looks like an error message
   */
  private isErrorElement(element: Element): boolean {
    const errorClasses = ["error", "invalid", "danger", "alert"];
    const className = element.className.toLowerCase();
    const textContent = element.textContent?.toLowerCase() || "";

    return (
      errorClasses.some((cls) => className.includes(cls)) ||
      element.getAttribute("role") === "alert" ||
      textContent.includes("error") ||
      textContent.includes("invalid") ||
      textContent.includes("required")
    );
  }

  /**
   * Get form ID (fallback to generating one if missing)
   */
  private getFormId(form: HTMLFormElement | Element | null): string {
    if (!form) return "unknown";

    return (
      form.id ||
      form.getAttribute("name") ||
      `form_${this.getDomPath(form).replace(/\s/g, "_")}`
    );
  }

  /**
   * Log debug messages
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log("[CustomEventTracker]", ...args);
    }
  }

  /**
   * Clean up all event listeners
   */
  public destroy(): void {
    this.listeners.forEach((cleanup) => cleanup());
    this.listeners = [];

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.trackSessionEnd();
    this.log("CustomEventTracker destroyed");
  }
}

export default CustomEventTracker;
