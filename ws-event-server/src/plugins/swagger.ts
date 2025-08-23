import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { logger } from "@/utils/logger";

export const swaggerPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  try {
    const { default: swagger } = await import("@fastify/swagger");
    const { default: swaggerUi } = await import("@fastify/swagger-ui");

    await fastify.register(swagger, {
      openapi: {
        openapi: "3.0.0",
        info: {
          title: "Session Replay API",
          description:
            "WebSocket Event Server with Session Replay capabilities",
          version: "1.0.0",
        },
        servers: [
          {
            url: `http://localhost:${process.env.PORT || 3000}`,
            description: "Development server",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
    });

    await fastify.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "full",
        deepLinking: false,
      },
      uiHooks: {
        onRequest: function (request, reply, next) {
          next();
        },
        preHandler: function (request, reply, next) {
          next();
        },
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject, request, reply) => {
        return swaggerObject;
      },
      transformSpecificationClone: true,
    });
  } catch (err) {
    logger.warn("Swagger plugins not registered:", err);
  }
};
