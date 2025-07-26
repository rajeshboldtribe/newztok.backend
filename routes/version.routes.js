const express = require('express');
const router = express.Router();
const versionController = require('../controllers/version.controller');

router.get('/:platform', versionController.getVersion);  
router.post('/update', versionController.updateVersion); //   this for admin only

module.exports = router;