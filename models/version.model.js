const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Document = require('./document.model');

const Version = sequelize.define('Version', {
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  versionNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

Document.hasMany(Version, { onDelete: 'CASCADE' });
Version.belongsTo(Document);

module.exports = Version;
