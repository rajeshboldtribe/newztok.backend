const router = require('express').Router();
const newsController = require('../controllers/news.controller');
const { checkUserAuth, checkRole } = require('../middlewares/auth.middleware');

// Public routes
router.get('/public', newsController.getPublicNews);
router.get('/category/:category', newsController.getNewsByCategory);

// Journalist routes
router.post('/create', checkUserAuth, checkRole(['journalist','editor']), newsController.createNews);
router.get('/my-news', checkUserAuth, checkRole('journalist'), newsController.getMyNews);
router.get('/my-pending-news', checkUserAuth, checkRole('journalist'), newsController.getMyPendingNews);
router.get('/my-rejected-news', checkUserAuth, checkRole('journalist'), newsController.getMyRejectedNews);
router.get('/my-approved-news', checkUserAuth, checkRole('journalist'), newsController.getMyApprovedNews);
router.put('/:newsId', checkUserAuth, checkRole(['journalist', 'editor']), newsController.updateNews);

// Editor routes
router.get('/pending', checkUserAuth, checkRole('editor'), newsController.getPendingNews);
router.get('/rejected', checkUserAuth, checkRole('editor'), newsController.getRejectedNews);
router.get('/approved-by-me', checkUserAuth, checkRole('editor'), newsController.getEditorApprovedNews);
router.put('/:newsId/status', checkUserAuth, checkRole('editor'), newsController.updateNewsStatus);
router.put('/featured/:newsId', checkUserAuth, checkRole('editor'), newsController.FeaturedNews);
router.get('/featured', newsController.getFeaturedNews);
//trending news route
router.get('/trending',newsController.getTrendingNews);

//state news route
router.get('/state/:state',newsController.getNewsByState);
// Delete news route (for editors and admins)
router.delete('/:newsId', checkUserAuth, checkRole(['editor', 'admin']), newsController.deleteNews);
//views route
router.post('/:newsId/view', newsController.incrementViewCount);



module.exports = router;