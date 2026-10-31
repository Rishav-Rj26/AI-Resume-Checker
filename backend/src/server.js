const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const { connectDB } = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const ApiError = require("./utils/ApiError");

// Route imports
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");

const app = express();

// Security & Parsing Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (env.CLIENT_ORIGIN.indexOf(origin) !== -1 || env.CLIENT_ORIGIN.includes("*")) {
        return callback(null, true);
      }
      return callback(null, true); // Dev convenience
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Base Health Check
app.use("/api/health", healthRoutes);
app.use("/health", healthRoutes);

// Auth Routes
app.use("/api/auth", authRoutes);

// Placeholder routes for subsequent phases
app.use("/api/resumes", (req, res, next) => {
  try {
    const resumesRoute = require("./routes/resumes");
    return resumesRoute(req, res, next);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND" && err.message.includes("./routes/resumes")) {
      return next(ApiError.notFound("Resumes route will be activated in Phase 3/4"));
    }
    return next(err);
  }
});

app.use("/api/dashboard", (req, res, next) => {
  try {
    const dashboardRoute = require("./routes/dashboard");
    return dashboardRoute(req, res, next);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND" && err.message.includes("./routes/dashboard")) {
      return next(ApiError.notFound("Dashboard route will be activated in Phase 6"));
    }
    return next(err);
  }
});

app.use("/api/insights", (req, res, next) => {
  try {
    const insightsRoute = require("./routes/insights");
    return insightsRoute(req, res, next);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND" && err.message.includes("./routes/insights")) {
      return next(ApiError.notFound("Insights route will be activated in Phase 6"));
    }
    return next(err);
  }
});

app.use("/api/versions", (req, res, next) => {
  try {
    const versionsRoute = require("./routes/versions");
    return versionsRoute(req, res, next);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND" && err.message.includes("./routes/versions")) {
      return next(ApiError.notFound("Versions route will be activated in Phase 6"));
    }
    return next(err);
  }
});

app.use("/api/history", (req, res, next) => {
  try {
    const historyRoute = require("./routes/history");
    return historyRoute(req, res, next);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND" && err.message.includes("./routes/history")) {
      return next(ApiError.notFound("History route will be activated in Phase 6"));
    }
    return next(err);
  }
});

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
      console.log(`[Server] AI Resume Checker backend running on http://localhost:${env.PORT}`);
    });
    return server;
  } catch (err) {
    console.error("[Server] Fatal startup failure:", err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
