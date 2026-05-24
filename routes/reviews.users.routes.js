const express = require('express');
const { authenticate } = require('../middleware/auth');
const reviews = require('../controllers/reviews.controller');

const router = express.Router();

router.post('/:id/reviews', authenticate, reviews.createReviewLegacy);
router.get('/:id/reviews', reviews.getReviewsLegacy);

module.exports = router;
