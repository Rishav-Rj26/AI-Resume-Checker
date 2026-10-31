const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AI Resume Checker & Optimizer API",
      version: "1.0.0",
      description:
        "Production-grade RESTful API for AI Resume Checker. Features automated PDF text extraction, ATS compliance scoring, Google X-Y-Z bullet rewrites, version diffing, and cross-resume analytics.",
      contact: {
        name: "Antigravity Engineering",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "arr_token",
          description: "HTTP-only JWT cookie named 'arr_token'",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Authorization header with Bearer token",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string", example: "661234567890abcdef123456" },
            name: { type: "string", example: "Alex Johnson" },
            email: { type: "string", example: "alex@example.com" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Resume: {
          type: "object",
          properties: {
            _id: { type: "string", example: "661234567890abcdef123457" },
            title: { type: "string", example: "Senior Full Stack Engineer — Stripe" },
            versionCount: { type: "integer", example: 2 },
            bestScore: { type: "integer", example: 88 },
            currentVersionId: { type: "string", example: "661234567890abcdef123458" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Analysis: {
          type: "object",
          properties: {
            _id: { type: "string" },
            resumeId: { type: "string" },
            versionId: { type: "string" },
            atsScore: { type: "integer", minimum: 0, maximum: 100, example: 85 },
            summary: { type: "string" },
            scoreBreakdown: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string", example: "Keywords" },
                  value: { type: "integer", example: 88 },
                },
              },
            },
            issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  severity: { type: "string", enum: ["high", "medium", "low"] },
                  fix: { type: "string" },
                },
              },
            },
            strengths: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  note: { type: "string" },
                },
              },
            },
            keywordsPresent: { type: "array", items: { type: "string" } },
            keywordsMissing: { type: "array", items: { type: "string" } },
            bulletRewrites: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  section: { type: "string" },
                  original: { type: "string" },
                  rewritten: { type: "string" },
                  rationale: { type: "string" },
                },
              },
            },
          },
        },
        DiffResponse: {
          type: "object",
          properties: {
            stats: {
              type: "object",
              properties: {
                added: { type: "integer", example: 124 },
                removed: { type: "integer", example: 45 },
              },
            },
            parts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  value: { type: "string" },
                  added: { type: "boolean" },
                  removed: { type: "boolean" },
                },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                message: { type: "string", example: "Resource not found" },
                details: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

