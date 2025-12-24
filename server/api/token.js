const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// FreeFire API Configuration
const FREEFIRE_API_CONFIG = {
  baseURL: 'https://100067.connect.garena.com',
  clientId: '100067',
  clientSecret: '2ee44819e9b4598845141067b281621874d0d5d7af9d8f7e00c1e54715b7d1e3',
  userAgent: 'Mozilla/5.0 (Linux; Android 9; SM-G965F) AppleWebKit/537.36',
  timeout: 15000
};

/**
 * @route POST /api/token/generate
 * @desc Generate FreeFire access token from UID and Password
 * @access Public
 */
router.post('/generate', async (req, res) => {
  try {
    const { uid, password } = req.body;
    
    if (!uid || !password) {
      return res.status(400).json({
        success: false,
        error: 'UID and Password are required'
      });
    }

    // Validate UID format (FreeFire UIDs are usually numeric)
    if (!/^\d+$/.test(uid)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid UID format. UID should be numeric.'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Prepare request data
    const formData = new URLSearchParams();
    formData.append('uid', uid);
    formData.append('password', password);
    formData.append('response_type', 'token');
    formData.append('client_type', '2');
    formData.append('client_secret', FREEFIRE_API_CONFIG.clientSecret);
    formData.append('client_id', FREEFIRE_API_CONFIG.clientId);

    // Prepare headers
    const headers = {
      'Host': '100067.connect.garena.com',
      'User-Agent': FREEFIRE_API_CONFIG.userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'close',
      'Accept': 'application/json',
      'X-Request-ID': uuidv4()
    };

    // Make API request
    const response = await axios.post(
      `${FREEFIRE_API_CONFIG.baseURL}/oauth/guest/token/grant`,
      formData.toString(),
      {
        headers,
        timeout: FREEFIRE_API_CONFIG.timeout,
        validateStatus: function (status) {
          return status < 500; // Resolve only if the status code is less than 500
        }
      }
    );

    // Handle different response statuses
    if (response.status === 200) {
      const data = response.data;
      
      // Validate response structure
      if (!data.access_token || !data.open_id) {
        throw new Error('Invalid response from FreeFire API');
      }

      // Generate additional metadata
      const tokenInfo = {
        tokenType: data.token_type || 'Bearer',
        expiresIn: data.expires_in || 28800, // 8 hours default
        scope: data.scope || 'basic',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (data.expires_in * 1000)).toISOString()
      };

      // Calculate token strength
      const tokenStrength = calculateTokenStrength(data.access_token);

      // Create secure response (mask sensitive parts)
      const maskedToken = maskToken(data.access_token);
      const maskedRefreshToken = data.refresh_token ? maskToken(data.refresh_token) : null;

      res.json({
        success: true,
        data: {
          open_id: data.open_id,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_type: data.token_type,
          expires_in: data.expires_in,
          scope: data.scope
        },
        info: {
          ...tokenInfo,
          tokenStrength,
          masked: {
            access_token: maskedToken,
            refresh_token: maskedRefreshToken
          }
        },
        security: {
          recommendations: generateTokenRecommendations(tokenStrength, data.expires_in),
          warnings: checkTokenWarnings(data)
        }
      });

    } else if (response.status === 400) {
      // Bad request - usually invalid credentials
      res.status(400).json({
        success: false,
        error: 'Invalid UID or Password',
        details: response.data
      });
    } else if (response.status === 401) {
      // Unauthorized
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        details: 'Client credentials may be invalid'
      });
    } else if (response.status === 429) {
      // Rate limited
      res.status(429).json({
        success: false,
        error: 'Rate limited',
        details: 'Too many requests. Please try again later.'
      });
    } else {
      // Other errors
      throw new Error(`API returned status ${response.status}`);
    }

  } catch (error) {
    console.error('Token Generation Error:', error);
    
    let errorMessage = 'Failed to generate access token';
    let errorDetails = null;
    let statusCode = 500;
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout. FreeFire API is not responding.';
      statusCode = 504;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Cannot connect to FreeFire API. Check your internet connection.';
      statusCode = 503;
    } else if (error.response) {
      errorMessage = `FreeFire API error: ${error.response.status}`;
      errorDetails = error.response.data;
      statusCode = error.response.status;
    } else if (error.request) {
      errorMessage = 'No response from FreeFire API';
      statusCode = 503;
    } else {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/token/refresh
 * @desc Refresh access token using refresh token
 * @access Public
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    const formData = new URLSearchParams();
    formData.append('grant_type', 'refresh_token');
    formData.append('refresh_token', refresh_token);
    formData.append('client_id', FREEFIRE_API_CONFIG.clientId);
    formData.append('client_secret', FREEFIRE_API_CONFIG.clientSecret);

    const headers = {
      'Host': '100067.connect.garena.com',
      'User-Agent': FREEFIRE_API_CONFIG.userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    };

    const response = await axios.post(
      `${FREEFIRE_API_CONFIG.baseURL}/oauth/token/refresh`,
      formData.toString(),
      { headers, timeout: FREEFIRE_API_CONFIG.timeout }
    );

    if (response.status === 200) {
      res.json({
        success: true,
        data: response.data,
        message: 'Token refreshed successfully'
      });
    } else {
      throw new Error(`Refresh failed with status ${response.status}`);
    }

  } catch (error) {
    console.error('Token Refresh Error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
      details: error.response?.data || error.message
    });
  }
});

/**
 * @route POST /api/token/validate
 * @desc Validate access token
 * @access Public
 */
