const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// ✅ IMPORTANT: Serve static files FIRST
app.use(express.static(path.join(__dirname, '..')));

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

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

// ✅ Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dashboard.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

// Serve CSS and JS
app.get('/css/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'css', req.params.file));
});

app.get('/js/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'js', req.params.file));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString() 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
