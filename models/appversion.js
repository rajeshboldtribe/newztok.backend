const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AppVersion = sequelize.define('AppVersion', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    platform: {
        type: DataTypes.STRING,
        allowNull: false
    },
    latestVersion: {
        type: DataTypes.STRING
    },
    forceUpdate: {
        type: DataTypes.BOOLEAN
    },
    changeLog: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'AppVersions'  // Explicitly set the table name
});

module.exports = AppVersion;