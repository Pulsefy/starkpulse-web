const Joi = require("joi")

// ==========================
// Validation schemas
// ==========================
const schemas = {
  register: Joi.object({
    firstName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s]+$/)
      .required()
      .messages({
        "string.pattern.base": "First name can only contain letters and spaces",
        "string.min": "First name must be at least 2 characters long",
        "string.max": "First name cannot exceed 50 characters",
      }),
    lastName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s]+$/)
      .required()
      .messages({
        "string.pattern.base": "Last name can only contain letters and spaces",
        "string.min": "Last name must be at least 2 characters long",
        "string.max": "Last name cannot exceed 50 characters",
      }),
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required()
      .messages({
        "string.email": "Please enter a valid email address",
      }),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        "string.pattern.base":
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        "string.min": "Password must be at least 8 characters long",
        "string.max": "Password cannot exceed 128 characters",
      }),
    confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
      "any.only": "Passwords do not match",
    }),
    agreeToTerms: Joi.boolean().valid(true).required(),
    agreeToPrivacy: Joi.boolean().valid(true).required(),
  }),

  login: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    firstName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s]+$/),
    lastName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s]+$/),
    preferences: Joi.object({
      newsletter: Joi.boolean(),
      notifications: Joi.boolean(),
      theme: Joi.string().valid("light", "dark"),
      language: Joi.string().valid("en", "es", "fr", "de"),
    }),
    privacy: Joi.object({
      profileVisible: Joi.boolean(),
      dataProcessing: Joi.boolean(),
      marketing: Joi.boolean(),
    }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required(),
    confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required(),
    confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required(),
  }),
}

// ==========================
// Validation middleware factory
// ==========================
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schemas[schema].validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    })

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }))

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      })
    }

    req.validatedData = value
    next()
  }
}

module.exports = { validate }
