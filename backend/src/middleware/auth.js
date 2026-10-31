const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { verifyToken } = require("../utils/jwt");
const env = require("../config/env");

const requireAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.[env.COOKIE_NAME];

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        token = parts[1];
      }
    }

    if (!token) {
      throw ApiError.unauthorized("Authentication required");
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw ApiError.unauthorized("Session expired, please sign in again");
      }
      throw ApiError.unauthorized("Invalid authentication token");
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      throw ApiError.unauthorized("Account not found");
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireAuth };

