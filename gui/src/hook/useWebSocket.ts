import { useEffect, useRef, useState, useCallback } from "react";

export interface EventMessage<T = unknown> {
  type: string;
  payload: T;
  // optional metadata that may be present when messages come as envelopes
  tenantId?: string | null;
  visitorId?: string;
  timestamp?: number;
}

interface Envelope<T = unknown> {
  type: string;
  tenantId?: string | null;
  visitorId?: string;
  payload: T;
  timestamp: number;
}

const VISITOR_STORAGE_KEY = "ux_guru_visitor_id";

function detectTenantId(): string | null {
  const win = window as Window & { __TENANT_ID__?: string };
  if (typeof win.__TENANT_ID__ === "string" && win.__TENANT_ID__.trim()) {
    return win.__TENANT_ID__.trim();
  }

  const meta = document.querySelector(
    'meta[name="tenant-id"]'
  ) as HTMLMetaElement | null;
  if (meta && meta.content) return meta.content.trim();

  try {
    const qp = new URL(window.location.href).searchParams.get("tenant");
    if (qp) return qp;
  } catch {
    // ignore
  }

  return window.location.hostname || null;
}

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // ignore
  }

  const cryptoObj = (
    globalThis as unknown as { crypto?: Crypto & { randomUUID?: () => string } }
  ).crypto;
  const id =
    cryptoObj && typeof cryptoObj.randomUUID === "function"
      ? cryptoObj.randomUUID()
      : `visitor-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  try {
    localStorage.setItem(VISITOR_STORAGE_KEY, id);
  } catch {
    // ignore
  }

  return id;
}

export function useEventSocket(url: string) {
  const TENANT_ID = detectTenantId();
  const VISITOR_ID = getOrCreateVisitorId();

  const wsRef = useRef<WebSocket | null>(null);
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [lastGUIEvent, setLastGUIEvent] = useState<EventMessage | null>(null);
  const guiEvents = ["windowDimension", "cursorMove", "click"];
  // stable sendEvent so useEffect can depend on it
  const sendEvent = useCallback(
    <T>(type: string, payload: T) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const envelope: Envelope<T> = {
          type,
          tenantId: TENANT_ID,
          visitorId: VISITOR_ID,
          payload,
          timestamp: Date.now(),
        };
        try {
          wsRef.current.send(JSON.stringify(envelope));
        } catch (err) {
          console.error("Failed to send event", err);
        }
      }
    },
    [TENANT_ID, VISITOR_ID]
  );

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsOpen(true);
      // send a small handshake so servers can route by tenant/visitor
      sendEvent("handshake", { url: window.location.href });
    };
    ws.onclose = () => setIsOpen(false);

    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as unknown;

        if (typeof parsed === "object" && parsed !== null) {
          const obj = parsed as Record<string, unknown>;

          if (typeof obj.type === "string" && "payload" in obj) {
            const event: EventMessage = {
              type: obj.type,
              payload: obj.payload as unknown,
              tenantId: typeof obj.tenantId === "string" ? obj.tenantId : null,
              visitorId:
                typeof obj.visitorId === "string" ? obj.visitorId : undefined,
              timestamp:
                typeof obj.timestamp === "number" ? obj.timestamp : Date.now(),
            };
            setEvents((prev) => [...prev, event]);

            if (guiEvents.includes(obj.type)) {
              setLastGUIEvent(event);
            }
            return;
          }
        }

        // fallback: try legacy minimal shape
        if (typeof parsed === "object" && parsed !== null) {
          const obj = parsed as Record<string, unknown>;
          if (typeof obj.type === "string") {
            const event: EventMessage = {
              type: obj.type,
              payload: obj.payload as unknown,
            };
            setEvents((prev) => [...prev, event]);
          }
        }
      } catch (err) {
        console.error("Invalid message", msg.data, err);
      }
    };

    return () => ws.close();
  }, [url, sendEvent]);

  // sendEvent is declared above with useCallback

  return { isOpen, events, sendEvent, lastGUIEvent };
}
