const Joi = require("joi");
const ApiError = require("../utils/ApiError");

/**
 * Creates an Express middleware that validates req.body against a Joi schema.
 * @param {Joi.ObjectSchema} schema
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message).join("; ");
      return next(ApiError.badRequest(details));
    }

    req.body = value;
    next();
  };
}

// ─── Auth Schemas ──────────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 50 characters",
    "any.required": "Name is required",
  }),
  email: Joi.string().trim().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(8).max(128).required().messages({
    "string.min": "Password must be at least 8 characters",
    "string.max": "Password cannot exceed 128 characters",
    "any.required": "Password is required",
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 50 characters",
  }),
  email: Joi.string().trim().email().messages({
    "string.email": "Please provide a valid email address",
  }),
}).min(1).messages({
  "object.min": "At least one field (name or email) must be provided",
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required",
  }),
  newPassword: Joi.string().min(8).max(128).required().messages({
    "string.min": "New password must be at least 8 characters",
    "any.required": "New password is required",
  }),
});

// ─── Resume Schemas ────────────────────────────────────────────────────────────

const analyzeSchema = Joi.object({
  versionId: Joi.string().hex().length(24).optional(),
  targetRole: Joi.string().trim().max(100).optional().default(""),
});

const rewriteSchema = Joi.object({
  analysisId: Joi.string().hex().length(24).optional(),
  rewriteIds: Joi.array().items(Joi.string()).optional().default([]),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  analyzeSchema,
  rewriteSchema,
};

