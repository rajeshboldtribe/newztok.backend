const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Version = sequelize.define('Version', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    android_version: {
        type: DataTypes.STRING,
        allowNull: false
    },
    android_version_code: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    ios_version: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ios_version_code: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    backend_version: {
        type: DataTypes.STRING,
        allowNull: false
    },
    release_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    is_forcefull_update: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Users',
            key: 'id'
        }
    }
}, {
    timestamps: true
});

module.exports = Version;