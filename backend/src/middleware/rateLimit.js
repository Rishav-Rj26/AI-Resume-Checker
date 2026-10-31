const rateLimit = require("express-rate-limit");
const ApiError = require("../utils/ApiError");

const createLimiter = ({ windowMs = 15 * 60 * 1000, max = 100, message = "Too many requests, please try again later" }) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(ApiError.tooManyRequests(message));
    },
  });
};

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "Too many authentication attempts, please try again in a few minutes",
});

const aiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "AI analysis rate limit reached, please try again in a moment",
});

const uploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Upload rate limit reached, please wait before uploading more files",
});

module.exports = {
  authLimiter,
  aiLimiter,
  uploadLimiter,
};

