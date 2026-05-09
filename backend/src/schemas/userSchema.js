const Joi = require('joi');

const phone = Joi.string()
  .pattern(/^\+?[\d\s\-()\\.]{7,20}$/)
  .messages({ 'string.pattern.base': 'Phone must be a valid phone number' });

const password = Joi.string()
  .min(8)
  .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
  .required()
  .messages({ 'string.pattern.base': 'Password must contain uppercase, number, and special character' });

module.exports = {
  // POST /api/users — admin creates an employee account
  createEmployee: Joi.object({
    email:    Joi.string().email().required(),
    password,
    name:     Joi.string().min(2).max(100).required(),
    phone:    phone.optional(),
  }),

  // PUT /api/users/:id — email and role are intentionally excluded to prevent
  // login-identifier changes and privilege escalation via this endpoint
  update: Joi.object({
    name:     Joi.string().min(2).max(100).optional(),
    phone:    phone.optional().allow(''),
    isActive: Joi.boolean().optional(),
  }).min(1).messages({ 'object.min': 'At least one field must be provided' }),
};
