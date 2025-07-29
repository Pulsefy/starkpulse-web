const Joi = require("joi");

const userRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  walletAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  role: Joi.string().valid("user", "admin", "institutional").default("user"),
});

const userLoginSchema = Joi.object({
  email: Joi.string().email().when("method", {
    is: "email",
    then: Joi.required(),
  }),
  password: Joi.string().when("method", {
    is: "email",
    then: Joi.required(),
  }),
  walletAddress: Joi.string().when("method", {
    is: "wallet",
    then: Joi.required(),
  }),
  signature: Joi.string().when("method", {
    is: "wallet",
    then: Joi.required(),
  }),
  method: Joi.string().valid("email", "wallet", "sso").required(),
});

module.exports = { userRegisterSchema, userLoginSchema };
