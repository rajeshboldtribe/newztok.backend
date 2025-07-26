module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.bulkInsert('AppVersions', [
            {
                platform: 'android',
                latestVersion: '1.0.0',
                forceUpdate: false,
                changeLog: 'Initial release of Android app',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                platform: 'ios',
                latestVersion: '1.0.0',
                forceUpdate: false,
                changeLog: 'Initial release of iOS app',
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        ], {});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('AppVersions', {
            platform: ['android', 'ios']
        }, {});
    }
};