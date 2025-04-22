const admin = require('firebase-admin');
const User = require('../models/user.model');
const path = require('path');

// Initialize Firebase Admin SDK
try {
  const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
}

const notificationService = {};

// Send notification to specific users by their FCM tokens
notificationService.sendToUsers = async (userIds, title, body, data = {}) => {
  try {
    // Get users with their FCM tokens
    const users = await User.findAll({
      where: { id: userIds },
      attributes: ['id', 'fcmToken']
    });

    console.log(`Found ${users.length} users with IDs:`, userIds);
    
    // Filter out users without FCM tokens
    const tokens = users
      .filter(user => user.fcmToken)
      .map(user => user.fcmToken);

    if (tokens.length === 0) {
      console.log('No valid FCM tokens found for the specified users');
      return { success: false, message: 'No valid FCM tokens found' };
    }

    console.log(`Attempting to send notifications to ${tokens.length} devices`);

    // Prepare the message
    const message = {
      notification: {
        title,
        body
      },
      data,
    };

    // Send messages individually and track results
    const results = [];
    const invalidTokens = [];
    
    for (const token of tokens) {
      try {
        console.log(`Sending notification to token: ${token.substring(0, 10)}...`);
        const result = await admin.messaging().send({
          ...message,
          token: token
        });
        results.push({ token, success: true, result });
      } catch (error) {
        console.error(`Error sending to token ${token.substring(0, 10)}...`, error.code, error.message);
        results.push({ token, success: false, error: error.message });
        
        // If token is invalid, mark it for removal
        if (error.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(token);
        }
      }
    }
    
    // Clean up invalid tokens from the database
    if (invalidTokens.length > 0) {
      console.log(`Removing ${invalidTokens.length} invalid tokens from database`);
      await User.update(
        { fcmToken: null },
        { 
          where: { 
            fcmToken: invalidTokens 
          } 
        }
      );
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Successfully sent ${successCount} messages out of ${tokens.length}`);
    
    return { 
      success: successCount > 0, 
      results,
      summary: {
        total: tokens.length,
        successful: successCount,
        failed: tokens.length - successCount,
        invalidTokensRemoved: invalidTokens.length
      }
    };
  } catch (error) {
    console.error('Error in notification service:', error);
    throw error;
  }
};

// Send notification to users by role
notificationService.sendToRole = async (role, title, body, data = {}) => {
  try {
    // Get all users with the specified role
    const users = await User.findAll({
      where: { role },
      attributes: ['id', 'fcmToken']
    });

    // Filter out users without FCM tokens
    const tokens = users
      .filter(user => user.fcmToken)
      .map(user => user.fcmToken);

    if (tokens.length === 0) {
      console.log(`No valid FCM tokens found for users with role: ${role}`);
      return;
    }

    // Prepare the message
    const message = {
      notification: {
        title,
        body
      },
      data
    };

    // Send messages individually
    const results = await Promise.all(
      tokens.map(token => {
        return admin.messaging().send({
          ...message,
          token: token
        });
      })
    );
    
    console.log(`Successfully sent ${results.length} messages out of ${tokens.length}`);
    return results;
  } catch (error) {
    console.error('Error sending notifications to role:', error);
    throw error;
  }
};

module.exports = notificationService;