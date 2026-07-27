// server.js

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const {
    requestLogger,
    errorMiddleware,
    registerGlobalHandlers
} = require('./src/utils/logger');

registerGlobalHandlers();

const { sequelize, initModels } = require('./src/models');

// Import routes
const authRoutes = require('./src/routes/auth/auth.routes');
const accountRoutes = require('./src/routes/financial/money.routes');
const betRoutes = require('./src/routes/bets/bet.routes');
const userRoutes = require('./src/routes/users/user.routes');
const financialRoutes = require('./src/routes/financial/money.routes');
const notificationRoutes = require('./src/routes/notifications/notification.routes');
const bookingCodeRoutes = require('./src/routes/bookingcode/bookingCode.routes');
const selectionRoutes = require('./src/routes/selections/selection.routes');

const app = express();
const PORT = process.env.PORT || 5000;

/* =========================
   GLOBAL MIDDLEWARES
========================= */

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://13.140.157.161',
    'https://sunbeting.com',
    'https://www.sunbeting.com'
];

app.use(requestLogger);
app.use(helmet());
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true
}));
app.use(express.json());

/* =========================
   ROUTES
========================= */

app.use('/api/auth', authRoutes);
app.use('/api/booking-codes', bookingCodeRoutes);
app.use('/api/selections', selectionRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', userRoutes);
app.use('/api/account', accountRoutes);

/* Health Check */
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

/* =========================
   ERROR HANDLING
========================= */

app.use(errorMiddleware);

/* =========================
   START SERVER
========================= */

const start = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');

        await initModels();
        console.log('✅ Database models synchronized');

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

start();