const Joi = require('joi');

const password = Joi.string()
  .min(8)
  .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
  .required()
  .messages({ 'string.pattern.base': 'Password must contain uppercase, number, and special character' });

const totpToken = Joi.string().pattern(/^\d{6}$/).required()
  .messages({ 'string.pattern.base': 'Token must be a 6-digit code' });

module.exports = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password,
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^\+?[\d\s\-()\\.]{7,20}$/).optional(),
  }),
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: password,
  }),
  mfaVerifySetup: Joi.object({ token: totpToken }),
  mfaDisable: Joi.object({ password: Joi.string().required() }),
  mfaValidate: Joi.object({ tempToken: Joi.string().required(), token: totpToken }),
};
