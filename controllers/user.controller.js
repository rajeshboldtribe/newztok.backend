const User = require('../models/user.model');
const News = require('../models/news.model');
const httpStatus = require('../enums/httpStatusCode.enum');
const sequelize = require('../config/db');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const notificationService = require('../services/notification.service');

const userController = {};

// Configure storage for profile picture uploads
const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads/profiles');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: profileStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
    },
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Get journalists assigned to editor
userController.getAssignedJournalists = async (req, res) => {
    try {
        // Get the editor ID from the authenticated user
        const editorId = req.user.id || req.mwValue?.auth?.id;
        
        // Find journalists created by this editor
        const journalists = await User.findAll({
            where: {
                createdBy: editorId,
                role: 'journalist'
            },
            attributes: ['id', 'username', 'email', 'role', 'status', 'createdAt', 'mobile', 'profilePicture', 'assignedState', 'assignedDistrict']
        });
        
        if (journalists.length === 0) {
            // If no journalists found, just return a message without any data
            return res.success(
                httpStatus.OK,
                true,
                "No journalists created by you found.",
                []
            );
        }
        
        return res.success(
            httpStatus.OK,
            true,
            "Journalists created by you fetched successfully",
            journalists
        );
    } catch (error) {
        console.error('Fetch journalists error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching journalists: " + error.message
        );
    }
};

// Get journalist's own profile
userController.getMyProfile = async (req, res) => {
    try {
        // Get the user ID from the authenticated user
        const userId = req.user.id || req.mwValue?.auth?.id;
        
        // Find the user with their details
        const user = await User.findOne({
            where: { id: userId },
            attributes: [
                'id', 'username', 'email', 'role', 'status', 
                'mobile', 'profilePicture', 'assignedState', 
                'assignedDistrict', 'createdAt', 'updatedAt'
            ]
        });
        
        if (!user) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "User profile not found"
            );
        }
        
        return res.success(
            httpStatus.OK,
            true,
            "Profile fetched successfully",
            user
        );
    } catch (error) {
        console.error('Fetch profile error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching profile: " + error.message
        );
    }
};

// Get editor profile with statistics
userController.getEditorProfile = async (req, res) => {
    try {
        const editorId = req.user.id;
        
        // Find the editor with their basic info
        const editor = await User.findByPk(editorId, {
            attributes: [
                'id', 'username', 'email', 'role', 'profilePicture', 'createdAt'
            ]
        });
        
        if (!editor) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "Editor profile not found"
            );
        }
        
        // Get editor's statistics
        const approvedCount = await News.count({
            where: {
                editorId,
                status: 'approved'
            }
        });
        
        const rejectedCount = await News.count({
            where: {
                editorId,
                status: 'rejected'
            }
        });
        
        const pendingCount = await News.count({
            where: {
                status: 'pending'
            }
        });
        
        // Get the most recent articles approved by this editor
        const recentApprovedNews = await News.findAll({
            where: {
                editorId,
                status: 'approved'
            },
            include: [
                {
                    model: User,
                    as: 'journalist',
                    attributes: ['id', 'username']
                }
            ],
            attributes: ['id', 'title', 'category', 'updatedAt', 'thumbnailUrl'],
            order: [['updatedAt', 'DESC']],
            limit: 5
        });
        
        // Get assigned journalists 
        const assignedJournalists = await User.findAll({
            where: {
                role: 'journalist',
                createdBy: editorId  
            },
            attributes: ['id', 'username', 'email', 'profilePicture']
        });
        
        // Combine all data
        const profileData = {
            editor: editor.toJSON(),
            stats: {
                approvedArticles: approvedCount,
                rejectedArticles: rejectedCount,
                pendingArticles: pendingCount,
                totalReviewed: approvedCount + rejectedCount
            },
            recentApprovedNews,
            assignedJournalists: {
                count: assignedJournalists.length,
                list: assignedJournalists
            }
        };
        
        return res.success(
            httpStatus.OK,
            true,
            "Editor profile fetched successfully",
            profileData
        );
    } catch (error) {
        console.error('Get editor profile error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching editor profile",
            error.message
        );
    }
};


