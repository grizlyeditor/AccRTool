const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://avatars.githubusercontent.com"],
      connectSrc: ["'self'", "https://*.firebaseio.com", "https://*.googleapis.com"]
    }
  }
}));

// Compression middleware
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'https://yourdomain.com', // Add your domain here
      'https://*.yourdomain.com'
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Import API routes
const jwtRoutes = require('./api/jwt');
const tokenRoutes = require('./api/token');
const base64Routes = require('./api/base64');
const protobufRoutes = require('./api/protobuf');

// API Routes
app.use('/api/jwt', jwtRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/base64', base64Routes);
app.use('/api/protobuf', protobufRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FreeFire Toolkit API Server',
    endpoints: {
      jwt: '/api/jwt',
      token: '/api/token',
      base64: '/api/base64',
      protobuf: '/api/protobuf',
      health: '/health'
    },
    documentation: 'https://docs.yourdomain.com'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
    🚀 FreeFire Toolkit Server started
    📍 Port: ${PORT}
    📅 ${new Date().toLocaleString()}
    🔗 http://localhost:${PORT}
    
    Available Endpoints:
    👤 JWT: http://localhost:${PORT}/api/jwt
    🔑 Token: http://localhost:${PORT}/api/token
    🔧 Base64: http://localhost:${PORT}/api/base64
    📦 Protobuf: http://localhost:${PORT}/api/protobuf
    ❤️ Health: http://localhost:${PORT}/health
    `);
  });
}

module.exports = app;