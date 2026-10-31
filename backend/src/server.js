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
const resumesRoutes = require("./routes/resumes");
const dashboardRoutes = require("./routes/dashboard");
const insightsRoutes = require("./routes/insights");
const versionsRoutes = require("./routes/versions");
const historyRoutes = require("./routes/history");

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
