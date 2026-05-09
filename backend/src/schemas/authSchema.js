const Joi = require('joi');

const password = Joi.string()
  .min(8)
  .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
  .required()
  .messages({ 'string.pattern.base': 'Password must contain uppercase, number, and special character' });

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
};
