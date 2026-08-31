// server.js 

require('dotenv').config();

const express = require('express');
const http = require('http'); 
const { Server } = require('socket.io'); 
const helmet = require('helmet');
const cors = require('cors');
const { startMatchCronJob, processMatchesLifecycle } = require('./src/cronJobs/match/matchEngine.cron');

const GlobalExceptionsHandler = require('./src/middleware/globalExceptionHandler');
const { sequelize, initModels } = require('./src/models');

// Import routes
const authRoutes = require('./src/routes/auth/auth.routes');
const bookingCodeRoutes = require('./src/routes/bookingCode/bookingCode.routes');
const betRoutes = require('./src/routes/bet/bet.routes');
const moneyRoute = require('./src/routes/money/money.route');
const rewardRoutes = require('./src/routes/reward/dailyReward.routes');
const adminDepositRoutes = require('./src/routes/admin/adminDeposit.routes');
const adminUserRoutes = require('./src/routes/admin/adminUser.routes');
const matchRoute = require('./src/routes/match/match.routes');
const notificationRoutes = require('./src/routes/notification/notification.routes');
const depositRoutes = require('./src/routes/deposit/deposit.routes');
const notificationService = require('./src/services/notification/notification.service');
const fcmService = require('./src/services/fcm/fcm.service');
const { verifyAccessToken } = require('./src/utils/jwt');

const app = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

/* =========================
   GLOBAL MIDDLEWARES
========================= */

app.set('trust proxy', 1);

// Helmet Configuration
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false
    })
);

// Dynamic CORS Configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://169.58.22.120',
    'https://sunbeting.com',
    'https://www.sunbeting.com'
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || origin.endsWith('.sunbeting.com')) {
            return callback(null, true);
        }
        console.error(`❌ CORS Blocked Origin: ${origin}`);
        return callback(new Error('CORS Not Allowed'), false);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json());

/* =========================
   SOCKET.IO CONFIGURATION
========================= */

const io = new Server(server, {
    cors: corsOptions
});

notificationService.initNotificationService(io);

// Event listener pale client (Vue/React/Mobile) anapoconnect
io.on('connection', (socket) => {
    console.log(`⚡ New WebSocket Client Connected: ${socket.id}`);

    // Join room `user:<id>` kama token ipo (real-time notifications kwa mteja)
    try {
        const token = socket.handshake.auth?.token;
        if (token) {
            const decoded = verifyAccessToken(token);
            if (decoded && decoded.id) {
                socket.join(`user:${decoded.id}`);
                console.log(`🔔 Joined notifications room: user:${decoded.id}`);
            }
        }
    } catch (err) {
        // si lazima - tuendelee bila room
    }

    socket.on('disconnect', () => {
        console.log(` Client Disconnected: ${socket.id}`);
    });
});

/* =========================
   ROUTES
========================= */

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Auth & Operational Routes
app.use('/api/auth', authRoutes);
app.use('/api/bet', betRoutes);
app.use('/api/code', bookingCodeRoutes);
app.use('/api/match', matchRoute);
app.use('/api/money', moneyRoute);
app.use('/api/reward', rewardRoutes);
app.use('/api/user', adminUserRoutes);
app.use('/api/admin', adminDepositRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/deposit', depositRoutes);

/* =========================
   GLOBAL ERROR HANDLER (MWISHO)
========================= */
app.use(GlobalExceptionsHandler);

/* =========================
   START SERVER
========================= */
const start = async () => {
    try {
        await sequelize.authenticate();
        console.log(' Database connected successfully');

        await initModels();
        console.log(' Database models synchronized');

        await fcmService.initFcm();

        server.listen(PORT, () => {
            console.log(` Server running on port ${PORT}`);

            startMatchCronJob(io);
            console.log(' Match Engine Cron Job & WebSockets initialized successfully');
        });

    } catch (error) {
        console.error(' Failed to start server:', error.message);
        process.exit(1);
    }
};

start();