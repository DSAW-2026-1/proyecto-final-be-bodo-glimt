const express = require('express');
const { authenticate } = require('../middleware/auth');
const conv = require('../controllers/conversations.controller');

const router = express.Router();

router.post('/', authenticate, conv.createConversation);
router.get('/', authenticate, conv.listConversations);
router.get('/:id/messages', authenticate, conv.listMessages);
router.post('/:id/messages', authenticate, conv.sendMessage);

module.exports = router;
