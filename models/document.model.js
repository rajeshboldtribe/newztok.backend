const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Document = sequelize.define('Document', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = Document;
