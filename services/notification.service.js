const admin = require('firebase-admin');
const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const sequelize = require('../config/db');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
    const serviceAccount = require('../config/firebase-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
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
                    [sequelize.Op.not]: null
                }
            },
            attributes: ['id', 'fcmToken']
        });

        if (users.length === 0) {
            console.log('No users with FCM tokens found');
            return { success: false, message: 'No users with FCM tokens found' };
        }

        const tokens = users.map(user => user.fcmToken);
        const validTokens = tokens.filter(token => token && token.length > 0);

        if (validTokens.length === 0) {
            console.log('No valid FCM tokens found');
            return { success: false, message: 'No valid FCM tokens found' };
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

        // Send FCM notifications
        const message = {
            notification: {
                title,
                body
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            tokens: validTokens
        };

        const response = await admin.messaging().sendMulticast(message);
        
        // Handle response and track invalid tokens
        let invalidTokensRemoved = 0;
        
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push({
                        token: validTokens[idx],
                        error: resp.error
                    });
                    
                    // Check if token is invalid
                    if (resp.error.code === 'messaging/invalid-registration-token' || 
                        resp.error.code === 'messaging/registration-token-not-registered') {
                        // Find the user with this token and remove it
                        const userWithToken = users.find(u => u.fcmToken === validTokens[idx]);
                        if (userWithToken) {
                            User.update({ fcmToken: null }, { where: { id: userWithToken.id } });
                            invalidTokensRemoved++;
                        }
                    }
                }
            });
            
            console.log('List of tokens that caused failures:', failedTokens);
        }
        
        return {
            success: true,
            summary: {
                total: validTokens.length,
                successful: response.successCount,
                failed: response.failureCount,
                invalidTokensRemoved
            }
        };
    } catch (error) {
        console.error('Send notification error:', error);
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
                    [sequelize.Op.not]: null
                }
            },
            attributes: ['id', 'fcmToken']
        });

        if (users.length === 0) {
            console.log(`No users with role ${role} and FCM tokens found`);
            return { success: false, message: `No users with role ${role} and FCM tokens found` };
        }

        const userIds = users.map(user => user.id);
        return await notificationService.sendToUsers(userIds, title, body, data);
    } catch (error) {
        console.error('Send notification to role error:', error);
        return { success: false, error: error.message };
    }
};

// Send notification to a single device
notificationService.sendToDevice = async (token, title, body, data = {}) => {
    try {
        if (!token) {
            return { success: false, message: 'No FCM token provided' };
        }

        const message = {
            notification: {
                title,
                body
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            token
        };

        const response = await admin.messaging().send(message);
        return { success: true, messageId: response };
    } catch (error) {
        console.error('Send to device error:', error);
        
        // Check if token is invalid
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
            // Find the user with this token and remove it
            await User.update({ fcmToken: null }, { where: { fcmToken: token } });
            return { 
                success: false, 
                error: error.message, 
                invalidToken: true 
            };
        }
        
        return { success: false, error: error.message };
    }
};

module.exports = notificationService;