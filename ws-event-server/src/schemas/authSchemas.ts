export const authSchemas = {
  signup: {
    tags: ["Authentication"],
    description: "Create a new user account",
    body: {
      type: "object",
      required: ["name", "email", "companyName", "password"],
      properties: {
        name: { type: "string" },
        email: { type: "string", format: "email" },
        companyName: { type: "string" },
        password: { type: "string", minLength: 6 },
      },
    },
    response: {
      201: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          token: { type: "string" },
          refreshToken: { type: "string" },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              role: { type: "string" },
              organization: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  companyName: { type: "string" },
                  email: { type: "string" },
                },
                additionalProperties: true,
              },
            },
            additionalProperties: true,
          },
        },
        additionalProperties: true,
      },
      400: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
        },
        additionalProperties: true,
      },
    },
  },

  signin: {
    tags: ["Authentication"],
    description: "Sign in to an existing account",
    body: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          token: { type: "string" },
          refreshToken: { type: "string" },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              role: { type: "string" },
              organization: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  companyName: { type: "string" },
                  email: { type: "string" },
                },
                additionalProperties: true,
              },
            },
            additionalProperties: true,
          },
        },
        additionalProperties: true,
      },
      401: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
        },
        additionalProperties: true,
      },
    },
  },

  forgotPassword: {
    tags: ["Authentication"],
    description: "Request password reset link",
    body: {
      type: "object",
      required: ["email"],
      properties: {
        email: { type: "string", format: "email" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          resetLink: { type: "string" },
        },
        additionalProperties: true,
      },
      400: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
        },
        additionalProperties: true,
      },
    },
  },

  resetPassword: {
    tags: ["Authentication"],
    description: "Reset password using reset token",
    body: {
      type: "object",
      required: ["token", "newPassword"],
      properties: {
        token: { type: "string" },
        newPassword: { type: "string", minLength: 6 },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
        },
        additionalProperties: true,
      },
      400: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
        },
        additionalProperties: true,
      },
    },
  },

  refresh: {
    tags: ["Authentication"],
    description: "Refresh access token using refresh token",
    body: {
      type: "object",
      required: ["refreshToken"],
      properties: {
        refreshToken: { type: "string" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          token: { type: "string" },
          refreshToken: { type: "string" },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              role: { type: "string" },
              organization: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  companyName: { type: "string" },
                  email: { type: "string" },
                },
                additionalProperties: true,
              },
            },
            additionalProperties: true,
          },
        },
        additionalProperties: true,
      },
      401: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
        },
        additionalProperties: true,
      },
    },
  },
};
