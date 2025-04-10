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

    // Filter out users without FCM tokens
    const tokens = users
      .filter(user => user.fcmToken)
      .map(user => user.fcmToken);

    if (tokens.length === 0) {
      console.log('No valid FCM tokens found for the specified users');
      return;
    }

    // Prepare the message
    const message = {
      notification: {
        title,
        body
      },
      data,
      
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
    console.error('Error sending notifications:', error);
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