router.post('/validate', async (req, res) => {
  try {
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'Access token is required'
      });
    }

    // Try to use the token to get user info
    const headers = {
      'Authorization': `Bearer ${access_token}`,
      'User-Agent': FREEFIRE_API_CONFIG.userAgent,
      'Accept': 'application/json'
    };

    const response = await axios.get(
      `${FREEFIRE_API_CONFIG.baseURL}/oauth/userinfo`,
      { headers, timeout: 10000 }
    );

    if (response.status === 200) {
      const isValid = response.data && response.data.open_id;
      
      res.json({
        success: true,
        valid: isValid,
        userInfo: response.data,
        message: isValid ? 'Token is valid' : 'Token returned invalid response'
      });
    } else {
      res.json({
        success: true,
        valid: false,
        error: `Token validation failed with status ${response.status}`,
        message: 'Token appears to be invalid'
      });
    }

  } catch (error) {
    console.error('Token Validation Error:', error);
    
    // If we get 401, token is invalid
    if (error.response?.status === 401) {
      return res.json({
        success: true,
        valid: false,
        message: 'Token is expired or invalid'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to validate token',
      details: error.message
    });
  }
});

/**
 * @route POST /api/token/revoke
 * @desc Revoke access token
 * @access Public
 */
router.post('/revoke', async (req, res) => {
  try {
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'Access token is required'
      });
    }

    const formData = new URLSearchParams();
    formData.append('token', access_token);
    formData.append('client_id', FREEFIRE_API_CONFIG.clientId);
    formData.append('client_secret', FREEFIRE_API_CONFIG.clientSecret);

    const headers = {
      'Host': '100067.connect.garena.com',
      'User-Agent': FREEFIRE_API_CONFIG.userAgent,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const response = await axios.post(
      `${FREEFIRE_API_CONFIG.baseURL}/oauth/token/revoke`,
      formData.toString(),
      { headers, timeout: FREEFIRE_API_CONFIG.timeout }
    );

    res.json({
      success: response.status === 200,
      message: response.status === 200 ? 'Token revoked successfully' : 'Failed to revoke token',
      status: response.status
    });

  } catch (error) {
    console.error('Token Revocation Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke token'
    });
  }
});

/**
 * @route GET /api/token/info
 * @desc Get information about token endpoints
 * @access Public
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    endpoints: {
      generate: {
        method: 'POST',
        path: '/api/token/generate',
        description: 'Generate FreeFire access token from UID and Password',
        required: ['uid', 'password'],
        optional: []
      },
      refresh: {
        method: 'POST',
        path: '/api/token/refresh',
        description: 'Refresh access token using refresh token',
        required: ['refresh_token'],
        optional: []
      },
      validate: {
        method: 'POST',
        path: '/api/token/validate',
        description: 'Validate access token',
        required: ['access_token'],
        optional: []
      },
      revoke: {
        method: 'POST',
        path: '/api/token/revoke',
        description: 'Revoke access token',
        required: ['access_token'],
        optional: []
      }
    },
    security: {
      note: 'All tokens are processed securely. No tokens are stored on our servers.',
      encryption: 'All communications are encrypted using HTTPS',
      storage: 'Tokens are only kept in memory during processing'
    }
  });
});

// Helper functions
function calculateTokenStrength(token) {
  if (!token) return 'Unknown';
  
  const length = token.length;
  const entropy = calculateEntropy(token);
  
  if (length >= 256 && entropy > 4.5) return 'Very Strong';
  if (length >= 128 && entropy > 4.0) return 'Strong';
  if (length >= 64 && entropy > 3.5) return 'Medium';
  if (length >= 32) return 'Weak';
  return 'Very Weak';
}

function calculateEntropy(str) {
  const len = str.length;
  const freq = {};
  
  for (let i = 0; i < len; i++) {
    const char = str[i];
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  Object.values(freq).forEach(f => {
    const p = f / len;
    entropy -= p * Math.log2(p);
  });
  
  return entropy;
}

function maskToken(token, visibleChars = 4) {
  if (!token || token.length <= visibleChars * 2) return token;
  
  const firstPart = token.substring(0, visibleChars);
  const lastPart = token.substring(token.length - visibleChars);
  const maskedPart = '*'.repeat(token.length - visibleChars * 2);
  
  return `${firstPart}${maskedPart}${lastPart}`;
}

function generateTokenRecommendations(strength, expiresIn) {
  const recommendations = [];
  
  if (strength === 'Very Weak' || strength === 'Weak') {
    recommendations.push('Consider generating a new token with stronger security');
  }
  
  if (expiresIn > 86400 * 30) { // More than 30 days
    recommendations.push('Consider shorter token expiration for better security');
  }
  
  if (expiresIn < 3600) { // Less than 1 hour
    recommendations.push('Token expires too soon. Consider longer expiration if needed.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Token security appears good. No recommendations at this time.');
  }
  
  return recommendations;
}

function checkTokenWarnings(tokenData) {
  const warnings = [];
  
  if (!tokenData.refresh_token) {
    warnings.push('No refresh token provided. Token cannot be refreshed.');
  }
  
  if (tokenData.expires_in < 3600) { // Less than 1 hour
    warnings.push('Token expires in less than 1 hour');
  }
  
  if (tokenData.scope && tokenData.scope.includes('admin')) {
    warnings.push('Token has admin scope. Use with caution.');
  }
  
  return warnings;
}

module.exports = router;