// Get admin profile with statistics
userController.getAdminProfile = async (req, res) => {
    try {
        const adminId = req.user.id;
        
        // Find the admin with their basic info
        const admin = await User.findByPk(adminId, {
            attributes: [
                'id', 'username', 'email', 'role', 'profilePicture', 'createdAt'
            ]
        });
        
        if (!admin) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "Admin profile not found"
            );
        }
        
        // Get count of editors created by this admin
        const editorsCount = await User.count({
            where: {
                role: 'editor',
                createdBy: adminId
            }
        });
        
        // Get count of all journalists in the system
        const journalistsCount = await User.count({
            where: {
                role: 'journalist'
            }
        });
        
        // Get count of all news articles
        const totalNewsCount = await News.count();
        
        // Get count of approved news articles
        const approvedNewsCount = await News.count({
            where: {
                status: 'approved'
            }
        });
        
        // Get count of pending news articles
        const pendingNewsCount = await News.count({
            where: {
                status: 'pending'
            }
        });
        
        // Get editors created by this admin
        const editors = await User.findAll({
            where: {
                role: 'editor',
                createdBy: adminId
            },
            attributes: ['id', 'username', 'email', 'profilePicture', 'createdAt']
        });
        
        // Get recent news articles
        const recentNews = await News.findAll({
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
            attributes: ['id', 'title', 'category', 'status', 'createdAt', 'thumbnailUrl'],
            order: [['createdAt', 'DESC']],
            limit: 5
        });
        
        // Combine all data
        const profileData = {
            admin: admin.toJSON(),
            stats: {
                editorsCount,
                journalistsCount,
                totalNewsCount,
                approvedNewsCount,
                pendingNewsCount
            },
            editors: {
                count: editors.length,
                list: editors
            },
            recentNews
        };
        
        return res.success(
            httpStatus.OK,
            true,
            "Admin profile fetched successfully",
            profileData
        );
    } catch (error) {
        console.error('Get admin profile error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching admin profile",
            error.message
        );
    }
};




// Update FCM token for push notifications
// Update this function in your user controller
userController.updateFcmToken = async (req, res) => {
    try {
        const userId = req.user.id || req.mwValue?.auth?.id;
        const { fcmToken } = req.body;
        
        if (!fcmToken) {
            return res.error(
                httpStatus.BAD_REQUEST,
                false,
                "FCM token is required"
            );
        }
        
        // Use the notification service to update token and subscribe to topics
        const result = await notificationService.updateUserToken(userId, fcmToken);
        
        if (!result.success) {
            return res.error(
                httpStatus.INTERNAL_SERVER_ERROR,
                false,
                result.message || "Error updating FCM token"
            );
        }
        
        return res.success(
            httpStatus.OK,
            true,
            "FCM token updated successfully and subscribed to relevant topics"
        );
    } catch (error) {
        console.error('Update FCM token error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error updating FCM token: " + error.message
        );
    }
};

// Send notification to all audience when news is approved
userController.sendNewsApprovedNotification = async (newsId, newsTitle) => {
  try {
    // Find all users with role 'audience' who have FCM tokens
    const audienceUsers = await User.findAll({
      where: {
        role: 'audience',
        fcmToken: {
          [sequelize.Op.not]: null
        }
      },
      attributes: ['id', 'fcmToken']
    });

    if (audienceUsers.length === 0) {
      console.log('No audience users with FCM tokens found');
      return;
    }

    // Get audience user IDs
    const audienceIds = audienceUsers.map(user => user.id);

    // Send notification to all audience users
    await notificationService.sendToUsers(
      audienceIds,
      'New Article Published!',
      `${newsTitle} - Read it now on NewzTok`,
      {
        type: 'news_approved',
        newsId: newsId.toString()
      }
    );

    console.log(`Notification sent to ${audienceIds.length} audience members for news: ${newsTitle}`);
    return true;
  } catch (error) {
    console.error('Error sending news approved notification:', error);
    return false;
  }
};

module.exports = userController;