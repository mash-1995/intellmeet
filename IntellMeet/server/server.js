
require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const registerSockets = require('./sockets');
const { notFound, errorHandler } = require('./middleware/error');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Normalize frontend URLs (remove trailing slashes)
const allowedOrigins = (
  process.env.CLIENT_URL || 'http://localhost:3000'
)
  .split(',')
  .map(url => url.trim().replace(/\/+$/, ''));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ''))) {
      return callback(null, true);
    }

    console.error(`CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Socket.IO
const io = new Server(server, {
  cors: corsOptions
});

app.set('io', io);
registerSockets(io);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Rate limiting
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/meetings', require('./routes/meetingRoutes'));
app.use('/api/workspaces', require('./routes/workspaceRoutes'));

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`IntellMeet server running on port ${PORT}`);
      console.log('Allowed frontend origins:', allowedOrigins);
    });
  })
  .catch(error => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });
