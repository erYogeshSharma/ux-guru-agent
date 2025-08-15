import { WebSocket, RawData } from "ws";
import { ConnectedClient } from "../types";
import WebSocketService from "../services/WebSocketService";

export interface MessageHandler {
  handleMessage(ws: WebSocket, data: RawData, client: ConnectedClient): void;
}

export class DefaultMessageHandler implements MessageHandler {
  constructor(private wsService: WebSocketService) {}

  handleMessage(ws: WebSocket, data: RawData, client: ConnectedClient): void {
    try {
      const payload = this.normalizeData(data);
      const message = JSON.parse(payload);

      // Update heartbeat
      client.lastHeartbeat = Date.now();

      // Delegate to WebSocketService
      (this.wsService as any).handleMessage(ws, data);
    } catch (error) {
      console.error("❌ Error parsing message:", error);
      this.sendError(ws, "Invalid message format");
    }
  }

  private normalizeData(data: RawData): string {
    if (typeof data === "string") {
      return data;
    } else if (data instanceof Buffer) {
      return data.toString();
    } else if (Array.isArray(data)) {
      return Buffer.concat(data).toString();
    } else if (data instanceof ArrayBuffer) {
      return Buffer.from(data).toString();
    } else {
      return String(data);
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "error",
          data: { message },
        })
      );
    }
  }
}

export default DefaultMessageHandler;
