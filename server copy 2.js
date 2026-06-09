require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const axios = require('axios'); // ADD THIS - make sure to install: npm install axios

const { sequelize, initModels } = require('./src/models');
const betRoutes = require('./src/routes/bet.routes');
const footballRoutes = require('./src/routes/football.routes');

const liveRoutes = require('./src/routes/live.routes');
const efootballRoutes = require('./src/routes/efootball.routes');
const tennisRoutes = require('./src/routes/tennis.routes');
const basketballRoutes = require('./src/routes/basketball.routes');

const authRoutes = require('./src/routes/auth.routes');
const { authenticate } = require('./src/middleware/auth.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

/* =========================
   GLOBAL MIDDLEWARES
========================= */

const allowedOrigins = [
  'http://localhost:5173',   // local dev
  'http://localhost:5174',
  'https://harakapay.net'
];
app.use(helmet());
app.use(cors({
  origin: allowedOrigins, 
  methods: ['GET','POST','PATCH','DELETE','PUT'],
  credentials: true
}));

app.use(express.json());

/* =========================
   HARAKAPAY CONFIGURATION
========================= */
const HARAKAPAY_API_KEY = 'hpk_19da3de28153a8b7b2a9a257e7152834bb7a06777c6653d8';
const HARAKAPAY_BASE_URL = 'https://harakapay.net';

// Initiate HarakaPay payment
app.post('/api/harakapay/pay', async (req, res) => {
  try {
    const { phone, amount, description } = req.body;
    
    console.log('💰 HarakaPay payment initiated:', { phone, amount, description });
    
    const response = await axios.post(
      `${HARAKAPAY_BASE_URL}/api/v1/collect`,
      { phone, amount, description },
      { headers: { 'X-API-Key': HARAKAPAY_API_KEY } }
    );
    
    console.log('✅ HarakaPay response:', response.data);
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ HarakaPay error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: error.response?.data || error.message 
    });
  }
});

// Check HarakaPay payment status
app.get('/api/harakapay/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log('🔍 Checking HarakaPay status for order:', orderId);
    
    const response = await axios.get(
      `${HARAKAPAY_BASE_URL}/api/v1/status/${orderId}`,
      { headers: { 'X-API-Key': HARAKAPAY_API_KEY } }
    );
    
    console.log('✅ Status response:', response.data);
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ Status check error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: error.response?.data || error.message 
    });
  }
});

// Optional: Webhook to receive payment notifications from HarakaPay
app.post('/api/harakapay/webhook', async (req, res) => {
  try {
    const paymentData = req.body;
    console.log('📦 HarakaPay webhook received:', paymentData);
    
    // Here you can update your database when payment is confirmed
    // For example, if paymentData.status === 'successful', update user balance
    
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/* =========================
   EXISTING ROUTES
========================= */
app.use('/api/tennis', tennisRoutes);
app.use('/api/efootball', efootballRoutes);
app.use('/api/basketball', basketballRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/football', footballRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/auth', authRoutes);

/* Protected Example Route */
app.get('/api/profile', authenticate, (req, res) => {
  res.json({
    message: 'Protected route',
    user: req.user
  });
});

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
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`💰 HarakaPay API ready at /api/harakapay`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

start();