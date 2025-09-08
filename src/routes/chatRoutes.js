const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { isAuth, isAdmin } = require('../middleware/auth');

// Entry
router.get('/chat', isAuth, chatController.getChatEntry);

// Admin inbox and chat with a student
router.get('/chat/admin', isAuth, isAdmin, chatController.getAdminInbox);
router.get('/chat/admin/:studentId', isAuth, isAdmin, chatController.getAdminChatWithStudent);

// Student chat with assigned admin
router.get('/chat/with-admin', isAuth, chatController.getStudentChat);

// API endpoints
router.get('/api/chat/conversations', isAuth, isAdmin, chatController.listConversations);
router.get('/api/chat/messages', isAuth, chatController.listMessages);
router.post('/api/chat/messages', isAuth, chatController.sendMessage);
router.post('/api/chat/mark-read', isAuth, chatController.markRead);

module.exports = router;

