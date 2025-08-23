import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { parse } from "url";
import { WebSocketService } from "@/services/WebSocketService";

declare module "fastify" {
  interface FastifyInstance {
    wsService: WebSocketService;
  }
}

const websocketPluginFn: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const wsService = new WebSocketService(fastify.sessionService);

  fastify.decorate("wsService", wsService);

  fastify.register(async (fastify) => {
    fastify.get("/ws", { websocket: true }, (connection, req) => {
      const { query } = parse(req.url || "", true);
      const clientType = (query.type as "viewer" | "tracker") || "tracker";
      const clientIp =
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

      wsService.handleConnection(connection, clientType, clientIp as string);
    });
  });

  fastify.addHook("onClose", async () => {
    wsService.shutdown();
  });
};

export const websocketPlugin = fp(websocketPluginFn);
