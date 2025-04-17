const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user.model');
const News = require('./news.model');

const Saved = sequelize.define('saved', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    newsId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: News,
            key: 'id'
        }
    }
}, {
    timestamps: true,
    tableName: 'saved'
});

// Define associations
User.hasMany(Saved, { foreignKey: 'userId' });
Saved.belongsTo(User, { foreignKey: 'userId' });

News.hasMany(Saved, { foreignKey: 'newsId' });
Saved.belongsTo(News, { foreignKey: 'newsId' });

module.exports = Saved;