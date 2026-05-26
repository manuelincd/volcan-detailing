const Joi = require('joi');

// Accepts today or any future date. Joi.date().greater('now') rejects today
// because it parses bare dates as UTC midnight, which is already in the past.
const futureOrToday = Joi.date()
  .custom((value, helpers) => {
    const todayUtcMidnight = new Date();
    todayUtcMidnight.setUTCHours(0, 0, 0, 0);
    if (value < todayUtcMidnight) return helpers.error('any.invalid');
    return value;
  })
  .messages({ 'any.invalid': 'Date must be today or in the future' });

module.exports = {
  create: Joi.object({
    serviceId:   Joi.number().integer().positive().required(),
    vehicleType: Joi.string().max(50).required(),
    date:        futureOrToday.required(),
    timeSlot:    Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required()
                   .messages({ 'string.pattern.base': 'timeSlot must be HH:MM (e.g. 09:00)' }),
    notes:       Joi.string().max(500).optional(),
  }),

  updateStatus: Joi.object({
    status: Joi.string()
      .valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')
      .required(),
  }),

  assign: Joi.object({
    employeeId: Joi.number().integer().positive().required(),
  }),
};
