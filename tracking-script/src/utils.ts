import { CONFIG } from "./config";

export function detectTenantId(): string | null {
  // 1) Global override: window.__TENANT_ID__
  const winAny = window as any;
  if (typeof winAny.__TENANT_ID__ === "string" && winAny.__TENANT_ID__.trim()) {
    return winAny.__TENANT_ID__.trim();
  }

  // 2) Meta tag: <meta name="tenant-id" content="tenant_123" />
  const meta = document.querySelector(
    'meta[name="tenant-id"]'
  ) as HTMLMetaElement | null;
  if (meta && meta.content) return meta.content.trim();

  // 3) Query param: ?tenant=...
  try {
    const qp = new URL(window.location.href).searchParams.get("tenant");
    if (qp) return qp;
  } catch (e) {
    // ignore
  }

  // 4) Fallback: use origin hostname as tenant id (not ideal but deterministic)
  return window.location.hostname || null;
}

export function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(CONFIG.VISITOR_STORAGE_KEY);
    if (existing) return existing;
  } catch (e) {
    // localStorage might be unavailable; fall through to generate
  }

  const id =
    crypto && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  try {
    localStorage.setItem(CONFIG.VISITOR_STORAGE_KEY, id);
  } catch (e) {
    // ignore write failures
  }

  return id;
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait: number
) {
  let t: number | null = null;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  wait: number
) {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= wait) {
      lastCall = now;
      fn(...args);
    }
  };
}
