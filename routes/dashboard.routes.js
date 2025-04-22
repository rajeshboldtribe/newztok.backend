const router = require('express').Router();
const dashboardController = require('../controllers/dashboard.controller');
const { checkUserAuth, checkRole } = require('../middlewares/auth.middleware');

// Dashboard routes (admin only)
router.get('/stats', checkUserAuth, checkRole(['admin', 'editor']), dashboardController.getStats);
router.get('/pending-posts', checkUserAuth, checkRole(['admin', 'editor']), dashboardController.getLatestPendingPosts);
router.get('/users/:role', checkUserAuth, checkRole(['admin']), dashboardController.getUsersByRole);
router.get('/users', checkUserAuth, checkRole(['admin']), dashboardController.getAllUsers);
router.delete('/users/:userId', checkUserAuth, checkRole(['admin']), dashboardController.deleteUser);
module.exports = router;