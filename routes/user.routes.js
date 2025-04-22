const router = require('express').Router();
const userController = require('../controllers/user.controller');
const { checkUserAuth, checkRole } = require('../middlewares/auth.middleware');
const notificationService = require('../services/notification.service'); 
const User = require('../models/user.model'); 

// Editor routes
router.get('/assigned-journalists', checkUserAuth, checkRole('editor'), userController.getAssignedJournalists);
router.get('/editor-profile', checkUserAuth, checkRole('editor'), userController.getEditorProfile);

//journalist's own profile
router.get('/my-profile', checkUserAuth, userController.getMyProfile);

//admin profile
router.get('/admin-profile', checkUserAuth, checkRole('admin'), userController.getAdminProfile);
//for push notification
router.post('/update-fcm-token', checkUserAuth, userController.updateFcmToken);

// Test notification endpoint
router.post('/test-notification', checkUserAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.mwValue?.auth?.id;
    
    // Get the user to check if they have a token
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'fcmToken']
    });
    
    if (!user) {
      return res.error(404, false, "User not found");
    }
    
    if (!user.fcmToken) {
      return res.error(400, false, "User does not have an FCM token registered. Please update the token first.");
    }
    
    // Send a test notification to the current user
    const result = await notificationService.sendToUsers(
      [userId], 
      'Boltribe ', 
      'This is a test notification to verify FCM is working correctly',
      { type: 'boldTribe test_notification' }
    );
    
    if (result.summary.successful > 0) {
      return res.success(200, true, "Test notification sent successfully", { result });
    } else {
      // If the token was invalid and removed
      if (result.summary.invalidTokensRemoved > 0) {
        return res.error(400, false, "FCM token is invalid or expired. Please update your token.", { result });
      } else {
        return res.error(500, false, "Failed to send notification", { result });
      }
    }
  } catch (error) {
    console.error('Test notification error:', error);
    return res.error(500, false, "Error sending test notification", error.message);
  }
});

module.exports = router;