const express = require('express');
const { authenticate } = require('../middleware/auth');
const orders = require('../controllers/orders.controller');

const router = express.Router();

router.get('/', authenticate, orders.listOrders);

module.exports = router;
