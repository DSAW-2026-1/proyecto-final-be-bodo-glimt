const express = require('express');
const { authenticate } = require('../middleware/auth');
const reviews = require('../controllers/reviews.controller');

const router = express.Router();

router.post('/:id/reviews', authenticate, reviews.createReview);
router.get('/:id/reviews', authenticate, reviews.getReviews);

module.exports = router;
