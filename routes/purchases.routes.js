const express = require('express');
const { authenticate } = require('../middleware/auth');
const purchases = require('../controllers/purchases.controller');

const router = express.Router();

router.post('/', authenticate, purchases.createPurchase);
module.exports = router;
