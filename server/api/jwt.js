const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'freefire-toolkit-secret-key-2024';

/**
 * @route POST /api/jwt/analyze
 * @desc Analyze JWT token
 * @access Public
 */
router.post('/analyze', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'JWT token is required'
      });
    }

    // Split token into parts
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JWT format. Expected 3 parts'
      });
    }

    // Decode header and payload
    let header, payload;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    } catch (decodeError) {
      return res.status(400).json({
        success: false,
        error: 'Failed to decode JWT parts. Invalid Base64 or JSON.'
      });
    }

    // Verify signature (if we have the secret)
    let signatureValid = false;
    let verifyError = null;
    
    if (payload.iss || payload.aud) {
      try {
        // Try to verify with our secret
        jwt.verify(token, JWT_SECRET);
        signatureValid = true;
      } catch (err) {
        verifyError = err.message;
        signatureValid = false;
      }
    }

    // Convert timestamps to readable dates
    const formatTimestamp = (timestamp) => {
      if (!timestamp) return null;
      return {
        unix: timestamp,
        readable: new Date(timestamp * 1000).toISOString(),
        relative: getTimeAgo(timestamp * 1000)
      };
    };

    // Get time ago string
    function getTimeAgo(date) {
      const seconds = Math.floor((new Date() - new Date(date)) / 1000);
      
      let interval = Math.floor(seconds / 31536000);
      if (interval >= 1) return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
      
      interval = Math.floor(seconds / 2592000);
      if (interval >= 1) return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
      
      interval = Math.floor(seconds / 86400);
      if (interval >= 1) return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
      
      interval = Math.floor(seconds / 3600);
      if (interval >= 1) return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
      
      interval = Math.floor(seconds / 60);
      if (interval >= 1) return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
      
      return 'Just now';
    }

    // Calculate token age
    const issuedAt = payload.iat ? formatTimestamp(payload.iat) : null;
    const expiresAt = payload.exp ? formatTimestamp(payload.exp) : null;
    
    let isExpired = false;
    let expiresIn = null;
    
    if (expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      isExpired = payload.exp < now;
      expiresIn = payload.exp - now;
    }

    // Analyze algorithm
    const algorithm = header.alg || 'Unknown';
    const algorithmStrength = {
      'HS256': 'Strong',
      'HS384': 'Strong',
      'HS512': 'Strong',
      'RS256': 'Strong',
      'RS384': 'Strong',
      'RS512': 'Strong',
      'ES256': 'Strong',
      'ES384': 'Strong',
      'ES512': 'Strong',
      'none': 'Insecure'
    }[algorithm] || 'Unknown';

    // Check for common vulnerabilities
    const vulnerabilities = [];
    
    if (algorithm === 'none') {
      vulnerabilities.push('Algorithm "none" - Token can be tampered with');
    }
    
    if (!payload.exp) {
      vulnerabilities.push('No expiration time - Token never expires');
    }
    
    if (expiresIn && expiresIn > 86400 * 365) { // More than 1 year
      vulnerabilities.push('Expiration too far in future - Security risk');
    }
    
    if (payload.iat && payload.exp && (payload.exp - payload.iat > 86400 * 30)) {
      vulnerabilities.push('Token lifetime too long - Consider shorter expiry');
    }

    // Extract claims by category
    const standardClaims = {};
    const publicClaims = {};
    const privateClaims = {};
    
    Object.keys(payload).forEach(key => {
      const value = payload[key];
      
      // Standard claims (RFC 7519)
      const standardClaimKeys = ['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti'];
      if (standardClaimKeys.includes(key)) {
        standardClaims[key] = value;
      } 
      // Common public claims
      else if (['name', 'email', 'picture', 'locale', 'zoneinfo'].includes(key)) {
        publicClaims[key] = value;
      }
      // Private claims
      else {
        privateClaims[key] = value;
      }
    });

    // Response data
    const response = {
      success: true,
      analysis: {
        tokenInfo: {
          algorithm: {
            name: algorithm,
            strength: algorithmStrength
          },
          signature: {
            valid: signatureValid,
            error: verifyError
          },
          expiration: {
            issuedAt,
            expiresAt,
            isExpired,
            expiresInSeconds: expiresIn,
            expiresInReadable: expiresIn ? getTimeAgoFormat(expiresIn) : null
          },
          length: {
            total: token.length,
            header: parts[0].length,
            payload: parts[1].length,
            signature: parts[2].length
          }
        },
        claims: {
          standard: standardClaims,
          public: publicClaims,
          private: privateClaims
        },
        security: {
          vulnerabilities,
          score: calculateSecurityScore(vulnerabilities.length, algorithmStrength),
          recommendations: generateRecommendations(vulnerabilities, algorithm, expiresIn)
        },
        raw: {
          header,
          payload,
          signature: parts[2]
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('JWT Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze JWT token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/jwt/generate
 * @desc Generate JWT token
 * @access Public
 */
router.post('/generate', (req, res) => {
  try {
    const { payload, secret = JWT_SECRET, expiresIn = '24h', algorithm = 'HS256' } = req.body;
    
    if (!payload) {
      return res.status(400).json({
        success: false,
        error: 'Payload is required'
      });
    }

    // Validate algorithm
    const validAlgorithms = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'];
    if (!validAlgorithms.includes(algorithm)) {
      return res.status(400).json({
        success: false,
        error: `Invalid algorithm. Must be one of: ${validAlgorithms.join(', ')}`
      });
    }

    // Generate token
    const token = jwt.sign(payload, secret, {
      expiresIn,
      algorithm
    });

    // Decode to show info
    const decoded = jwt.decode(token, { complete: true });

    res.json({
      success: true,
      token,
      info: {
        algorithm: decoded.header.alg,
        expiresIn,
        payload: decoded.payload
      }
    });

  } catch (error) {
    console.error('JWT Generation Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate JWT token'
    });
  }
});

/**
 * @route POST /api/jwt/verify
 * @desc Verify JWT token
 * @access Public
 */
router.post('/verify', (req, res) => {
  try {
    const { token, secret = JWT_SECRET } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    try {
      const decoded = jwt.verify(token, secret);
      
      res.json({
        success: true,
        valid: true,
        payload: decoded,
        message: 'Token is valid'
      });
      
    } catch (verifyError) {
      res.json({
        success: true,
        valid: false,
        error: verifyError.message,
        message: 'Token is invalid'
      });
    }

  } catch (error) {
    console.error('JWT Verification Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify JWT token'
    });
  }
});

/**
 * @route POST /api/jwt/convert-access-token
 * @desc Convert FreeFire access token to JWT
 * @access Public
 */
router.post('/convert-access-token', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Access token is required'
      });
    }

    // Call FreeFire API to convert access token
    const apiUrl = 'https://api.freefireservice.dnc.su/oauth/account:login';
    
    const response = await axios.get(apiUrl, {
      params: {
        data: accessToken
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (FreeFire Toolkit)',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = response.data;
    
    // Extract JWT from response if available
    let jwtToken = null;
    if (data['8'] || data.access_token) {
      jwtToken = data['8'] || data.access_token;
    }

    res.json({
      success: true,
      data: data,
      jwt: jwtToken,
      hasJwt: !!jwtToken,
      message: jwtToken ? 'JWT token found in response' : 'No JWT token in response'
    });

  } catch (error) {
    console.error('Access Token Conversion Error:', error);
    
    let errorMessage = 'Failed to convert access token';
    let errorDetails = null;
    
    if (error.response) {
      errorMessage = `API error: ${error.response.status}`;
      errorDetails = error.response.data;
    } else if (error.request) {
      errorMessage = 'No response from API server';
    } else {
      errorMessage = error.message;
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    });
  }
});

// Helper functions
function getTimeAgoFormat(seconds) {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months`;
  return `${Math.floor(seconds / 31536000)} years`;
}

function calculateSecurityScore(vulnerabilityCount, algorithmStrength) {
  let score = 100;
  
  // Deduct for vulnerabilities
  score -= vulnerabilityCount * 15;
  
  // Deduct for weak algorithm
  if (algorithmStrength === 'Insecure') score -= 30;
  if (algorithmStrength === 'Unknown') score -= 10;
  
  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, score));
}

function generateRecommendations(vulnerabilities, algorithm, expiresIn) {
  const recommendations = [];
  
  if (algorithm === 'none') {
    recommendations.push('Use a secure algorithm like HS256, RS256, or ES256');
  }
  
  if (vulnerabilities.some(v => v.includes('No expiration'))) {
    recommendations.push('Add expiration time (exp claim) to token');
  }
  
  if (expiresIn > 86400 * 7) { // More than 7 days
    recommendations.push('Consider shorter token expiration (max 7 days recommended)');
  }
  
  if (vulnerabilities.length > 0) {
    recommendations.push('Review and fix all identified vulnerabilities');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Token security appears good. Keep using current configuration.');
  }
  
  return recommendations;
}

module.exports = router;