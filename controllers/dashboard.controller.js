const News = require('../models/news.model');
const User = require('../models/user.model');
const httpStatus = require('../enums/httpStatusCode.enum');
const sequelize = require('../config/db');
const bcrypt = require('bcrypt');
const notificationService = require('../services/notification.service');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
        fileSize: 50 * 1024 * 1024, // 50MB limit for profile pictures
    },
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

const dashboardController = {};

// Get dashboard statistics
dashboardController.getStats = async (req, res) => {
    try {
        // Get counts for different news statuses
        const totalPosts = await News.count();
        const pendingReview = await News.count({ where: { status: 'pending' } });
        const approved = await News.count({ where: { status: 'approved' } });
        const rejected = await News.count({ where: { status: 'rejected' } });

        // Get user counts by role
        const journalists = await User.count({ where: { role: 'journalist' } });
        const editors = await User.count({ where: { role: 'editor' } });
        const audience = await User.count({ where: { role: 'audience' } });

        return res.success(
            httpStatus.OK,
            true,
            "Dashboard statistics fetched successfully",
            {
                posts: {
                    total: totalPosts,
                    pending: pendingReview,
                    approved: approved,
                    rejected: rejected
                },
                users: {
                    journalists: journalists,
                    editors: editors,
                    audience: audience,
                    total: journalists + editors + audience
                }
            }
        );
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching dashboard statistics",
            error.message
        );
    }
};

// Get latest pending posts with pagination
dashboardController.getLatestPendingPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const { count, rows: pendingPosts } = await News.findAndCountAll({
            where: { status: 'pending' },
            include: [
                {
                    model: User,
                    as: 'journalist',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'admin',
                    attributes: ['id', 'username']
                }
            ],
            attributes: [
            'id', 'title', 'content', 'category', 'status', 
                'contentType', 'youtubeUrl', 'videoPath', 
                'featuredImage', 'thumbnailUrl', 'views',
                'createdAt', 'updatedAt','state','district'
            ],
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: offset
        });

        return res.success(
            httpStatus.OK,
            true,
            "Latest pending posts fetched successfully",
            {
                total: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                posts: pendingPosts
            }
        );
    } catch (error) {
        console.error('Get latest pending posts error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching latest pending posts",
            error.message
        );
    }
};

// Get users by role with pagination
dashboardController.getUsersByRole = async (req, res) => {
    try {
        const { role } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Validate role parameter
        const validRoles = ['editor', 'journalist', 'audience'];
        if (!validRoles.includes(role)) {
            return res.error(
                httpStatus.BAD_REQUEST,
                false,
                "Invalid role specified",
                "Role must be one of: editor, journalist, audience"
            );
        }

        const { count, rows: users } = await User.findAndCountAll({
            where: { role },
            attributes: [
                'id', 'username', 'email', 'mobile', 
                'assignedState', 'assignedDistrict', 'createdAt', 'status'
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        // Format the response to match your UI requirements
        const formattedUsers = users.map(user => ({
            id: user.id,
            name: user.username,
            phone: user.mobile || 'Not provided',
            state: user.assignedState || 'Not specified',
            district: user.assignedDistrict || 'Not specified',
            email: user.email,
            status: user.status,
            createdAt: user.createdAt
        }));

        return res.success(
            httpStatus.OK,
            true,
            `${role.charAt(0).toUpperCase() + role.slice(1)}s fetched successfully`,
            {
                total: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                users: formattedUsers
            }
        );
    } catch (error) {
        console.error(`Get ${req.params.role}s error:`, error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            `Error fetching ${req.params.role}s`,
            error.message
        );
    }
};

// Get all users with role-based grouping (for admin dashboard)
dashboardController.getAllUsers = async (req, res) => {
    try {
        // Get editors
        const editors = await User.findAll({
            where: { role: 'editor' },
            attributes: [
                'id', 'username', 'email', 'mobile', 
                'assignedState', 'assignedDistrict', 'createdAt', 'status'
            ],
            order: [['createdAt', 'DESC']]
        });

        // Get journalists
        const journalists = await User.findAll({
            where: { role: 'journalist' },
            attributes: [
                'id', 'username', 'email', 'mobile', 
                'assignedState', 'assignedDistrict', 'createdAt', 'status'
            ],
            order: [['createdAt', 'DESC']]
        });

        // Format the response
        const formatUsers = users => users.map(user => ({
            id: user.id,
            name: user.username,
            phone: user.mobile || 'Not provided',
            state: user.assignedState || 'Not specified',
            district: user.assignedDistrict || 'Not specified',
            email: user.email,
            status: user.status,
            createdAt: user.createdAt
        }));

        return res.success(
            httpStatus.OK,
            true,
            "Users fetched successfully",
            {
                editors: formatUsers(editors),
                journalists: formatUsers(journalists)
            }
        );
    } catch (error) {
        console.error('Get all users error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching users",
            error.message
        );
    }
};

// Delete a user (journalist or editor) by ID
dashboardController.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Find the user to check if they exist and their role
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "User not found",
                "The specified user does not exist"
            );
        }
        
        // Only allow delete of journalists and editors
        if (user.role !== 'journalist' && user.role !== 'editor') {
            return res.error(
                httpStatus.FORBIDDEN,
                false,
                "Cannot delete this user",
                "Only journalists and editors can be deleted through this endpoint"
            );
        }
        
        // Delete the user
        await user.destroy();
        
        return res.success(
            httpStatus.OK,
            true,
            "User deleted successfully",
            { id: userId, role: user.role }
        );
    } catch (error) {
        console.error('Delete user error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error deleting user",
            error.message
        );
    }
};
// Create journalist account (for admins)
dashboardController.createJournalist = async (req, res) => {
    try {
        // Check if the requester is an admin
        const adminId = req.mwValue.auth.id;
        const adminRole = req.mwValue.auth.role;
        
        if (adminRole !== 'admin') {
            return res.error(
                httpStatus.FORBIDDEN,
                false,
                "Only admins can create journalist accounts"
            );
        }
        
        // Use multer upload for profile picture
        upload.single('profilePicture')(req, res, async function(err) {
            if (err) {
                console.error('Upload error:', err);
                return res.error(
                    httpStatus.BAD_REQUEST,
                    false,
                    "Error uploading profile picture: " + err.message
                );
            }
            
            try {
                // Extract user data from request body
                const { 
                    username, 
                    email, 
                    password, 
                    confirmPassword,
                    mobile,
                    assignedState,
                    assignedDistrict
                } = req.body;
                
                // Validate required fields
                if (!username || !email || !password || !mobile) {
                    return res.error(
                        httpStatus.BAD_REQUEST,
                        false,
                        "Username, email, password, and mobile are required"
                    );
                }
                
                // Validate password match
                if (password !== confirmPassword) {
                    return res.error(
                        httpStatus.BAD_REQUEST,
                        false,
                        "Passwords do not match"
                    );
                }
                
                // Check if user with email already exists
                const existingUser = await User.findOne({ where: { email } });
                if (existingUser) {
                    return res.error(
                        httpStatus.CONFLICT,
                        false,
                        "User with this email already exists"
                    );
                }
                
                // Check if profile picture is provided
                if (!req.file) {
                    return res.error(
                        httpStatus.BAD_REQUEST,
                        false,
                        "Profile picture is required for journalists"
                    );
                }
                
                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);
                
                // Create user data object
                const userData = {
                    username,
                    email,
                    password: hashedPassword,
                    mobile,
                    role: 'journalist',
                    status: 'active',
                    createdBy: adminId,
                    assignedState: assignedState || null,
                    assignedDistrict: assignedDistrict || null,
                    profilePicture: `/uploads/profiles/${req.file.filename}`
                };
                
                // Create the user
                const newUser = await User.create(userData);
                
                // Remove password from response
                const userResponse = newUser.toJSON();
                delete userResponse.password;
                
                // Send notification to the new user if notification service is available
                try {
                    if (notificationService && typeof notificationService.sendToUsers === 'function') {
                        await notificationService.sendToUsers([newUser.id], 
                            'Account Created', 
                            `Your journalist account has been created by an administrator. Welcome to Newztok!`,
                            {
                                type: 'account_created',
                                userId: newUser.id.toString()
                            }
                        );
                    }
                } catch (notifError) {
                    console.error('Notification error:', notifError);
                    // Continue execution even if notification fails
                }
                
                return res.success(
                    httpStatus.CREATED,
                    true,
                    "Journalist account created successfully",
                    userResponse
                );
                
            } catch (error) {
                console.error('Create journalist error:', error);
                return res.error(
                    httpStatus.INTERNAL_SERVER_ERROR,
                    false,
                    "Error creating journalist account: " + error.message
                );
            }
        });
    } catch (error) {
        console.error('Create journalist outer error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error processing request: " + error.message
        );
    }
};

