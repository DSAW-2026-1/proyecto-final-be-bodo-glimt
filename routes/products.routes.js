const express = require('express');
const { body } = require('express-validator');
const products = require('../controllers/products.controller');
const { authenticate, authorizeRole } = require('../middleware/auth');
const { sanitizeBody, validate } = require('../middleware/validate');

const router = express.Router();

router.get('/', products.listProducts);

router.post(
  '/',
  authenticate,
  authorizeRole('seller'),
  sanitizeBody,
  [
    body('title').trim().notEmpty().withMessage('Título requerido'),
    body('description').trim().notEmpty().withMessage('Descripción requerida'),
    body('price').isNumeric().withMessage('Precio inválido'),
    body('category').trim().notEmpty().withMessage('Categoría requerida'),
    body('state').isIn(['nuevo', 'usado']).withMessage('Estado inválido'),
    body('imageUrls').optional(),
  ],
  validate,
  products.createProduct
);

router.put(
  '/:id',
  authenticate,
  authorizeRole('seller'),
  sanitizeBody,
  [
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim().notEmpty(),
    body('price').optional().isNumeric(),
    body('category').optional().trim().notEmpty(),
    body('state').optional().isIn(['nuevo', 'usado']),
    body('imageUrls').optional(),
  ],
  validate,
  products.updateProduct
);

module.exports = router;
