const httpStatus = require('../enums/httpStatusCode.enum');
const Version = require('../models/version.model');
const versionController = {};

// Add new version
versionController.addVersion = async (req, res) => {
    try {
        const { 
            android_version,
            android_version_code, 
            ios_version,
            ios_version_code, 
            backend_version, 
            release_date, 
            is_forcefull_update 
        } = req.body;
        
        // Validate required fields
        if (!android_version || !android_version_code || !ios_version || !ios_version_code || !backend_version || !release_date) {
            return res.error(
                httpStatus.BAD_REQUEST,
                false,
                "All version fields, version codes, and release date are required"
            );
        }
        
        // Create new version
        const newVersion = await Version.create({
            android_version,
            android_version_code,
            ios_version,
            ios_version_code,
            backend_version,
            release_date,
            is_forcefull_update: is_forcefull_update || false,
            created_by: req.user.id
        });
        
        return res.success(
            httpStatus.CREATED,
            true,
            "Version added successfully",
            newVersion
        );
    } catch (error) {
        console.error("Error adding version:", error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error adding version"
        );
    }
};

// Get version details
versionController.getVersionDetails = async (req, res) => {
    try {
        // Get the latest version
        const latestVersion = await Version.findOne({
            order: [['createdAt', 'DESC']]
        });
        
        if (!latestVersion) {
            return res.error(
                httpStatus.NOT_FOUND,
                false,
                "No version information found"
            );
        }
        
        return res.success(
            httpStatus.OK,
            true,
            "Version details retrieved successfully",
            latestVersion
        );
    } catch (error) {
        console.error("Error getting version details:", error);
        return res.error(
            httpStatus.INTERNAL_SERVER_ERROR,
            false,
            "Error retrieving version details"
        );
    }
};

module.exports = versionController;