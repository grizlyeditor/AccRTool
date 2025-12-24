const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const forge = require('node-forge');
const base64js = require('base64-js');

// Encryption keys for FreeFire (from your script)
const REQ_KEY = Buffer.from('Yg&tc%DEuh6%Zc^8', 'utf-8');
const REQ_IV = Buffer.from('6oyZDr22E3ychjM%', 'utf-8');

/**
 * @route POST /api/base64/decode-response
 * @desc Decode Base64 FreeFire response
 * @access Public
 */
router.post('/decode-response', async (req, res) => {
  try {
    const { base64_string } = req.body;
    
    if (!base64_string) {
      return res.status(400).json({
        success: false,
        error: 'Base64 string is required'
      });
    }

    // Clean the base64 string
    const cleanBase64 = base64_string.trim().replace(/\s/g, '');
    
    // Validate Base64 format
    if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Base64 string format'
      });
    }

    console.log('Starting Base64 Response Decoding...');
    console.log('Input length:', cleanBase64.length);
    
    try {
      // Step 1: Base64 to Binary
      const binaryData = Buffer.from(cleanBase64, 'base64');
      console.log('Binary data length:', binaryData.length);
      
      // Step 2: Try to decode as Protobuf
      let protobufData = null;
      let protobufError = null;
      
      try {
        // This is a simplified version - in production you'd use protobufjs
        protobufData = attemptProtobufDecode(binaryData);
      } catch (protoError) {
        protobufError = protoError.message;
        console.log('Protobuf decoding failed, trying as raw data');
      }
      
      // Step 3: Try to parse as JSON if possible
      let jsonData = null;
      let jsonError = null;
      
      try {
        const textData = binaryData.toString('utf-8');
        jsonData = JSON.parse(textData);
      } catch (jsonParseError) {
        jsonError = jsonParseError.message;
      }
      
      // Step 4: Try to decode as raw text
      let textData = null;
      try {
        textData = binaryData.toString('utf-8');
      } catch (textError) {
        console.log('UTF-8 decoding failed');
      }
      
      // Step 5: Try to decode as hex
      const hexData = binaryData.toString('hex');
      
      // Analyze data type
      const dataType = analyzeDataType(binaryData);
      
      // Create response
      const response = {
        success: true,
        input: {
          original: base64_string,
          cleaned: cleanBase64,
          length: cleanBase64.length
        },
        decoded: {
          binary: {
            length: binaryData.length,
            firstBytes: binaryData.slice(0, 32).toString('hex')
          },
          hex: hexData.substring(0, 100) + (hexData.length > 100 ? '...' : ''),
          text: textData ? textData.substring(0, 500) + (textData.length > 500 ? '...' : '') : null,
          json: jsonData,
          protobuf: protobufData
        },
        analysis: {
          dataType,
          size: binaryData.length,
          isLikelyProtobuf: dataType === 'protobuf',
          isLikelyJson: dataType === 'json',
          isLikelyText: dataType === 'text',
          encodingGuess: guessEncoding(binaryData)
        },
        errors: {
          protobuf: protobufError,
          json: jsonError
        },
        warnings: generateWarnings(binaryData, dataType)
      };
      
      console.log('Decoding completed successfully');
      res.json(response);

    } catch (decodeError) {
      console.error('Decoding error:', decodeError);
      throw new Error(`Decoding failed: ${decodeError.message}`);
    }

  } catch (error) {
    console.error('Base64 Decode Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to decode Base64 response',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/base64/decode-request
 * @desc Decode Base64 FreeFire request (with AES decryption)
 * @access Public
 */
router.post('/decode-request', async (req, res) => {
  try {
    const { base64_string, mode = 'decode' } = req.body;
    
    if (!base64_string) {
      return res.status(400).json({
        success: false,
        error: 'Base64 string is required'
      });
    }

    // Clean the base64 string
    const cleanBase64 = base64_string.trim().replace(/\s/g, '');
    
    // Validate Base64 format
    if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Base64 string format'
      });
    }

    console.log(`Starting Base64 Request ${mode}...`);
    
    if (mode === 'decode') {
      // DECODE MODE
      try {
        // Step 1: Base64 Decode
        const cipherBytes = Buffer.from(cleanBase64, 'base64');
        console.log('Cipher bytes length:', cipherBytes.length);
        
        // Step 2: AES Decrypt
        let decryptedData = null;
        let decryptionError = null;
        
        try {
          decryptedData = aesDecryptCBC(cipherBytes, REQ_KEY, REQ_IV);
          console.log('Decryption successful');
        } catch (decryptError) {
          decryptionError = decryptError.message;
          console.log('AES decryption failed:', decryptError.message);
          
          // Try alternative decryption methods
          decryptedData = attemptAlternativeDecryption(cipherBytes);
        }
        
        // Step 3: Analyze decrypted data
        let analysis = null;
        if (decryptedData) {
          analysis = analyzeDecryptedData(decryptedData);
        }
        
        // Create response
        const response = {
          success: true,
          mode: 'decode',
          input: {
            original: base64_string,
            cleaned: cleanBase64,
            length: cleanBase64.length
          },
          decryption: {
            success: !!decryptedData && !decryptionError,
            error: decryptionError,
            decryptedLength: decryptedData?.length || 0,
            hex: decryptedData ? decryptedData.toString('hex').substring(0, 100) + (decryptedData.length > 50 ? '...' : '') : null,
            text: decryptedData ? decryptedData.toString('utf-8').substring(0, 500) + (decryptedData.length > 250 ? '...' : '') : null
          },
          analysis: analysis,
          raw: {
            base64: cleanBase64,
            cipherHex: cipherBytes.toString('hex').substring(0, 100) + '...'
          }
        };
        
        res.json(response);

      } catch (error) {
        console.error('Decode error:', error);
        throw new Error(`Decoding failed: ${error.message}`);
      }
      
    } else if (mode === 'encode') {
      // ENCODE MODE
      const { hex_string, uid } = req.body;
      
      if (!hex_string && !uid) {
        return res.status(400).json({
          success: false,
          error: 'Either hex_string or uid is required for encode mode'
        });
      }
      
      let rawBytes = null;
      
      if (hex_string) {
        // Convert hex to bytes
        try {
          rawBytes = Buffer.from(hex_string.replace(/\s/g, ''), 'hex');
        } catch (hexError) {
          return res.status(400).json({
            success: false,
            error: 'Invalid hex string format'
          });
        }
      } else if (uid) {
        // Generate Protobuf for UID
        try {
          const uidNum = parseInt(uid);
          if (isNaN(uidNum)) {
            throw new Error('Invalid UID format');
          }
          rawBytes = generateUidProtobuf(uidNum);
        } catch (uidError) {
          return res.status(400).json({
            success: false,
            error: `Invalid UID: ${uidError.message}`
          });
        }
      }
      
      // Encrypt the bytes
      let encryptedBytes = null;
      try {
        encryptedBytes = aesEncryptCBC(rawBytes, REQ_KEY, REQ_IV);
      } catch (encryptError) {
        return res.status(500).json({
          success: false,
          error: `Encryption failed: ${encryptError.message}`
        });
      }
      
      // Convert to Base64
      const finalBase64 = encryptedBytes.toString('base64');
      
      res.json({
        success: true,
        mode: 'encode',
        input: hex_string ? { hex: hex_string } : { uid: uid },
        output: {
          base64: finalBase64,
          length: finalBase64.length
        },
        intermediate: {
          rawHex: rawBytes.toString('hex'),
          rawLength: rawBytes.length
        }
      });
      
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Use "decode" or "encode"'
      });
    }

  } catch (error) {
    console.error('Base64 Request Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Base64 request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/base64/analyze
 * @desc Analyze Base64 string without decoding
 * @access Public
 */
router.post('/analyze', (req, res) => {
  try {
    const { base64_string } = req.body;
    
    if (!base64_string) {
      return res.status(400).json({
        success: false,
        error: 'Base64 string is required'
      });
    }

    const cleanBase64 = base64_string.trim().replace(/\s/g, '');
    const length = cleanBase64.length;
    
    // Calculate padding
    const padding = (cleanBase64.match(/=/g) || []).length;
    
    // Check if valid Base64
    const isValid = /^[A-Za-z0-9+/=]+$/.test(cleanBase64) && length % 4 === 0;
    
    // Estimate original data size
    const estimatedSize = Math.floor(length * 3 / 4) - padding;
    
    // Character frequency analysis
    const charAnalysis = analyzeBase64Characters(cleanBase64);
    
    // Pattern detection
    const patterns = detectPatterns(cleanBase64);
    
    // Likely content type
    const likelyContent = guessContentType(cleanBase64);
    
    res.json({
      success: true,
      analysis: {
        basic: {
          length,
          padding,
          isValid,
          estimatedOriginalSize: estimatedSize
        },
        characters: charAnalysis,
        patterns,
        likelyContent,
        warnings: generateAnalysisWarnings(cleanBase64, patterns)
      },
      sample: {
        first50: cleanBase64.substring(0, 50) + (length > 50 ? '...' : ''),
        last50: length > 50 ? '...' + cleanBase64.substring(length - 50) : cleanBase64
      }
    });

  } catch (error) {
    console.error('Base64 Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze Base64 string'
    });
  }
});

/**
 * @route GET /api/base64/formats
 * @desc Get information about Base64 formats
 * @access Public
 */
router.get('/formats', (req, res) => {
  res.json({
    success: true,
    formats: {
      standard: {
        name: 'Standard Base64',
        charset: 'A-Z, a-z, 0-9, +, /',
        padding: '=',
        description: 'RFC 4648 Base64'
      },
      urlSafe: {
        name: 'URL-safe Base64',
        charset: 'A-Z, a-z, 0-9, -, _',
        padding: 'Optional',
        description: 'Base64 with URL-safe characters'
      },
      freefire: {
        name: 'FreeFire Base64',
        description: 'Base64 encoded AES encrypted data',
        encryption: 'AES-128-CBC',
        key: 'Yg&tc%DEuh6%Zc^8',
        iv: '6oyZDr22E3ychjM%'
      }
    },
    endpoints: {
      decodeResponse: {
        method: 'POST',
        path: '/api/base64/decode-response',
        description: 'Decode Base64 FreeFire response',
        body: { base64_string: 'string' }
      },
      decodeRequest: {
        method: 'POST',
        path: '/api/base64/decode-request',
        description: 'Decode/Encode Base64 FreeFire request',
        body: { 
          base64_string: 'string', 
          mode: 'decode|encode',
          hex_string: 'string (for encode)',
          uid: 'number (for encode)'
        }
      },
      analyze: {
        method: 'POST',
        path: '/api/base64/analyze',
        description: 'Analyze Base64 string',
        body: { base64_string: 'string' }
      }
    }
  });
});

// Helper Functions

function attemptProtobufDecode(data) {
  // Simplified protobuf decoding
  // In production, you would use the actual protobuf definitions
  
  const result = {
    decoded: false,
    fields: [],
    raw: data.toString('hex').substring(0, 100)
  };
  
  // Very basic protobuf field detection
  let position = 0;
  while (position < data.length) {
    const byte = data[position];
    
    // Field number and wire type are in the first byte
    const fieldNumber = byte >> 3;
    const wireType = byte & 0x07;
    
    if (fieldNumber > 0) {
      result.fields.push({
        position,
        fieldNumber,
        wireType,
        wireTypeName: getWireTypeName(wireType)
      });
    }
    
    position++;
    
    // Break after analyzing first few bytes
    if (position > 50) break;
  }
  
  if (result.fields.length > 0) {
    result.decoded = true;
  }
  
  return result;
}

function getWireTypeName(wireType) {
  const types = {
    0: 'VARINT',
    1: '64BIT',
    2: 'LENGTH_DELIMITED',
    3: 'START_GROUP',
    4: 'END_GROUP',
    5: '32BIT'
  };
  return types[wireType] || 'UNKNOWN';
}

function analyzeDataType(data) {
  // Try to determine data type
  
  // Check for JSON
  try {
    const text = data.toString('utf-8');
    JSON.parse(text);
    return 'json';
  } catch {}
  
  // Check for text
  try {
    const text = data.toString('utf-8');
    // If it's mostly printable ASCII, it's text
    const printable = text.replace(/[^\x20-\x7E]/g, '').length;
    if (printable / text.length > 0.8) {
      return 'text';
    }
  } catch {}
  
  // Check for protobuf pattern
  if (data.length > 0) {
    // Protobuf often starts with field numbers
    const firstByte = data[0];
    if ((firstByte & 0x07) === 2 || (firstByte >> 3) > 0) {
      return 'protobuf';
    }
  }
  
  return 'binary';
}

function guessEncoding(data) {
  // Try common encodings
  const encodings = ['utf-8', 'ascii', 'latin1', 'utf16le'];
  
  for (const encoding of encodings) {
    try {
      const text = data.toString(encoding);
      // Check if it looks like valid text
      if (text.length > 0 && !text.includes('�')) {
        return encoding;
      }
    } catch {}
  }
  
  return 'binary';
}

function generateWarnings(data, dataType) {
  const warnings = [];
  
  if (data.length === 0) {
    warnings.push('Empty data');
  }
  
  if (data.length > 1024 * 1024) { // 1MB
    warnings.push('Large data size may indicate incorrect decoding');
  }
  
  if (dataType === 'binary' && data.length < 10) {
    warnings.push('Very small binary data');
  }
  
  return warnings;
}

function aesDecryptCBC(cipherBytes, key, iv) {
  try {
    const cipher = forge.cipher.createDecipher('AES-CBC', key.toString('binary'));
    cipher.start({ iv: iv.toString('binary') });
    cipher.update(forge.util.createBuffer(cipherBytes.toString('binary')));
    cipher.finish();
    
    const decrypted = cipher.output.getBytes();
    return Buffer.from(decrypted, 'binary');
  } catch (error) {
    console.error('AES Decrypt Error:', error);
    throw error;
  }
}

function aesEncryptCBC(dataBytes, key, iv) {
  try {
    const cipher = forge.cipher.createCipher('AES-CBC', key.toString('binary'));
    cipher.start({ iv: iv.toString('binary') });
    cipher.update(forge.util.createBuffer(dataBytes.toString('binary')));
    cipher.finish();
    
    const encrypted = cipher.output.getBytes();
    return Buffer.from(encrypted, 'binary');
  } catch (error) {
    console.error('AES Encrypt Error:', error);
    throw error;
  }
}

function attemptAlternativeDecryption(cipherBytes) {
  // Try different decryption methods
  const methods = [
    () => {
      // Try without padding
      const cipher = forge.cipher.createDecipher('AES-CBC', REQ_KEY.toString('binary'));
      cipher.start({ iv: REQ_IV.toString('binary') });
      cipher.update(forge.util.createBuffer(cipherBytes.toString('binary')));
      
      if (cipher.finish()) {
        return Buffer.from(cipher.output.getBytes(), 'binary');
      }
      throw new Error('Decryption failed');
    }
  ];
  
  for (const method of methods) {
    try {
      return method();
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

function analyzeDecryptedData(data) {
  const analysis = {
    length: data.length,
    hexPrefix: data.toString('hex').substring(0, 20),
    likelyType: 'unknown'
  };
  
  // Check for protobuf
  if (data.length > 0 && (data[0] & 0x07) === 2) {
    analysis.likelyType = 'protobuf';
  }
  
  // Check for text
  try {
    const text = data.toString('utf-8');
    if (text.length > 0 && !text.includes('�')) {
      analysis.likelyType = 'text';
      analysis.textPreview = text.substring(0, 100);
    }
  } catch {}
  
  return analysis;
}

function generateUidProtobuf(uid) {
  // Simple protobuf encoding for UID (field 1)
  const bytes = [];
  
  // Field number 1, wire type VARINT (0)
  bytes.push(0x08);
  
  // Encode UID as varint
  let n = uid;
  while (n > 0x7F) {
    bytes.push((n & 0x7F) | 0x80);
    n >>= 7;
  }
  bytes.push(n);
  
  return Buffer.from(bytes);
}

function analyzeBase64Characters(str) {
  const total = str.length;
  const counts = {
    uppercase: (str.match(/[A-Z]/g) || []).length,
    lowercase: (str.match(/[a-z]/g) || []).length,
    digits: (str.match(/[0-9]/g) || []).length,
    plus: (str.match(/\+/g) || []).length,
    slash: (str.match(/\//g) || []).length,
    equals: (str.match(/=/g) || []).length
  };
  
  const percentages = {};
  Object.keys(counts).forEach(key => {
    percentages[key] = ((counts[key] / total) * 100).toFixed(2) + '%';
  });
  
  return {
    counts,
    percentages,
    entropy: calculateStringEntropy(str)
  };
}

function calculateStringEntropy(str) {
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
  
  return entropy.toFixed(2);
}

function detectPatterns(str) {
  const patterns = [];
  
  // Check for repeated patterns
  for (let patternLength = 2; patternLength <= 10; patternLength++) {
    if (str.length < patternLength * 3) break;
    
    const pattern = str.substring(0, patternLength);
    let matches = 0;
    
    for (let i = patternLength; i <= str.length - patternLength; i += patternLength) {
      if (str.substring(i, i + patternLength) === pattern) {
        matches++;
      } else {
        break;
      }
    }
    
    if (matches >= 2) {
      patterns.push({
        length: patternLength,
        pattern,
        occurrences: matches + 1,
        confidence: 'high'
      });
    }
  }
  
  // Check for common prefixes/suffixes
  const commonPrefixes = ['eyJ', 'AAA', 'UEs', 'R0lG', 'iVBOR'];
  const commonSuffixes = ['==', 'QD4=', 'AAA='];
  
  commonPrefixes.forEach(prefix => {
    if (str.startsWith(prefix)) {
      patterns.push({
        type: 'common_prefix',
        value: prefix,
        meaning: prefix === 'eyJ' ? 'JWT token' : 
                 prefix === 'AAA' ? 'Common padding' :
                 prefix === 'UEs' ? 'Zip file' :
                 prefix === 'R0lG' ? 'GIF image' :
                 prefix === 'iVBOR' ? 'PNG image' : 'Unknown'
      });
    }
  });
  
  commonSuffixes.forEach(suffix => {
    if (str.endsWith(suffix)) {
      patterns.push({
        type: 'common_suffix',
        value: suffix,
        meaning: 'Padding or specific format'
      });
    }
  });
  
  return patterns;
}

function guessContentType(str) {
  // Based on patterns and characteristics
  
  if (str.startsWith('eyJ')) {
    return { type: 'jwt', confidence: 'high' };
  }
  
  if (str.includes('PD94bW')) {
    return { type: 'xml', confidence: 'medium' };
  }
  
  if (str.startsWith('R0lG')) {
    return { type: 'gif', confidence: 'high' };
  }
  
  if (str.startsWith('iVBOR')) {
    return { type: 'png', confidence: 'high' };
  }
  
  if (str.startsWith('/9j/')) {
    return { type: 'jpeg', confidence: 'high' };
  }
  
  // Check if it looks like encrypted data
  const entropy = calculateStringEntropy(str);
  if (parseFloat(entropy) > 5.5) {
    return { type: 'encrypted', confidence: 'medium' };
  }
  
  return { type: 'unknown', confidence: 'low' };
}

function generateAnalysisWarnings(str, patterns) {
  const warnings = [];
  
  if (str.length % 4 !== 0) {
    warnings.push('Base64 length not multiple of 4 - may have padding issues');
  }
  
  if ((str.match(/=/g) || []).length > 2) {
    warnings.push('Too many padding characters - may be invalid');
  }
  
  if (str.includes(' ') || str.includes('\n') || str.includes('\t')) {
    warnings.push('Contains whitespace - may need cleaning');
  }
  
  if (patterns.some(p => p.type === 'common_prefix' && p.value === 'eyJ')) {
    warnings.push('Appears to be a JWT token - contains sensitive information');
  }
  
  return warnings;
}

module.exports = router;