const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { isAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuth);

// Get all notifications for current user
router.get('/', notificationController.getNotifications);

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark specific notification as read
router.patch('/:id/mark-read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Archive notification
router.patch('/:id/archive', notificationController.archiveNotification);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;