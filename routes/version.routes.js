const express = require('express');
const router = express.Router();
const versionController = require('../controllers/version.controller');

router.post('/document', versionController.createDocument);
router.put('/document/:id', versionController.updateDocument);
router.get('/document/:id/versions', versionController.getVersions);

module.exports = router;
