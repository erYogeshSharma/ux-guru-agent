export const healthSchema = {
  tags: ["Health"],
  description: "Health check endpoint",
  response: {
    200: {
      type: "object",
      properties: {
        status: { type: "string" },
        timestamp: { type: "string" },
        uptime: { type: "number" },
        database: { type: "object" },
        sessions: { type: "object" },
        websockets: { type: "object" },
      },
    },
  },
};
