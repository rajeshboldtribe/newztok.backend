const admin = require('firebase-admin');
const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const sequelize = require('../config/db');
const { Op } = require('sequelize'); // Add this import for Sequelize operators

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
    try {
        const serviceAccount = require('../config/firebase-service-account.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Firebase initialization error:', error);
        // Continue without Firebase if there's an error
    }
}

const notificationService = {};

// Send notification to specific users
notificationService.sendToUsers = async (userIds, title, body, data = {}) => {
    try {
        // Get FCM tokens for the specified users
        const users = await User.findAll({
            where: {
                id: userIds,
                fcmToken: {
                    [Op.not]: null // Use Op.not instead of sequelize.Op.not
                }
            },
            attributes: ['id', 'fcmToken']
        });

        if (users.length === 0) {
            console.log('No users with FCM tokens found');
            return { success: false, message: 'No users with FCM tokens found' };
        }

        // Store notifications in the database for each user
        const notificationPromises = users.map(user => {
            return Notification.create({
                userId: user.id,
                title,
                message: body,
                type: data.type || 'general',
                data,
                isRead: false
            });
        });

        await Promise.all(notificationPromises);

        // If Firebase is initialized, send FCM notifications
        if (admin.apps.length) {
            const sendPromises = users.map(user => {
                if (!user.fcmToken) return Promise.resolve();
                
                const message = {
                    notification: {
                        title,
                        body
                    },
                    data: {
                        ...data,
                        click_action: 'FLUTTER_NOTIFICATION_CLICK'
                    },
                    token: user.fcmToken
                };
                
                return admin.messaging().send(message)
                    .catch(err => {
                        console.error(`Error sending notification to user ${user.id}:`, err);
                        return null;
                    });
            });
            
            const results = await Promise.all(sendPromises);
            const successfulSends = results.filter(Boolean).length;
            
            return {
                success: true,
                summary: {
                    total: users.length,
                    successful: successfulSends,
                    failed: users.length - successfulSends
                }
            };
        } else {
            // If Firebase is not initialized, just return success for database storage
            return {
                success: true,
                message: 'Notifications stored in database (Firebase not initialized)',
                summary: {
                    total: users.length,
                    successful: 0,
                    failed: 0
                }
            };
        }
    } catch (error) {
        console.error('Send notification error:', error);
        return { success: false, error: error.message };
    }
};

// Simplified version of sendToTopic for testing
notificationService.sendToTopic = async (topic, title, body, data = {}) => {
    try {
        // Store notification in database (without userId since it's topic-based)
        await Notification.create({
            title,
            message: body,
            type: data.type || 'topic',
            data,
            isRead: false
        });

        // If Firebase is initialized, send FCM notification to the topic
        if (admin.apps.length) {
            const message = {
                notification: {
                    title,
                    body
                },
                data: {
                    ...data,
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                },
                topic
            };

            const response = await admin.messaging().send(message);
            
            console.log(`Notification sent to topic ${topic}: ${response}`);
            return { success: true, messageId: response };
        } else {
            return { 
                success: true, 
                message: 'Notification stored in database (Firebase not initialized)'
            };
        }
    } catch (error) {
        console.error('Send to topic error:', error);
        return { success: false, error: error.message };
    }
};

// Send notification to users with a specific role
notificationService.sendToRole = async (role, title, body, data = {}) => {
    try {
        // Get all users with the specified role
        const users = await User.findAll({
            where: { 
                role,
                fcmToken: {
                    [Op.not]: null
                }
            },
            attributes: ['id']
        });
        
        const userIds = users.map(user => user.id);
        
        if (userIds.length === 0) {
            return { success: false, message: `No users with role '${role}' found` };
        }
        
        return await notificationService.sendToUsers(userIds, title, body, data);
    } catch (error) {
        console.error('Send notification to role error:', error);
        return { success: false, error: error.message };
    }
};

// Add this new method to update user token and subscribe to topics
notificationService.updateUserToken = async (userId, fcmToken) => {
    try {
        // Update the user's FCM token
        await User.update({ fcmToken }, { where: { id: userId } });
        
        // Get user details to determine which topics to subscribe to
        const user = await User.findByPk(userId, {
            attributes: ['id', 'role', 'assignedState', 'assignedDistrict']
        });
        
        if (!user) {
            return { success: false, message: 'User not found' };
        }
        
        // If Firebase is initialized, subscribe to relevant topics
        if (admin.apps.length) {
            try {
                // Subscribe to general news updates
                await admin.messaging().subscribeToTopic(fcmToken, 'news_updates');
                
                // Subscribe based on role
                await admin.messaging().subscribeToTopic(fcmToken, `role_${user.role}`);
                
                // Subscribe to location-based topics if available
                if (user.assignedState) {
                    await admin.messaging().subscribeToTopic(fcmToken, `state_${user.assignedState.toLowerCase().replace(/\s+/g, '_')}`);
                }
                
                if (user.assignedDistrict) {
                    await admin.messaging().subscribeToTopic(fcmToken, `district_${user.assignedDistrict.toLowerCase().replace(/\s+/g, '_')}`);
                }
                
                return { 
                    success: true, 
                    message: 'FCM token updated and subscribed to relevant topics' 
                };
            } catch (fcmError) {
                console.error('FCM subscription error:', fcmError);
                return { 
                    success: true, 
                    message: 'FCM token updated but topic subscription failed',
                    error: fcmError.message
                };
            }
        }
        
        return { success: true, message: 'FCM token updated (Firebase not initialized)' };
    } catch (error) {
        console.error('Update user token error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = notificationService;