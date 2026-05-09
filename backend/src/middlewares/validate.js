const { fail } = require('../utils/response');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) return fail(res, error.details.map((d) => d.message).join(', '), 'VALIDATION_ERROR');
  req.body = value;
  next();
};

module.exports = validate;
