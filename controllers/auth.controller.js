const User = require('../models/user.model');
const{Op}=require('sequelize');
const bcrypt=require('bcrypt');
const jwt = require('jsonwebtoken');
const helpers=require('../utils/helper');
const httpStatus=require('../enums/httpStatusCode.enum');
const authController={};

// Create admin (super_admin only)
authController.createAdmin = async (req, res) => {
    const { username, email, password, mobile } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const admin = await User.create({
            username,
            email,
            password: hashedPassword,
            mobile,
            role: 'admin'
        });

        const adminResponse = admin.toJSON();
        delete adminResponse.password;

        return res.success(
            httpStatus.CREATED,
            true,
            "Admin account created successfully",
            adminResponse
        );
    } catch (error) {
        console.error('Create admin error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error creating admin account",
            error
        );
    }
};

// Create editor (admin only)
authController.createEditor = async (req, res) => {
    const { username, email, password, mobile } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const editor = await User.create({
            username,
            email,
            password: hashedPassword,
            mobile,
            role: 'editor'
        });

        const editorResponse = editor.toJSON();
        delete editorResponse.password;

        return res.success(
            httpStatus.CREATED,
            true,
            "Editor account created successfully",
            editorResponse
        );
    } catch (error) {
        console.error('Create editor error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error creating editor account",
            error
        );
    }
};

// Create journalist (editor only)

const multer = require('multer');
const path = require('path');
const fs = require('fs');

//  storage for profile picture uploads
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

// Create journalist account (for editors)
authController.createJournalist = async (req, res) => {
    try {
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
                
                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);
                
                // Get editor ID from authenticated user
                const editorId = req.user.id || req.mwValue?.auth?.id;
                
                // Create user data object
                const userData = {
                    username,
                    email,
                    password: hashedPassword,
                    mobile,
                    role: 'journalist',
                    status: 'active',
                    createdBy: editorId,
                    assignedState: assignedState || null,
                    assignedDistrict: assignedDistrict || null
                };
                
                // Add profile picture if uploaded
                if (req.file) {
                    userData.profilePicture = `/uploads/profiles/${req.file.filename}`;
                }
                
                // Create the user
                const newUser = await User.create(userData);
                
                // Remove password from response
                const userResponse = newUser.toJSON();
                delete userResponse.password;
                
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

// Public registration (for audience only)
authController.register = async (req, res) => {
    const { username, email, password, mobile } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            mobile,
            role: 'audience'  // Force role to be audience
        });

        const userResponse = user.toJSON();
        delete userResponse.password;

        return res.success(
            httpStatus.CREATED,
            true,
            "User registered successfully",
            userResponse
        );
    } catch (error) {
        console.error('Registration error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error during registration",
            error
        );
    }
};

//login for all(except audience).....................
authController.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.error(
            httpStatus.BAD_REQUEST,
            false,
            "Username and password are required"
        );
    }

    try {
        const user = await User.findOne({ 
            where: { 
                username,
                role: {
                    [Op.in]: ['super_admin', 'admin', 'editor', 'journalist']
                }
            },
            attributes: ['id', 'username', 'email', 'password', 'role', 'status'] 
        });

        if (!user) {
            return res.error(
                httpStatus.UNAUTHORIZED,
                false,
                "Invalid username or password"
            );
        }

        // Check if user is active
        if (user.status !== 'active') {
            return res.error(
                httpStatus.FORBIDDEN,
                false,
                "Your account is not active. Please contact administrator."
            );
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.error(
                httpStatus.UNAUTHORIZED,
                false,
                "Invalid username or password"
            );
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            },
            process.env.APP_SUPER_SECRET_KEY,
            { expiresIn: '24h' }
        );

        return res.success(
            httpStatus.OK,
            true,
            "Login successful",
            { 
                user: user.username, 
                role: user.role,
                token: token 
            }
        );

    } catch (error) {
        console.error('Login error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Internal server error",
            error
        );
    }
};

//login part(only for audience)......................
authController.loginAudience = async (req, res) => {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
        return res.error(
            httpStatus.BAD_REQUEST,
            false,
            "mobileNo and password are required"
        );
    }

    try {
        
        const user = await User.findOne({ 
            where: { mobile } ,
            attributes: ['id', 'mobile', 'password', 'role', 'status'] // Include role and status
        });

        if (!user) {
            console.log('User not found:', mobile);
            return res.error(
                httpStatus.UNAUTHORIZED,
                false,
                "Invalid mobileNo or password"
            );
        }
        

        // Change to use bcrypt.compare instead of helpers.hash
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.error(
                httpStatus.UNAUTHORIZED,
                false,
                "Invalid username or password"
            );
        }

        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            },
            process.env.APP_SUPER_SECRET_KEY,
            { expiresIn: '24h' }
        );

        return res.success(
            httpStatus.OK,
            true,
            "Login successful",
            { 
                user: user.username, 
                role: user.role,
                token: token 
            }
        );

    } catch (error) {
        console.error('Login error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Internal server error",
            error
        );
    }
};

// Get user profile
authController.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id || req.mwValue?.auth?.id;
        
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] }
        });
        
        if (!user) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "User not found"
            );
        }
        
        return res.success(
            httpStatus.OK,
            true,
            "User profile fetched successfully",
            user
        );
    } catch (error) {
        console.error('Get profile error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching user profile: " + error.message
        );
    }
};


// Update user profile
authController.updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id || req.mwValue?.auth?.id;
        const { username, mobile, email } = req.body;
        
        // Find the user
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "User not found"
            );
        }
        
        // Prepare update data
        const updateData = {};
        
        if (username) updateData.username = username;
        if (mobile) updateData.mobile = mobile;
        if (email) updateData.email = email;
        
        // Check if email is being changed and already exists
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return res.error(
                    httpStatus.CONFLICT,
                    false,
                    "Email already in use by another account"
                );
            }
        }
        
        // Check if mobile is being changed and already exists
        if (mobile && mobile !== user.mobile) {
            const existingUser = await User.findOne({ where: { mobile } });
            if (existingUser) {
                return res.error(
                    httpStatus.CONFLICT,
                    false,
                    "Mobile number already in use by another account"
                );
            }
        }
        
        // Update user
        await user.update(updateData);
        
        // Get updated user
        const updatedUser = await User.findByPk(userId, {
            attributes: { exclude: ['password'] }
        });
        
        return res.success(
            httpStatus.OK,
            true,
            "Profile updated successfully",
            updatedUser
        );
    } catch (error) {
        console.error('Update profile error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error updating profile: " + error.message
        );
    }
};

//logOut controller...............

authController.logout = async (req, res) => {
    try {    
        return res.success(
            httpStatus.OK,
            true,
            "Logged out successfully"
        );
    } catch (error) {
        console.error('Logout error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Internal server error",
            error
        );
    }
};




module.exports = authController;