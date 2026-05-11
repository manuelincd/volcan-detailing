const Joi = require('joi');
const { containsHtml } = require('../utils/sanitize');

const name = Joi.string().min(2).max(100);

// Rejects descriptions that contain any HTML tag — descriptions are plain text only.
const description = Joi.string().max(500).custom((val, helpers) => {
  if (containsHtml(val)) {
    return helpers.error('string.htmlForbidden');
  }
  return val;
}).messages({
  'string.htmlForbidden': '"description" must not contain HTML tags',
});
const durationMinutes = Joi.number().integer().min(1).max(1440); // max 24 h

// unknown(false) = reject any key that is not sedan/suv/van
const prices = Joi.object({
  sedan: Joi.number().precision(2).positive().required(),
  suv:   Joi.number().precision(2).positive().required(),
  van:   Joi.number().precision(2).positive().required(),
}).unknown(false).required();

module.exports = {
  // POST — isActive not accepted; new services are always active
  // stripUnknown removes unrecognised top-level keys before they reach the controller
  create: Joi.object({
    name:            name.required(),
    description:     description.optional(),
    durationMinutes: durationMinutes.required(),
    prices,
  }).options({ stripUnknown: true }),

  // PUT — full replacement; isActive allowed so admins can reactivate a service
  update: Joi.object({
    name:            name.required(),
    description:     description.optional().allow(''),
    durationMinutes: durationMinutes.required(),
    prices,
    isActive:        Joi.boolean().optional(),
  }).options({ stripUnknown: true }),
};
