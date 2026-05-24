const express = require('express');
const { body, query } = require('express-validator');
const reviews = require('../controllers/reviews.controller');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody, validate } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/',
  authenticate,
  sanitizeBody,
  [
    body('sellerId').trim().notEmpty().withMessage('sellerId requerido'),
    body('orderId').trim().notEmpty().withMessage('orderId requerido'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating 1-5'),
    body('comment').optional({ nullable: true }).isString(),
  ],
  validate,
  reviews.createReview
);

router.get(
  '/',
  [query('sellerId').trim().notEmpty().withMessage('sellerId requerido')],
  validate,
  reviews.listReviewsBySeller
);

module.exports = router;