// Get all rejected news with filtering and pagination
dashboardController.getRejectedNews = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Get filter parameters
        const { category, type, authorId } = req.query;
        
        // Build where clause
        const whereClause = { 
            status: 'rejected'
        };
        
        // Add optional filters
        if (category) whereClause.category = category;
        if (type) whereClause.contentType = type;
        if (authorId) whereClause.journalistId = authorId;
        
        // Get rejected news with pagination
        const { count, rows: news } = await News.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'journalist',  
                    attributes: ['id', 'username', 'assignedState', 'assignedDistrict']
                },
                {
                    model: User,
                    as: 'editor',  
                    attributes: ['id', 'username']
                }
            ],
            order: [['updatedAt', 'DESC']],
            limit,
            offset
        });
        
        // Format the response to match your UI requirements
        const formattedNews = news.map(item => ({
            id: item.id,
            headline: item.title,
            subheadline: item.subtitle || '',
            type: item.contentType,
            category: item.category,
            author: {
                id: item.journalist?.id,
                name: item.journalist?.username,
                location: `${item.journalist?.assignedState || ''}, ${item.journalist?.assignedDistrict || ''}`.trim(),
            },
            rejectedBy: item.editor?.username || 'System',
            rejectionReason: item.rejectionReason || 'No reason provided',
            rejectedAt: item.updatedAt,
            createdAt: item.createdAt
        }));
        
        return res.success(
            httpStatus.OK,
            true,
            "Rejected news fetched successfully",
            {
                total: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                news: formattedNews
            }
        );
    } catch (error) {
        console.error('Get rejected news error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching rejected news",
            error.message
        );
    }
};
  
// Get approved news with pagination
dashboardController.getApprovedNews = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const { count, rows: approvedNews } = await News.findAndCountAll({
            where: { status: 'approved' },
            include: [
                {
                    model: User,
                    as: 'journalist',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'admin',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'editor',
                    attributes: ['id', 'username']
                }
            ],
            // No attributes restriction to get all fields
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: offset
        });

        return res.success(
            httpStatus.OK,
            true,
            "Approved news fetched successfully",
            {
                total: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                posts: approvedNews
            }
        );
    } catch (error) {
        console.error('Get approved news error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching approved news",
            error.message
        );
    }
};
module.exports = dashboardController;