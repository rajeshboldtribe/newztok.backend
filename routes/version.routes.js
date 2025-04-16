const router = require('express').Router();
const versionController = require('../controllers/version.controller');
const { checkUserAuth, checkRole } = require('../middlewares/auth.middleware');

// Add new version (admin only)
router.post('/add', checkUserAuth, checkRole('super_admin'), versionController.addVersion);

// Get version details
router.get('/get', versionController.getVersionDetails);

module.exports = router;