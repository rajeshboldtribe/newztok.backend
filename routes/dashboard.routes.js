const router = require('express').Router();
const dashboardController = require('../controllers/dashboard.controller');
const { checkUserAuth, checkRole } = require('../middlewares/auth.middleware');

// Dashboard routes (admin only)
router.get('/stats', checkUserAuth, checkRole(['admin', 'editor']), dashboardController.getStats);
router.get('/pending-posts', checkUserAuth, checkRole(['admin', 'editor']), dashboardController.getLatestPendingPosts);
router.get('/users/:role', checkUserAuth, checkRole(['admin']), dashboardController.getUsersByRole);
router.get('/users', checkUserAuth, checkRole(['admin']), dashboardController.getAllUsers);
router.delete('/users/:userId', checkUserAuth, checkRole(['admin']), dashboardController.deleteUser);
router.post('/journalist/create', checkUserAuth, checkRole(['admin']), dashboardController.createJournalist);
router.get('/rejected-news', checkUserAuth, checkRole(['admin', 'editor']), dashboardController.getRejectedNews);
router.get('/approved-news', checkUserAuth, checkRole(['admin', 'editor']), dashboardController.getApprovedNews);

module.exports = router;