const express = require("express");
require("dotenv").config();
const sequelize = require("./config/db");
const sendResponse = require("./middlewares/response.middleware");
const handleNotFound = require("./middlewares/notFound.middleware");
const errorHandler = require("./middlewares/errorHandler.middleware");
const authRoutes = require("./routes/auth.routes");
const newsRoutes=require("./routes/news.routes");
require('./models/index');
const seedSuperAdmin=require('./seeders/superAdminSeeder');
const interactionRoutes=require('./routes/interaction.routes');
const userController = require("./controllers/user.controller");
const userRoutes=require('./routes/user.routes');
const versionRoutes = require('./routes/version.routes');
const cors=require('cors');
const path = require('path');

const app = express();
const port = process.env.APP_PORT;
const baseUrl = process.env.BASE_URL;

// CORS configuration .................
app.use(cors({
  origin: '*', // Allow all origins, or specify allowed origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// increase JSON and URL-encoded payload limits............
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(sendResponse);

//  files from uploads directory...............
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//Routes
app.use('/api/auth', authRoutes);
app.use('/api/news',newsRoutes);
app.use('/api/interaction',interactionRoutes);
app.use('/api/users',userRoutes);
app.use('/api/versions',versionRoutes);
app.use(handleNotFound);
app.use(errorHandler);

async function startServer() {
    try {
        //  connect to database
        await sequelize.authenticate();
        console.log('Database connection established successfully.');
        
        // Explicitly require Version model to ensure it's loaded
        const Version = require('./models/version.model');
        
        // sync model 
        try {
            await sequelize.sync({ force: false, alter: false });
            console.log('Database tables synced successfully.');
            
            // Explicitly check and create Version table if it doesn't exist
            try {
                const tableExists = await sequelize.getQueryInterface().showAllTables()
                    .then(tables => tables.map(t => t.toLowerCase()).includes('versions'));
                
                if (!tableExists) {
                    console.log('Version table not found, creating it manually...');
                    await Version.sync({ force: false });
                    console.log('Version table created successfully');
                }
            } catch (versionError) {
                console.error('Error verifying Version table:', versionError);
            }
        } catch (syncError) {
            console.error("Database sync error:", syncError);
            console.log("Continuing server startup despite sync issues...");
        }

        // seed super admin.....................
        try {
            await seedSuperAdmin();
            console.log('Super admin seeded successfully.');
        } catch (seedError) {
            console.error("Super admin seeding error:", seedError);
        }

        // Finally start the server..................
        app.listen(port, () => {
            console.log(`Server running at : ${baseUrl}`);
        });
    } catch (error) {
        console.error("Server startup error:", error);
        process.exit(1); // Exit if startup fails
    }
}

startServer();
