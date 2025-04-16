const News = require('../models/news.model');
const User = require('../models/user.model');
const like=require('../models/like.model');
const comment=require('../models/comment.model');
const share=require('../models/share.model')
const httpStatus = require('../enums/httpStatusCode.enum');
const sequelize = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const notificationService = require('../services/notification.service');



const newsController = {};

// Configure storage for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = '';
        if (file.fieldname === 'featuredImage') {
            uploadPath = path.join(__dirname, '../uploads/images');
        } else if (file.fieldname === 'video') {
            uploadPath = path.join(__dirname, '../uploads/videos');
        }
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // Increased to 50MB limit
    }
});

// Create new news post (for journalists,editor)

newsController.createNews = async (req, res) => {
    try {
        // Use fields to handle both image and video uploads with different field names
        const uploadFields = upload.fields([
            { name: 'featuredImage', maxCount: 1 },
            { name: 'video', maxCount: 1 }
        ]);
        
        uploadFields(req, res, async function(err) {
            if (err) {
                console.error('Upload error:', err);
                return res.error(
                    httpStatus.BAD_REQUEST,
                    false,
                    "Error uploading file: " + err.message
                );
            }
            
            try {
                // Extract values from request body and clean them
                let { title, content, category, contentType, youtubeUrl, state, district } = req.body;
                
                // Remove any surrounding quotes from string values
                title = title ? title.replace(/^["'](.*)["']$/, '$1') : title;
                content = content ? content.replace(/^["'](.*)["']$/, '$1') : content;
                category = category ? category.replace(/^["'](.*)["']$/, '$1') : category;
                contentType = contentType ? contentType.replace(/^["'](.*)["']$/, '$1') : contentType;
                youtubeUrl = youtubeUrl ? youtubeUrl.replace(/^["'](.*)["']$/, '$1') : youtubeUrl;
                state = state ? state.replace(/^["'](.*)["']$/, '$1') : state;
                district = district ? district.replace(/^["'](.*)["']$/, '$1') : district;
                
                const journalistId = req.mwValue.auth.id;
                
                console.log('Cleaned request body:', { title, content, category, contentType, youtubeUrl, state, district });
                console.log('Files:', req.files);
                
                // Create news object with common fields
                const newsData = {
                    title,
                    content,
                    category,
                    journalistId,
                    status: 'pending',
                    contentType: contentType || 'standard',
                    state: state || null,
                    district: district || null
                };
                
                // Handle content type specific fields
                if (contentType === 'standard') {
                    if (req.files && req.files.featuredImage && req.files.featuredImage[0]) {
                        const file = req.files.featuredImage[0];
                        newsData.featuredImage = `/uploads/images/${file.filename}`;
                        newsData.thumbnailUrl = newsData.featuredImage; // Use same image for thumbnail
                    }
                } else if (contentType === 'video') {
                    if (youtubeUrl) {
                        newsData.youtubeUrl = youtubeUrl;
                        // Extract YouTube thumbnail if available
                        const videoId = youtubeUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                        if (videoId && videoId[1]) {
                            newsData.thumbnailUrl = `https://img.youtube.com/vi/${videoId[1]}/hqdefault.jpg`;
                        }
                    } else if (req.files && req.files.video && req.files.video[0]) {
                        const file = req.files.video[0];
                        newsData.videoPath = `/uploads/videos/${file.filename}`;
                    }
                }
                
                // Validate required fields
                if (!title || !content || !category) {
                    return res.error(
                        httpStatus.BAD_REQUEST,
                        false,
                        "Title, content, and category are required"
                    );
                }
                
                // Create the news
                const news = await News.create(newsData);
                
                // Get journalist info for notification
                const journalist = await User.findByPk(journalistId, {
                    attributes: ['username']
                });

                // Send notification to all editors about new article
                try {
                    await notificationService.sendToRole('editor', 
                        'New Article Submitted', 
                        `${journalist.username} has submitted a new article: "${news.title}"`,
                        {
                            type: 'new_article',
                            newsId: news.id.toString()
                        }
                    );
                } catch (notifError) {
                    console.error('Notification error:', notifError);
                    // Continue execution even if notification fails
                }
                
                return res.success(httpStatus.CREATED, true, "News created successfully", news);
                
            } catch (error) {
                console.error('Create news error:', error);
                return res.error(
                    httpStatus.INTERNAL_SERVER_ERROR,
                    false,
                    "Error creating news: " + error.message
                );
            }
        });
    } catch (error) {
        console.error('Create news outer error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error processing request: " + error.message
        );
    }
};

// Get journalist's own news with status
newsController.getMyNews = async (req, res) => {
    try {
        const journalistId = req.user.id;
        const news = await News.findAll({
            where: { journalistId },
            include: [
                {
                    model: User,
                    as: 'author', 
                    attributes: ['id', 'username']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        return res.success(httpStatus.OK, true, "Your news fetched successfully", news);
    } catch (error) {
        console.error('Fetch my news error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error fetching your news", error);
    }
}    

// Get public news (approved only)
newsController.getPublicNews = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const news = await News.findAndCountAll({
            where: { status: 'approved' },
            include: [
                {
                    model: User,
                    as: 'journalist',
                    attributes: ['id', 'name']
                }
            ],
            attributes: [
                'id', 'title', 'content', 'category', 'status', 
                'contentType', 'youtubeUrl', 'videoPath', 
                'featuredImage', 'thumbnailUrl', 'views', // Make sure thumbnailUrl is included
                'createdAt', 'updatedAt'
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        const totalPages = Math.ceil(news.count / limit);

        return res.success(
            httpStatus.OK,
            true,
            "Public news fetched successfully",
            {
                news: news.rows,
                pagination: {
                    totalItems: news.count,
                    totalPages,
                    currentPage: page,
                    itemsPerPage: limit
                }
            }
        );
    } catch (error) {
        console.error('Get public news error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching public news",
            error
        );
    }
};

// Get pending news (for editors)
newsController.getPendingNews = async (req, res) => {
    try {
        const pendingNews = await News.findAll({
            where: { status: 'pending' },
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['username']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        return res.success(httpStatus.OK, true, "Pending news fetched successfully", pendingNews);
    } catch (error) {
        console.error('Fetch pending news error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error fetching pending news", error);
    }
};


// Get journalist's pending news
newsController.getMyPendingNews = async (req, res) => {
    try {
        const journalistId = req.user.id;
        
        const pendingNews = await News.findAll({
            where: { 
                journalistId,
                status: 'pending'
            },
            include: [
                {
                    model: User,
                    as: 'journalist',
                    attributes: ['id', 'username']
                }
            ],
            attributes: [
                'id', 'title', 'content', 'category', 'status', 
                'contentType', 'youtubeUrl', 'videoPath', 
                'featuredImage', 'thumbnailUrl', 'views',
                'createdAt', 'updatedAt'
            ],
            order: [['createdAt', 'DESC']]
        });

        return res.success(
            httpStatus.OK, 
            true, 
            "Your pending news fetched successfully", 
            pendingNews
        );
    } catch (error) {
        console.error('Fetch journalist pending news error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR, 
            false, 
            "Error fetching your pending news", 
            error
        );
    }
};


// Get journalist's approved news
newsController.getMyApprovedNews = async (req, res) => {
    try {
        const journalistId = req.user.id;
        
        const approvedNews = await News.findAll({
            where: { 
                journalistId,
                status: 'approved'
            },
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
            attributes: [
                'id', 'title', 'content', 'category', 'status',
                'contentType', 'youtubeUrl', 'videoPath',
                'featuredImage', 'thumbnailUrl', 'views',
                'createdAt', 'updatedAt'
            ],
            order: [['updatedAt', 'DESC']]
        });

        return res.success(
            httpStatus.OK, 
            true, 
            "Your approved news fetched successfully", 
            approvedNews
        );
    } catch (error) {
        console.error('Fetch journalist approved news error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR, 
            false, 
            "Error fetching your approved news", 
            error
        );
    }
};


// Get journalist's rejected news
newsController.getMyRejectedNews = async (req, res) => {
    try {
        const journalistId = req.user.id;
        
        const rejectedNews = await News.findAll({
            where: { 
                journalistId,
                status: 'rejected'
            },
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
            attributes: [
                'id', 'title', 'content', 'category', 'status',
                'contentType', 'youtubeUrl', 'videoPath',
                'featuredImage', 'thumbnailUrl', 'views',
                'createdAt', 'updatedAt'
                // Removed 'feedback' field as it doesn't exist in the database
            ],
            order: [['updatedAt', 'DESC']]
        });

        return res.success(
            httpStatus.OK, 
            true, 
            "Your rejected news fetched successfully", 
            rejectedNews
        );
    } catch (error) {
        console.error('Fetch journalist rejected news error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR, 
            false, 
            "Error fetching your rejected news", 
            error
        );
    }
};


// Approve/Reject news (for editors)
newsController.updateNewsStatus = async (req, res) => {
    try {
        const { newsId } = req.params;
        const { status } = req.body; // status can be 'approved' or 'rejected'
        const editorId = req.user.id;

        if (!['approved', 'rejected'].includes(status)) {
            return res.error(httpStatus.BAD_REQUEST, false, "Invalid status. Use 'approved' or 'rejected'");
        }

        const news = await News.findByPk(newsId);
        if (!news) {
            return res.error(httpStatus.NOT_FOUND, false, "News not found");
        }

        await news.update({
            status,
            editorId,
        });

        // Get editor and journalist info for notifications
        const editor = await User.findByPk(editorId, {
            attributes: ['username']
        });

        // Send appropriate notifications based on status
        try {
            if (status === 'approved') {
                // Notify the journalist about approval
                await notificationService.sendToUsers([news.journalistId], 
                    'Article Approved', 
                    `Your article "${news.title}" has been approved by ${editor.username}`,
                    {
                        type: 'article_approved',
                        newsId: news.id.toString()
                    }
                );
                
                // Notify all audience members about new article
                await notificationService.sendToRole('audience', 
                    'New Article Available', 
                    `A new article is now available: "${news.title}"`,
                    {
                        type: 'new_published_article',
                        newsId: news.id.toString()
                    }
                );
            } else if (status === 'rejected') {
                // Notify only the journalist about rejection
                await notificationService.sendToUsers([news.journalistId], 
                    'Article Rejected', 
                    `Your article "${news.title}" has been rejected by ${editor.username}`,
                    {
                        type: 'article_rejected',
                        newsId: news.id.toString()
                    }
                );
            }
        } catch (notifError) {
            console.error('Notification error:', notifError);
            // Continue execution even if notification fails
        }

        return res.success(httpStatus.OK, true, `News ${status} successfully`, news);
    } catch (error) {
        console.error('Update news status error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error updating news status", error);
    }
};

 //for getting news by category
newsController.getNewsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const validCategories = ['national', 'international', 'sports', 'entertainment', 'district'];        
        if (!validCategories.includes(category.toLowerCase())) {
            return res.error(httpStatus.BAD_REQUEST, false, "Invalid category");
        }

        const news = await News.findAll({
            where: { 
                status: 'approved',
                category: category 
            },
            include: [
                {
                    model: User,
                    as: 'journalist',
                    attributes: ['username'],
                }
            ],
            attributes: {
                include: [
                    [sequelize.literal('(SELECT COUNT(*) FROM likes WHERE likes.newsId = news.id)'), 'likesCount'],
                    [sequelize.literal('(SELECT COUNT(*) FROM comments WHERE comments.newsId = news.id)'), 'commentsCount'],
                    [sequelize.literal('(SELECT COUNT(*) FROM shares WHERE shares.newsId = news.id)'), 'sharesCount']
                ]
            },
            order: [['createdAt', 'DESC']]
        });
        return res.success(httpStatus.OK, true, `${category} news fetched successfully`, news);
    } catch (error) {
        console.error('fetch category news error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error fetching category news", error);
    }
};

//Get trending news (5 most recent approved news)
newsController.getTrendingNews = async (req, res) => {
    try {
        const trendingNews = await News.findAll({
            where: { status: 'approved' },
            include: [
                {
                    model: User,
                    as: 'journalist',
                    attributes: ['username']
                }
            ],
            attributes: {
                include: [
                    [sequelize.literal('(SELECT COUNT(*) FROM likes WHERE likes.newsId = news.id)'), 'likesCount'],
                    [sequelize.literal('(SELECT COUNT(*) FROM comments WHERE comments.newsId = news.id)'), 'commentsCount'],
                    [sequelize.literal('(SELECT COUNT(*) FROM shares WHERE shares.newsId = news.id)'), 'sharesCount']
                ]
            },
            order: [['createdAt', 'DESC']],
            limit: 5
        });

        return res.success(httpStatus.OK, true, "Trending news fetched successfully", trendingNews);
    } catch (error) {
        console.error('Fetch trending news error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error fetching trending news", error);
    }
};

// Get rejected news (for editors)
newsController.getRejectedNews = async (req, res) => {
    try {
        const rejectedNews = await News.findAll({
            where: { status: 'rejected' },
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
            attributes: [
                'id', 'title', 'content', 'category', 'status',
                'contentType', 'youtubeUrl', 'videoPath',
                'featuredImage', 'thumbnailUrl', 'views',
                'createdAt', 'updatedAt'
                 
            ],
            order: [['updatedAt', 'DESC']]
        });

        return res.success(httpStatus.OK, true, "Rejected news fetched successfully", rejectedNews);
    } catch (error) {
        console.error('Fetch rejected news error:', error);
        return res.error(httpStatus.INTERNAL_SERVER_ERROR, false, "Error fetching rejected news", error);
    }
};


// Get editor's approved news (news approved by the logged-in editor)
newsController.getEditorApprovedNews = async (req, res) => {
    try {
        const editorId = req.user.id;
        
        const approvedNews = await News.findAll({
            where: { 
                editorId,
                status: 'approved'
            },
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
            attributes: [
                'id', 'title', 'content', 'category', 'status',
                'contentType', 'youtubeUrl', 'videoPath',
                'featuredImage', 'thumbnailUrl', 'views',
                'createdAt', 'updatedAt'
            ],
            order: [['updatedAt', 'DESC']]
        });

        return res.success(
            httpStatus.OK,
            true,
            "News approved by you fetched successfully",
            approvedNews
        );
    } catch (error) {
        console.error('Fetch editor approved news error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching news approved by you",
            error
        );
    }
};



// Update the News .................................................
newsController.updateNews = async (req, res) => {
    try {
        const { newsId } = req.params;
        const userId = req.mwValue.auth.id;
        const userRole = req.mwValue.auth.role;
        
        // Find the news article based on role
        let news;
        
        if (userRole === 'editor') {
            // Editors can edit any news
            news = await News.findByPk(newsId);
        } else {
            // Journalists can only edit their own news
            news = await News.findOne({
                where: { 
                    id: newsId,
                    journalistId: userId
                }
            });
        }
        
        if (!news) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "News article not found or you don't have permission to edit it"
            );
        }
        
        // Check if the news is already approved (only for journalists)
        if (userRole === 'journalist' && news.status === 'approved') {
            return res.error(
                httpStatus.FORBIDDEN,
                false,
                "Cannot edit news that has already been approved by an editor"
            );
        }
        
        // Use fields to handle both image and video uploads with different field names
        const uploadFields = upload.fields([
            { name: 'featuredImage', maxCount: 1 },
            { name: 'video', maxCount: 1 }
        ]);
        
        uploadFields(req, res, async function(err) {
            if (err) {
                return res.error(
                    httpStatus.BAD_REQUEST,
                    false,
                    "Error uploading file: " + err.message
                );
            }
            
            try {
                // Extract values from request body and clean them
                let { title, content, category, contentType, youtubeUrl, state, district } = req.body;
                
                // Remove any surrounding quotes from string values
                title = title ? title.replace(/^["'](.*)["']$/, '$1') : title;
                content = content ? content.replace(/^["'](.*)["']$/, '$1') : content;
                category = category ? category.replace(/^["'](.*)["']$/, '$1') : category;
                contentType = contentType ? contentType.replace(/^["'](.*)["']$/, '$1') : contentType;
                youtubeUrl = youtubeUrl ? youtubeUrl.replace(/^["'](.*)["']$/, '$1') : youtubeUrl;
                state = state ? state.replace(/^["'](.*)["']$/, '$1') : state;
                district = district ? district.replace(/^["'](.*)["']$/, '$1') : district;
                
                // Create news object with updated fields
                const newsData = {
                    title: title || news.title,
                    content: content || news.content,
                    category: category || news.category,
                    contentType: contentType || news.contentType,
                    state: state !== undefined ? state : news.state,
                    district: district !== undefined ? district : news.district,
                    status: 'pending' // Reset to pending since it's been edited
                };
                
                // Handle content type specific fields
                if (contentType === 'standard' || news.contentType === 'standard') {
                    if (req.files && req.files.featuredImage && req.files.featuredImage[0]) {
                        // Delete old image if exists and it's not the default
                        if (news.featuredImage && news.featuredImage !== '/uploads/images/default.jpg') {
                            const oldImagePath = path.join(__dirname, '..', news.featuredImage);
                            if (fs.existsSync(oldImagePath)) {
                                fs.unlinkSync(oldImagePath);
                            }
                        }
                        
                        const file = req.files.featuredImage[0];
                        newsData.featuredImage = `/uploads/images/${file.filename}`;
                        newsData.thumbnailUrl = newsData.featuredImage; // Use same image for thumbnail
                    }
                } else if (contentType === 'video' || news.contentType === 'video') {
                    if (youtubeUrl) {
                        newsData.youtubeUrl = youtubeUrl;
                        // Extract YouTube thumbnail if available
                        const videoId = youtubeUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                        if (videoId && videoId[1]) {
                            newsData.thumbnailUrl = `https://img.youtube.com/vi/${videoId[1]}/hqdefault.jpg`;
                        }
                    } else if (req.files && req.files.video && req.files.video[0]) {
                        // Delete old video if exists
                        if (news.videoPath) {
                            const oldVideoPath = path.join(__dirname, '..', news.videoPath);
                            if (fs.existsSync(oldVideoPath)) {
                                fs.unlinkSync(oldVideoPath);
                            }
                        }
                        
                        const file = req.files.video[0];
                        newsData.videoPath = `/uploads/videos/${file.filename}`;
                    }
                }
                
                // Update the news
                await news.update(newsData);
                
                // Reload the news object to get fresh data from the database
                const updatedNews = await News.findByPk(news.id);
                
                // Send notification to appropriate users based on who made the edit
                try {
                    if (userRole === 'journalist') {
                        // Get journalist info for notification
                        const journalist = await User.findByPk(userId, {
                            attributes: ['username']
                        });
                        
                        // Send notification to all editors about updated article
                        await notificationService.sendToRole('editor', 
                            'Article Updated', 
                            `${journalist.username} has updated an article: "${updatedNews.title}"`,
                            {
                                type: 'updated_article',
                                newsId: updatedNews.id.toString()
                            }
                        );
                    } else if (userRole === 'editor') {
                        // Get editor info for notification
                        const editor = await User.findByPk(userId, {
                            attributes: ['username']
                        });
                        
                        // Send notification to the journalist about editor's edits
                        await notificationService.sendToUsers([updatedNews.journalistId], 
                            'Article Edited by Editor', 
                            `Editor ${editor.username} has edited your article: "${updatedNews.title}"`,
                            {
                                type: 'editor_edited_article',
                                newsId: updatedNews.id.toString()
                            }
                        );
                    }
                } catch (notifError) {
                    // Continue execution even if notification fails
                }
                
                return res.success(httpStatus.OK, true, "News updated successfully", updatedNews);
                
            } catch (error) {
                return res.error(
                    httpStatus.INTERNAL_SERVER_ERROR,
                    false,
                    "Error updating news: " + error.message
                );
            }
        });
    } catch (error) {
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error processing request: " + error.message
        );
    }
};

module.exports=newsController;


//  featured status (for editors only)
newsController.FeaturedNews = async (req, res) => {
    try {
        const { newsId } = req.params;
        const editorId = req.user.id;
        
        // Find the news article
        const news = await News.findByPk(newsId);
        
        if (!news) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "News article not found"
            );
        }
        
        // Check if news is approved (only approved news can be featured)
        if (news.status !== 'approved') {
            return res.error(
                httpStatus.BAD_REQUEST,
                false,
                "Only approved news can be featured"
            );
        }
        
        // Toggle the featured status
        const isFeatured = !news.isFeatured;
        
        await news.update({
            isFeatured,
            // Store which editor marked it as featured
            featuredBy: isFeatured ? editorId : null
        });
        
        // Reload to get fresh data
        const updatedNews = await News.findByPk(newsId, {
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
                },
                {
                    model: User,
                    as: 'featuredByEditor',
                    attributes: ['id', 'username']
                }
            ]
        });
        
        return res.success(
            httpStatus.OK, 
            true, 
            `News ${isFeatured ? 'marked as' : 'removed from'} featured successfully`, 
            updatedNews
        );
    } catch (error) {
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error news featured status",
            error.message
        );
    }
};

// Get all featured news
newsController.getFeaturedNews = async (req, res) => {
    try {
        const featuredNews = await News.findAll({
            where: { 
                isFeatured: true,
                status: 'approved'
            },
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
                },
                {
                    model: User,
                    as: 'featuredByEditor',
                    attributes: ['id', 'username']
                }
            ],
            attributes: [
                'id', 'title', 'content', 'category', 'status',
                'contentType', 'youtubeUrl', 'videoPath',
                'featuredImage', 'thumbnailUrl', 'views',
                'createdAt', 'updatedAt', 'isFeatured'
            ],
            order: [['updatedAt', 'DESC']]
        });
        
        return res.success(
            httpStatus.OK,
            true,
            "Featured news fetched successfully",
            featuredNews
        );
    } catch (error) {
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching featured news",
            error.message
        );
    }
};