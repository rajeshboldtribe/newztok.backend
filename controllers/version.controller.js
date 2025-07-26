const db = require('../models');
const Version = db.AppVersion;


//get latest version............
exports.getVersion = async (req, res) => {
try {
const { platform } = req.params; 
const version = await Version.findOne({ where: { platform } });

if (!version) {
  return res.status(404).json({ statusCode: 404, success: false, message: 'Version not found' });
}

return res.status(200).json({ statusCode: 200, success: true, data: { version } });
} catch (error) {
console.error('Error:', error);
return res.status(500).json({ statusCode: 500, success: false, message: 'Internal Server Error' });
}
};


//update app version...................
exports.updateVersion = async (req, res) => {
try {
const { platform, latestVersion, forceUpdate, changeLog } = req.body;

const version = await Version.findOne({ where: { platform } });
if (!version) {
  return res.status(404).json({ statusCode: 404, success: false, message: 'Version not found' });
}

version.latestVersion = latestVersion;
version.forceUpdate = forceUpdate;
version.changeLog = changeLog;
await version.save();

return res.status(200).json({ statusCode: 200, success: true, message: 'Version updated successfully' });
} catch (error) {
console.error('Update Error:', error);
return res.status(500).json({ statusCode: 500, success: false, message: 'Failed to update version' });
}
};