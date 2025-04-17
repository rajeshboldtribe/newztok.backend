const { Like, Comment, Share, News, User,Saved } = require('../models');
const httpStatus = require('../enums/httpStatusCode.enum');
const { where } = require('sequelize');

const interactionController = {};

// Like/Unlike a news
interactionController.toggleLike = async (req, res) => {
    try {
        const { newsId } = req.params;
        const userId = req.mwValue.auth.id;

        const news = await News.findByPk(newsId);
        if (!news) {
            return res.error(httpStatus.NOT_FOUND, false, "News not found");
        }

        const existingLike = await Like.findOne({
            where: { userId, newsId }
        });

        if (existingLike) {
            await existingLike.destroy();
            return res.success(httpStatus.OK, true, "News unliked successfully");
        }

        await Like.create({ userId, newsId });
        return res.success(httpStatus.CREATED, true, "News liked successfully");
    } catch (error) {
        console.error('Toggle like error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error processing like", error);
    }
};

// Add comment
interactionController.addComment = async (req, res) => {
    try {
        const { newsId } = req.params;
        const { content } = req.body;
        const userId = req.mwValue.auth.id;

        if (!content) {
            return res.error(httpStatus.BAD_REQUEST, false, "Comment content is required");
        }

        const news = await News.findByPk(newsId);
        if (!news) {
            return res.error(httpStatus.NOT_FOUND, false, "News not found");
        }

        const comment = await Comment.create({
            content,
            userId,
            newsId
        });

        return res.success(httpStatus.CREATED, true, "Comment added successfully", comment);
    } catch (error) {
        console.error('Add comment error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error adding comment", error);
    }
};

// Get comments for a news
interactionController.getComments = async (req, res) => {
    try {
        const { newsId } = req.params;

        const comments = await Comment.findAll({
            where: { newsId },
            include: [{
                model: User,
                attributes: ['username']
            }],
            order: [['createdAt', 'DESC']]
        });

        return res.success(httpStatus.OK, true, "Comments fetched successfully", comments);
    } catch (error) {
        console.error('Get comments error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error fetching comments", error);
    }
};

// Share news
interactionController.shareNews = async (req, res) => {
    try {
        const { newsId } = req.params;
        const userId = req.mwValue.auth.id;

        const news = await News.findByPk(newsId);
        if (!news) {
            return res.error(httpStatus.NOT_FOUND, false, "News not found");
        }

        await Share.create({ userId, newsId });
        return res.success(httpStatus.CREATED, true, "News shared successfully");
    } catch (error) {
        console.error('Share news error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error sharing news", error);
    }
};


// Get post statistics (likes, comments, shares count)
interactionController.getPostStats = async (req, res) => {
    try {
        const { newsId } = req.params;

        const news = await News.findByPk(newsId);
        if (!news) {
            return res.error(httpStatus.NOT_FOUND, false, "News not found");
        }

        const stats = await Promise.all([
            Like.count({ where: { newsId } }),
            Comment.count({ where: { newsId } }),
            Share.count({ where: { newsId } }),
            
        ]);

        const postStats = {
            likes: stats[0],
            comments: stats[1],
            shares: stats[2],
            views: news.views 
        };

        return res.success(httpStatus.OK, true, "Post statistics fetched successfully", postStats);
    } catch (error) {
        console.error('Get post stats error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error fetching post statistics", error);
    }
};

//saved video status...................................

// Toggle save status (save/unsave)
interactionController.toggleSave = async (req, res) => {
    try {
        const { newsId } = req.params;
        const userId = req.mwValue.auth.id;
        
        // Check if the news exists and is approved
        const news = await News.findOne({
            where: {
                id: newsId,
                status: 'approved'
            }
        });
        
        if (!news) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "News article not found or not approved"
            );
        }
        
        // Check if already saved
        const existingSave = await Saved.findOne({
            where: {
                userId,
                newsId
            }
        });
        
        let result;
        let message;
        
        if (existingSave) {
            // Unsave if already saved
            await existingSave.destroy();
            result = { saved: false };
            message = "News article unsaved successfully";
        } else {
            // Save if not already saved
            await Saved.create({
                userId,
                newsId
            });
            result = { saved: true };
            message = "News article saved successfully";
        }
        
        return res.success(
            httpStatus.OK,
            true,
            message,
            result
        );
    } catch (error) {
        console.error('Toggle save error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error toggling save status",
            error.message
        );
    }
};

// Get all saved news for a user
interactionController.getSavedNews = async (req, res) => {
    try {
        const userId = req.mwValue.auth.id;
        
        const savedNews = await Saved.findAll({
            where: {
                userId
            },
            include: [
                {
                    model: News,
                    include: [
                        {
                            model: User,
                            as: 'journalist',
                            attributes: ['id', 'username']
                        },
                        {
                            model: User,
                            as: 'editor',
                            attributes: ['id', 'username']
                        }
                    ],
                    where: {
                        status: 'approved'
                    }
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        
        // Format the response to return just the news articles
        const formattedNews = savedNews.map(item => item.news);
        
        return res.success(
            httpStatus.OK,
            true,
            "Saved news fetched successfully",
            formattedNews
        );
    } catch (error) {
        console.error('Get saved news error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching saved news",
            error.message
        );
    }
};

// Check if a news article is saved by the user
interactionController.checkSaved = async (req, res) => {
    try {
        const { newsId } = req.params;
        const userId = req.mwValue.auth.id;
        
        const saved = await Saved.findOne({
            where: {
                userId,
                newsId
            }
        });
        
        return res.success(
            httpStatus.OK,
            true,
            "Save status checked successfully",
            { saved: !!saved }
        );
    } catch (error) {
        console.error('Check saved error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error checking save status",
            error.message
        );
    }
};





module.exports = interactionController;