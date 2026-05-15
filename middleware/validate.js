const { validationResult } = require('express-validator');
const xss = require('xss');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 400,
      errors: errors.array().map((e) => ({
        field: e.path || e.param,
        message: e.msg,
      })),
    });
  }
  next();
}

function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (key === 'password') continue;
      const v = req.body[key];
      if (typeof v === 'string') req.body[key] = xss(v);
    }
  }
  next();
}

module.exports = { validate, sanitizeBody };
