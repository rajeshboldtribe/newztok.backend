const router = require('express').Router();
const notificationController = require('../controllers/notification.controller');
const notificationService = require('../services/notification.service');
const { checkUserAuth, checkRole } = require('../middlewares/auth.middleware');
const User = require('../models/user.model');
const sequelize = require('../config/db');
const { Op } = require('sequelize');

// Get all notifications for the current user
router.get('/', checkUserAuth, notificationController.getUserNotifications);

// Test endpoint to send a notification to a topic
router.post('/test-topic', checkUserAuth, checkRole(['admin']), async (req, res) => {
  try {
    const { topic, title, body } = req.body;
    
    if (!topic || !title || !body) {
      return res.error(400, false, "Topic, title, and body are required");
    }
    
    const result = await notificationService.sendToTopic(
      topic,
      title,
      body,
      { type: 'test_notification' }
    );
    
    return res.success(200, true, "Test notification sent to topic", result);
  } catch (error) {
    console.error('Test topic notification error:', error);
    return res.error(500, false, "Error sending test notification", error.message);
  }
});

// Test endpoint to send a notification to a user
router.post('/test-user', checkUserAuth, checkRole(['admin']), async (req, res) => {
  try {
    const { userId, title, body } = req.body;
    
    if (!userId || !title || !body) {
      return res.error(400, false, "UserId, title, and body are required");
    }
    
    const result = await notificationService.sendToUsers(
      [userId],
      title,
      body,
      { type: 'test_notification' }
    );
    
    return res.success(200, true, "Test notification sent to user", result);
  } catch (error) {
    console.error('Test user notification error:', error);
    return res.error(500, false, "Error sending test notification", error.message);
  }
});

// Test endpoint to send a notification to all users with FCM tokens
router.post('/test-all-users', checkUserAuth, checkRole(['admin']), async (req, res) => {
  try {
    const { title, body } = req.body;
    
    if (!title || !body) {
      return res.error(400, false, "Title and body are required");
    }
    
    // Find all users with FCM tokens
    const allUsers = await User.findAll({
      where: {
        fcmToken: {
          [Op.not]: null  
        }
      },
      attributes: ['id', 'fcmToken']
    });
    
    if (allUsers.length === 0) {
      return res.success(200, true, "No users with FCM tokens found", { usersCount: 0 });
    }
    
    const userIds = allUsers.map(user => user.id);
    const result = await notificationService.sendToUsers(
      userIds,
      title,
      body,
      { type: 'test_notification' }
    );
    
    return res.success(200, true, `Test notification sent to ${userIds.length} users`, {
      usersCount: userIds.length,
      result
    });
  } catch (error) {
    console.error('Test all users notification error:', error);
    return res.error(500, false, "Error sending test notification to all users", error.message);
  }
});

module.exports = router;