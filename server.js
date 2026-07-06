// ServiceWorkerRegistration.js 

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

//booking code endpoint
const bookingCodeRoutes = require('./src/routes/bookingCode.routes');

const authRoutes = require('./src/routes/auth/auth.routes');
const account = require('./src/routes/financial/money.routes')
const bets = require('./src/routes/bets/bet.routes')
const users = require('./src/routes/users/user.routes')
const financial = require('./src/routes/financial/money.routes')

// Import routes
const notificationRoutes = require('./src/routes/notifications/notification.routes');

const { authenticate } = require('./src/middleware/auth.middleware');

const app = express();

app.use(requestLogger);

app.use(requestLogger);

/* routes */

app.use(errorMiddleware);
const PORT = process.env.PORT || 5000;

/* =========================
   GLOBAL MIDDLEWARES
========================= */


const allowedOrigins = [
  'http://localhost:5173',   // local dev
  'http://localhost:5174',
  'http://13.140.157.161',
  'https://sunbeting.com'
 
];
app.use(helmet());
app.use(cors({
  origin: allowedOrigins, 
  
  methods: ['GET','POST','PATCH','DELETE','PUT'],
  credentials: true
}));

app.use(express.json());

/* =========================
   ROUTES
========================= */
app.use('/api/admin', users);
app.use('/api/account', account);
app.use('/api/bets', bets);
app.use('/api/auth', authRoutes);
app.use('/api/financial', financial)
app.use('/api/notifications', notificationRoutes);
app.use('/api/booking-codes', bookingCodeRoutes);

/* Health Check */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

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
        // logServerStart(PORT);
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

start();