const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const {checkUserAuth,checkRole}=require('../middlewares/auth.middleware');
// Super Admin routes
router.post('/create-admin', checkUserAuth, checkRole('super_admin'), authController.createAdmin);

// Admin routes
router.post('/create-editor', checkUserAuth, checkRole('admin'), authController.createEditor);

// Editor routes
router.post('/create-journalist', checkUserAuth, checkRole('editor'), authController.createJournalist);
//login same for all except audience
router.post('/login',authController.login);

//public route
router.post('/login/audience',authController.loginAudience);
router.post('/register',authController.register);
router.get('/profile', checkUserAuth, authController.getUserProfile);
router.put('/profile', checkUserAuth, authController.updateUserProfile);
//same for all user put the token of user in bearer token and that will be logout
router.get('/logout',authController.logout);



module.exports = router;