const express = require("express");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { signToken, getCookieOptions } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const env = require("../config/env");

const router = express.Router();

/**
 * POST /api/auth/register
 */
router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      throw ApiError.badRequest("Please provide a valid name (at least 2 characters)");
    }
    if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      throw ApiError.badRequest("Please provide a valid email address");
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      throw ApiError.badRequest("Password must be at least 8 characters long");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw ApiError.badRequest("An account with this email already exists");
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
    });

    const token = signToken({ id: user._id });
    res.cookie(env.COOKIE_NAME, token, getCookieOptions());

    res.status(201).json({ user: user.toJSON() });
  })
);

/**
 * POST /api/auth/login
 */
router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      throw ApiError.badRequest("Please provide both email and password");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const token = signToken({ id: user._id });
    res.cookie(env.COOKIE_NAME, token, getCookieOptions());

    res.json({ user: user.toJSON() });
  })
);

/**
 * POST /api/auth/logout
 */
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    res.clearCookie(env.COOKIE_NAME, {
      ...getCookieOptions(),
      maxAge: 0,
    });
    res.json({ ok: true });
  })
);

/**
 * GET /api/auth/me
 */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user.toJSON() });
  })
);

/**
 * PATCH /api/auth/profile
 */
router.patch(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name } = req.body || {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      throw ApiError.badRequest("Display name must be at least 2 characters");
    }

    req.user.name = name.trim();
    await req.user.save();

    res.json({ user: req.user.toJSON() });
  })
);

/**
 * PATCH /api/auth/password
 */
router.patch(
  "/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      throw ApiError.badRequest("Both current password and new password are required");
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      throw ApiError.badRequest("New password must be at least 8 characters long");
    }

    const userWithPassword = await User.findById(req.user._id).select("+password");
    const isMatch = await userWithPassword.comparePassword(currentPassword);

    if (!isMatch) {
      throw ApiError.badRequest("Current password is incorrect");
    }

    userWithPassword.password = newPassword;
    await userWithPassword.save();

    res.json({ ok: true });
  })
);

module.exports = router;

