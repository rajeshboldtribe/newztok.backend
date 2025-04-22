const News = require('../models/news.model');
const User = require('../models/user.model');
const httpStatus = require('../enums/httpStatusCode.enum');
const sequelize = require('../config/db');

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
                'id', 'title', 'category', 'contentType', 
                'createdAt', 'state', 'district'
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
        
        // Only allow deletion of journalists and editors
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

module.exports = dashboardController;