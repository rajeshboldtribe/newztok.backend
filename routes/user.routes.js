const router = require('express').Router();
const userController = require('../controllers/user.controller');
const { checkUserAuth, checkRole } = require('../middlewares/auth.middleware');

// Editor routes
router.get('/assigned-journalists', checkUserAuth, checkRole('editor'), userController.getAssignedJournalists);
router.get('/editor-profile', checkUserAuth, checkRole('editor'), userController.getEditorProfile);

//journalist's own profile
router.get('/my-profile', checkUserAuth, userController.getMyProfile);

//admin profile
router.get('/admin-profile', checkUserAuth, checkRole('admin'), userController.getAdminProfile);
//for push notification
router.post('/update-fcm-token', checkUserAuth, userController.updateFcmToken);


module.exports = router;