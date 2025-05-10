const Notification = require('../models/notification.model');
const httpStatus = require('../enums/httpStatusCode.enum');

const notificationController = {};

// Get all notifications for the current user
notificationController.getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id || req.mwValue?.auth?.id;
        
        // Get all notifications for this user, ordered by creation date (newest first)
        const notifications = await Notification.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']]
        });
        
        return res.success(
            httpStatus.OK,
            true,
            "Notifications fetched successfully",
            notifications
        );
    } catch (error) {
        console.error('Fetch notifications error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching notifications",
            error.message
        );
    }
};

module.exports = notificationController;