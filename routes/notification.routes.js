const router = require('express').Router();
const notificationController = require('../controllers/notification.controller');
const { checkUserAuth } = require('../middlewares/auth.middleware');

// Get all notifications for the current user
router.get('/', checkUserAuth, notificationController.getUserNotifications);

module.exports = router;