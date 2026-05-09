const Joi = require('joi');

const name            = Joi.string().min(2).max(100);
const description     = Joi.string().max(500);
const durationMinutes = Joi.number().integer().min(1).max(1440); // max 24 h
const price           = Joi.number().precision(2).positive();

module.exports = {
  // POST — isActive not accepted; new services are always active
  create: Joi.object({
    name:            name.required(),
    description:     description.optional(),
    durationMinutes: durationMinutes.required(),
    price:           price.required(),
  }),

  // PUT — full replacement; isActive allowed so admins can reactivate a service
  update: Joi.object({
    name:            name.required(),
    description:     description.optional().allow(''),
    durationMinutes: durationMinutes.required(),
    price:           price.required(),
    isActive:        Joi.boolean().optional(),
  }),
};
