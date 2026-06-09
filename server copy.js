require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

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
// http://localhost:5174/admin-panel/balance

const allowedOrigins = [
  'http://localhost:5173',   // local dev
  'http://localhost:5174',
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
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

start();