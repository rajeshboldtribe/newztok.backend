const router = require('express').Router();
const interactionController = require('../controllers/interaction.controller');
const { checkUserAuth } = require('../middlewares/auth.middleware');

// Like/Unlike routes
router.post('/news/:newsId/like', checkUserAuth, interactionController.toggleLike);

// Comment routes
router.post('/news/:newsId/comment', checkUserAuth, interactionController.addComment);
router.get('/news/:newsId/comments', interactionController.getComments);

// Share routes
router.post('/news/:newsId/share', checkUserAuth, interactionController.shareNews);
//all interaction routes
router.get('/news/:newsId/stats', interactionController.getPostStats);

//save a video 
router.post('/save/:newsId', checkUserAuth, interactionController.toggleSave);
router.get('/saved', checkUserAuth, interactionController.getSavedNews);
router.get('/save/check/:newsId', checkUserAuth, interactionController.checkSaved);

//views route
router.post('/:newsId/view', interactionController.incrementViewCount);

module.exports = router;