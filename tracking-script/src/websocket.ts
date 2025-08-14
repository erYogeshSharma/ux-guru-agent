import { CONFIG } from "./config";
import { EventEnvelope } from "./types";

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private messageQueue: string[] = [];
  private tenantId: string | null;
  private visitorId: string;

  constructor(tenantId: string | null, visitorId: string) {
    this.tenantId = tenantId;
    this.visitorId = visitorId;
  }

  connect(): void {
    this.ws = new WebSocket(CONFIG.WS_URL);

    this.ws.onopen = () => {
      console.log("[Tracker] Connected");
      this.flushQueue();
    };

    this.ws.onclose = () => {
      console.warn("[Tracker] Disconnected, retrying...");
      setTimeout(() => this.connect(), CONFIG.RECONNECT_DELAY);
    };

    this.ws.onerror = (err) => {
      console.error("[Tracker] Error:", err);
      this.ws?.close();
    };
  }

  sendEvent<T>(type: string, payload: T): void {
    const envelope: EventEnvelope<T> = {
      type,
      tenantId: this.tenantId,
      visitorId: this.visitorId,
      payload,
      timestamp: Date.now(),
    };

    const asStr = (() => {
      try {
        return JSON.stringify(envelope);
      } catch (e) {
        console.error("[Tracker] Failed to serialize event", e);
        return null;
      }
    })();

    if (!asStr) return;

    this.trySendOrQueue(asStr);
  }

  private trySendOrQueue(message: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(message);
      } catch (e) {
        console.error("[Tracker] Send failed, queuing message", e);
        this.messageQueue.push(message);
      }
    } else {
      this.messageQueue.push(message);
    }
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (!msg) continue;

      try {
        this.ws.send(msg);
      } catch (e) {
        console.error(
          "[Tracker] Failed to flush queued message, will retry",
          e
        );
        this.messageQueue.unshift(msg);
        break;
      }
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
