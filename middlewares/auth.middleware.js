const helpers = require("../utils/helper");
const User = require("../models/user.model");

let authMiddleware = {};

authMiddleware.checkUserAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.error(403, false, "No token provided");
        }

        const token = authHeader.split(' ')[1];
        
        // Use Promise-based token verification
        try {
            const tokenData = await new Promise((resolve, reject) => {
                helpers.verifyToken(token, (err, decoded) => {
                    if (err) reject(err);
                    else resolve(decoded);
                });
            });

            // Get user data from database
            const user = await User.findByPk(tokenData.id);
            if (!user) {
                return res.error(403, false, "User not found");
            }

            // Check if user is active
            if (user.status !== 'active') {
                return res.error(403, false, "Your account is not active. Please contact administrator.");
            }

            // Store both token data and user object
            req.mwValue = {
                auth: tokenData
            };
            req.user = user;
            next();
        } catch (error) {
            console.error('Token verification error:', error);
            return res.error(403, false, "Invalid token");
        }
    } catch (err) {
        console.error('Authentication error:', err);
        return res.error(403, false, "Authentication failed", err.message);
    }
};


authMiddleware.checkRole = (roles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                console.error('Role check failed: No user in request');
                return res.error(403, false, "Authentication required");
            }

            // Convert roles parameter to array if it's not already
            const allowedRoles = Array.isArray(roles) ? roles : [roles];
            
            // Check if user's role is in the allowed roles array
            if (!allowedRoles.includes(req.user.role)) {
                console.error(`Role check failed: User role ${req.user.role} not in allowed roles [${allowedRoles.join(', ')}]`);
                return res.error(403, false, "Access denied. Insufficient privileges");
            }

            // Log successful role check
            console.log(`Role check passed: User ${req.user.id} with role ${req.user.role} accessing ${req.originalUrl}`);
            next();
        } catch (error) {
            console.error('Role verification error:', error);
            return res.error(403, false, "Role verification failed", error.message);
        }
    };
};



module.exports = authMiddleware;
