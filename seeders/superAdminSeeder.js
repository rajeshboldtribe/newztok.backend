'use strict';

const bcrypt = require('bcrypt');

async function seedSuperAdmin(queryInterface) {
  const [results] = await queryInterface.sequelize.query(`
    SELECT * FROM users WHERE role = 'super_admin' LIMIT 1;
  `);

  if (results.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('superadmin123', salt);

    await queryInterface.bulkInsert('users', [
      {
        username: 'superadmin',
        email: 'superadmin@newstalk.com',
        password: hashedPassword,
        mobile: '1234567890',
        role: 'super_admin',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    console.log('Super Admin created successfully');
  }
}

//export function directly 
module.exports = (queryInterface = require('../config/db').getQueryInterface()) => 
  seedSuperAdmin(queryInterface);
