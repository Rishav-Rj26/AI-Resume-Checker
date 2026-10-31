const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const env = require("./config/env");
const logger = require("./config/logger");
const swaggerSpec = require("./config/swagger");
const { connectDB } = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const ApiError = require("./utils/ApiError");

// Route imports
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const resumesRoutes = require("./routes/resumes");
const dashboardRoutes = require("./routes/dashboard");
const insightsRoutes = require("./routes/insights");
const versionsRoutes = require("./routes/versions");
const historyRoutes = require("./routes/history");

const app = express();

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI and local development tools
    crossOriginEmbedderPolicy: false,
  })
);

// Request Logging
const morganFormat = env.NODE_ENV === "production" ? "combined" : "dev";
app.use(
  morgan(morganFormat, {
    stream: logger.stream,
    skip: (req) => req.url === "/api/health" || req.url === "/health",
  })
);

// CORS Policy
const allowedOrigins = Array.isArray(env.CLIENT_ORIGIN)
  ? env.CLIENT_ORIGIN
  : String(env.CLIENT_ORIGIN || "").split(",").map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        env.NODE_ENV === "development"
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Interactive OpenAPI Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Base Health Check
app.use("/api/health", healthRoutes);
app.use("/health", healthRoutes);

// Core API Routes
app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/api/versions", versionsRoutes);
app.use("/api/history", historyRoutes);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start server function
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(env.PORT, () => {
      logger.info(`AI Resume Checker backend listening on http://localhost:${env.PORT}`);
      logger.info(`Interactive API Documentation: http://localhost:${env.PORT}/api-docs`);
    });
    return server;
  } catch (err) {
    logger.error(`Fatal startup failure: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
