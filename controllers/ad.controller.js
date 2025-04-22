const Ad = require('../models/ad.model');
const User = require('../models/user.model');
const httpStatus = require('../enums/httpStatusCode.enum');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db'); 

const adController = {};

// Helper function to ensure upload directory exists
const ensureDirectoryExists = (directory) => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
};

// Create a new ad
adController.createAd = async (req, res) => {
    try {
        const { title, type, platform, redirectUrl, startDate, endDate } = req.body;
        const userId = req.user.id;

        // Validate ad type and platform
        const validTypes = ['banner', 'side', 'card', 'popover'];
        const validPlatforms = ['web', 'mobile'];

        if (!validTypes.includes(type)) {
            return res.error(
                httpStatus.BAD_REQUEST,
                false,
                "Invalid ad type",
                "Type must be one of: banner, side, card, popover"
            );
        }

        if (!validPlatforms.includes(platform)) {
            return res.error(
                httpStatus.BAD_REQUEST,
                false,
                "Invalid platform",
                "Platform must be one of: web, mobile"
            );
        }

        // Validate image dimensions based on ad type
        if (!req.file) {
            return res.error(
                httpStatus.BAD_REQUEST,
                false,
                "Image is required",
                "Please upload an image for the ad"
            );
        }

        // Process and save the image
        const uploadDir = path.join(__dirname, '../uploads/ads');
        ensureDirectoryExists(uploadDir);

        const fileExtension = path.extname(req.file.originalname);
        const fileName = `ad-${type}-${uuidv4()}${fileExtension}`;
        const filePath = path.join(uploadDir, fileName);

        fs.writeFileSync(filePath, req.file.buffer);
        const imageUrl = `/uploads/ads/${fileName}`;

        // Create the ad
        const ad = await Ad.create({
            title,
            type,
            platform,
            imageUrl,
            redirectUrl: redirectUrl || null,
            startDate: startDate || null,
            endDate: endDate || null,
            createdBy: userId
        });

        return res.success(
            httpStatus.CREATED,
            true,
            "Ad created successfully",
            ad
        );
    } catch (error) {
        console.error('Create ad error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error creating ad",
            error.message
        );
    }
};

// Get all ads with optional filtering
adController.getAllAds = async (req, res) => {
    try {
        const { type, platform, isActive } = req.query;
        const filter = {};

        if (type) filter.type = type;
        if (platform) filter.platform = platform;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const ads = await Ad.findAll({
            where: filter,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'creator',
                    attributes: ['id', 'username']
                }
            ]
        });

        return res.success(
            httpStatus.OK,
            true,
            "Ads fetched successfully",
            ads
        );
    } catch (error) {
        console.error('Get ads error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching ads",
            error.message
        );
    }
};

// Get ads by platform and type (for frontend display)
adController.getAdsByPlatformAndType = async (req, res) => {
    try {
        const { platform, type } = req.params;
        const { Op } = require('sequelize'); // Import Sequelize operators directly
        
        const ads = await Ad.findAll({
            where: {
                platform,
                type,
                isActive: true,
                ...(
                    // Only include ads that are currently active based on date range
                    {
                        [Op.or]: [
                            {
                                startDate: { [Op.lte]: new Date() },
                                endDate: { [Op.gte]: new Date() }
                            },
                            {
                                startDate: null,
                                endDate: null
                            }
                        ]
                    }
                )
            },
            order: [['createdAt', 'DESC']]
        });

        return res.success(
            httpStatus.OK,
            true,
            `${platform} ${type} ads fetched successfully`,
            ads
        );
    } catch (error) {
        console.error('Get ads by platform and type error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error fetching ads",
            error.message
        );
    }
};

// Update an ad
adController.updateAd = async (req, res) => {
    try {
        const { adId } = req.params;
        const { title, redirectUrl, isActive, startDate, endDate } = req.body;
        
        const ad = await Ad.findByPk(adId);
        
        if (!ad) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "Ad not found",
                "The specified ad does not exist"
            );
        }
        
        // Update fields
        if (title) ad.title = title;
        if (redirectUrl !== undefined) ad.redirectUrl = redirectUrl;
        if (isActive !== undefined) ad.isActive = isActive;
        if (startDate) ad.startDate = startDate;
        if (endDate) ad.endDate = endDate;
        
        // Update image if provided
        if (req.file) {
            // Delete old image if it exists
            const oldImagePath = path.join(__dirname, '..', ad.imageUrl);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
            
            // Save new image
            const uploadDir = path.join(__dirname, '../uploads/ads');
            ensureDirectoryExists(uploadDir);
            
            const fileExtension = path.extname(req.file.originalname);
            const fileName = `ad-${ad.type}-${uuidv4()}${fileExtension}`;
            const filePath = path.join(uploadDir, fileName);
            
            fs.writeFileSync(filePath, req.file.buffer);
            ad.imageUrl = `/uploads/ads/${fileName}`;
        }
        
        await ad.save();
        
        return res.success(
            httpStatus.OK,
            true,
            "Ad updated successfully",
            ad
        );
    } catch (error) {
        console.error('Update ad error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error updating ad",
            error.message
        );
    }
};

// Delete an ad
adController.deleteAd = async (req, res) => {
    try {
        const { adId } = req.params;
        
        const ad = await Ad.findByPk(adId);
        
        if (!ad) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "Ad not found",
                "The specified ad does not exist"
            );
        }
        
        // Delete image file
        const imagePath = path.join(__dirname, '..', ad.imageUrl);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
        
        // Delete ad from database
        await ad.destroy();
        
        return res.success(
            httpStatus.OK,
            true,
            "Ad deleted successfully",
            { id: adId }
        );
    } catch (error) {
        console.error('Delete ad error:', error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error deleting ad",
            error.message
        );
    }
};

module.exports = adController;