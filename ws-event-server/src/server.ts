import { createServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";

interface EventMessage<T = any> {
  type: string;
  payload: T;
  tenantId?: string | null;
  visitorId?: string;
  timestamp?: number;
  // optional routing target (can be top-level or inside payload)
  targetVisitorId?: string;
  apiKey?: string;
}

const PORT = 8080;
const server = createServer();
const wss = new WebSocketServer({ server });

// optional simple token-based auth: set ALLOWED_TOKENS="key1,key2" in env
const ALLOWED_TOKENS = process.env.ALLOWED_TOKENS
  ? new Set(process.env.ALLOWED_TOKENS.split(",").map((s) => s.trim()))
  : null;

// maps for active clients
const visitorToSocket = new Map<string, WebSocket>();
const socketMeta = new Map<
  WebSocket,
  { visitorId?: string; tenantId?: string | null }
>();

function safeSend(ws: WebSocket, event: EventMessage) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(event));
  } catch (err) {
    console.error("Failed to send to client", err);
  }
}

/**
 * Broadcast an event to all connected clients, optionally scoped to tenant,
 * and optionally excluding a specific socket.
 */
function broadcast<T = any>(
  event: EventMessage<T>,
  { tenantId, exclude }: { tenantId?: string | null; exclude?: WebSocket } = {}
) {
  const message = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN || client === exclude) continue;
    const meta = socketMeta.get(client as WebSocket);
    if (tenantId && meta?.tenantId !== tenantId) continue;
    try {
      (client as WebSocket).send(message);
    } catch (err) {
      console.error("Broadcast send failed", err);
    }
  }
}

/**
 * Send to specific visitor if online
 */
function sendToVisitor(visitorId: string, event: EventMessage) {
  const ws = visitorToSocket.get(visitorId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  safeSend(ws, event);
  return true;
}

/**
 * Validate optional token from the connection request. If ALLOWED_TOKENS is not set,
 * validation is skipped (server runs in permissive mode).
 */
function validateTokenFromReq(req: IncomingMessage | undefined): boolean {
  if (!ALLOWED_TOKENS) return true; // permissive
  try {
    const host = req?.headers.host ?? "localhost";
    const url = new URL(req?.url ?? "/", `http://${host}`);
    const token =
      url.searchParams.get("token") ||
      (req?.headers["sec-websocket-protocol"] as string | undefined);
    if (!token) return false;
    return ALLOWED_TOKENS.has(token);
  } catch {
    return false;
  }
}

wss.on("connection", (ws, req) => {
  console.log("Client connected");

  // basic token validation at connection time
  if (!validateTokenFromReq(req)) {
    console.warn("Unauthorized connection attempt - closing");
    // 4001 is an arbitrary app-level close code for unauthorized
    try {
      ws.close(4001, "Unauthorized");
    } catch {
      ws.terminate();
    }
    return;
  }

  // send a welcome event
  safeSend(ws, { type: "system", payload: "Welcome to WS server" });

  ws.on("message", (raw) => {
    try {
      const obj = JSON.parse(raw.toString()) as EventMessage;

      // If this is a handshake, register mappings (visitorId -> ws) and store tenant
      if (obj.type === "handshake" && obj.visitorId) {
        const visitor = obj.visitorId;
        // if another socket was registered for this visitor, close it
        const prev = visitorToSocket.get(visitor);
        if (prev && prev !== ws) {
          try {
            prev.close(4000, "Replaced by new connection");
          } catch {
            prev.terminate();
          }
        }

        visitorToSocket.set(visitor, ws);
        socketMeta.set(ws, {
          visitorId: visitor,
          tenantId: obj.tenantId ?? null,
        });

        // ack handshake
        safeSend(ws, {
          type: "handshake:ack",
          payload: { ok: true },
          tenantId: obj.tenantId ?? null,
          visitorId: visitor,
          timestamp: Date.now(),
        });

        // optionally notify other clients in same tenant about presence
        broadcast(
          {
            type: "presence:update",
            payload: { visitorId: visitor, status: "online" },
            tenantId: obj.tenantId ?? null,
            timestamp: Date.now(),
          },
          { tenantId: obj.tenantId ?? null, exclude: ws }
        );

        return;
      }

      // store meta if not present and message carries visitorId/tenantId (defensive)
      if (!socketMeta.has(ws) && obj.visitorId) {
        socketMeta.set(ws, {
          visitorId: obj.visitorId,
          tenantId: obj.tenantId ?? null,
        });
        visitorToSocket.set(obj.visitorId, ws);
      }

      console.log(
        `[${obj.visitorId}]:::[ ${obj.type}] => ${
          obj.type !== "snapshot" ? JSON.stringify(obj.payload) : ""
        }`
      );
      // TenantID of all connected sockets
      // console.log(visitorToSocket);
      // If event includes a direct targetVisitorId (top-level) -> forward to that visitor

      const trackingTypes = [
        "click",
        "cursorMove",
        "windowDimension",
        "snapshot",
      ];

      if (trackingTypes.includes(obj.type)) {
        // get the gui id from socketMeta
        const isGUITenantAvailable = Array.from(socketMeta.values())
          .map((meta) => meta.tenantId)
          .includes("localhost");

        if (!isGUITenantAvailable) {
          console.warn("No GUI tenant available");
          return;
        }
        const guiId = Array.from(socketMeta.values()).find(
          (meta) => meta.tenantId === "localhost"
        )?.visitorId;

        if (!guiId) return;
        const targetSent = sendToVisitor(guiId, obj);
        if (!targetSent) {
          // reply to sender that target is offline
          safeSend(ws, {
            type: "error",
            payload: { message: "target-offline", target: obj.targetVisitorId },
            tenantId: obj.tenantId ?? null,
            visitorId: obj.visitorId,
            timestamp: Date.now(),
          });
        }
        return;
      }

      // Check payload for a targetVisitorId as well (legacy clients)
      const payloadAsAny = obj.payload as any;
      if (payloadAsAny && typeof payloadAsAny.targetVisitorId === "string") {
        const target = payloadAsAny.targetVisitorId as string;
        const cloned = { ...obj, payload: { ...payloadAsAny } };
        delete (cloned.payload as any).targetVisitorId; // remove routing metadata from forwarded payload
        const targetSent = sendToVisitor(target, cloned);
        if (!targetSent) {
          safeSend(ws, {
            type: "error",
            payload: { message: "target-offline", target },
            tenantId: obj.tenantId ?? null,
            visitorId: obj.visitorId,
            timestamp: Date.now(),
          });
        }
        return;
      }

      // default: broadcast to other clients in same tenant
      broadcast(obj, { tenantId: obj.tenantId ?? null, exclude: ws });
    } catch (err) {
      console.error("Invalid message", err);
      safeSend(ws, { type: "error", payload: "Invalid JSON" });
    }
  });

  ws.on("close", () => {
    const meta = socketMeta.get(ws);
    if (meta?.visitorId) {
      visitorToSocket.delete(meta.visitorId);
      // notify tenant about presence change
      broadcast(
        {
          type: "presence:update",
          payload: { visitorId: meta.visitorId, status: "offline" },
          tenantId: meta.tenantId ?? null,
          timestamp: Date.now(),
        },
        { tenantId: meta.tenantId ?? null, exclude: ws }
      );
    }
    socketMeta.delete(ws);
    console.log("Client disconnected");
  });

  ws.on("error", (err) => {
    console.error("Socket error", err);
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server running at ws://localhost:${PORT}`);
});
