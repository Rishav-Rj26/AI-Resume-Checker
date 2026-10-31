const ApiError = require("../utils/ApiError");
const env = require("../config/env");

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "An unexpected server error occurred";
  let details = err.details || null;

  // Mongoose Validation Error
  if (err.name === "ValidationError") {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e) => e.message);
    message = errors[0] || "Validation failed";
    details = errors;
  }

  // Mongoose Duplicate Key Error (e.g. unique email)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    message = `An account with this ${field} already exists`;
  }

  // Mongoose Invalid ObjectId CastError
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid format for resource identifier: ${err.value}`;
  }

  // Multer Upload Errors
  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File exceeds maximum size limit of 5 MB";
    } else {
      message = err.message || "File upload error";
    }
  }

  // Log 500 internal errors for debugging
  if (statusCode >= 500) {
    console.error(`[Server Error 500] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    error: {
      message,
      details,
      ...(env.NODE_ENV === "development" && statusCode >= 500 ? { stack: err.stack } : {}),
    },
  });
};

module.exports = errorHandler;
