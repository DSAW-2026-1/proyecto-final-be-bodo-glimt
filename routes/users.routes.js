const express = require('express');
const { body } = require('express-validator');
const users = require('../controllers/users.controller');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody, validate } = require('../middleware/validate');

const router = express.Router();

router.put('/:id/become-seller', authenticate, users.becomeSeller);

router.get('/:id', authenticate, users.getUser);

router.put(
  '/:id',
  authenticate,
  sanitizeBody,
  [
    body('name').optional().trim().notEmpty().withMessage('Nombre inválido'),
    body('career').optional({ nullable: true }).isString(),
    body('photoUrl').optional({ nullable: true }).isString(),
  ],
  validate,
  users.updateUser
);

module.exports = router;
