const express = require('express');
const { body } = require('express-validator');
const auth = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody, validate } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/register',
  sanitizeBody,
  [
    body('email').isEmail().withMessage('Correo inválido'),
    body('password').isLength({ min: 8 }).withMessage('Mínimo 8 caracteres'),
    body('name').trim().notEmpty().withMessage('Nombre requerido'),
    body('career').optional({ nullable: true }).isString(),
  ],
  validate,
  auth.register
);

router.post(
  '/login',
  sanitizeBody,
  [
    body('email').notEmpty().withMessage('Correo requerido'),
    body('password').notEmpty().withMessage('Contraseña requerida'),
  ],
  validate,
  auth.login
);

router.post('/logout', authenticate, auth.logout);

module.exports = router;
