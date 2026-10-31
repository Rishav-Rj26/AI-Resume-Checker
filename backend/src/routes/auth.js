const express = require("express");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { signToken, getCookieOptions } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const {
  validate,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require("../middleware/validate");
const env = require("../config/env");

const router = express.Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new candidate account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: "Alex Johnson" }
 *               email: { type: string, format: email, example: "alex@example.com" }
 *               password: { type: string, minLength: 8, example: "Password123!" }
 *     responses:
 *       201:
 *         description: Account created successfully with auth cookie set.
 *       400:
 *         description: Validation failed or email already registered.
 */
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const normalizedEmail = email.toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw ApiError.badRequest("An account with this email already exists");
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
    });

    const token = signToken({ id: user._id });
    res.cookie(env.COOKIE_NAME, token, getCookieOptions());

    res.status(201).json({ user: user.toJSON() });
  })
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and issue JWT cookie
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: "alex@example.com" }
 *               password: { type: string, example: "Password123!" }
 *     responses:
 *       200:
 *         description: Successfully authenticated.
 *       401:
 *         description: Invalid credentials.
 */
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const normalizedEmail = email.toLowerCase();
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
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Log out user and clear session cookie
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Session terminated successfully.
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
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Retrieve currently authenticated profile
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: User profile payload.
 *       401:
 *         description: Unauthenticated.
 */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user.toJSON() });
  })
);

/**
 * @openapi
 * /api/auth/profile:
 *   patch:
 *     summary: Update user profile display information
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, example: "Alex C. Johnson" }
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 */
router.patch(
  "/profile",
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body;

    req.user.name = name;
    await req.user.save();

    res.json({ user: req.user.toJSON() });
  })
);

/**
 * @openapi
 * /api/auth/password:
 *   patch:
 *     summary: Change user password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password updated successfully.
 *       400:
 *         description: Incorrect current password or invalid new password.
 */
router.patch(
  "/password",
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

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
