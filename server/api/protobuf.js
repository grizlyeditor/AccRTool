const express = require('express');
const router = express.Router();
const protobuf = require('protobufjs');
const crypto = require('crypto');

// FreeFire Protobuf Definitions
const FREEFIRE_PROTO_DEFINITIONS = `
syntax = "proto3";

package freefire;

message LoginRequest {
  string uid = 1;
  string password = 2;
  string client_type = 3;
  string client_secret = 4;
  string client_id = 5;
}

message LoginResponse {
  string open_id = 1;
  string access_token = 2;
  string token_type = 3;
  int32 expires_in = 4;
  string refresh_token = 5;
  string scope = 6;
}

message UserInfo {
  string open_id = 1;
  string nickname = 2;
  string avatar = 3;
  int32 level = 4;
  int32 exp = 5;
  string region = 6;
  string language = 7;
}

message GameData {
  int32 kills = 1;
  int32 deaths = 2;
  int32 assists = 3;
  double kd_ratio = 4;
  int32 matches_played = 5;
  int32 matches_won = 6;
  double win_rate = 7;
  int32 rank_points = 8;
  string rank_tier = 9;
}

message ApiRequest {
  string endpoint = 1;
  map<string, string> headers = 2;
  bytes body = 3;
  string method = 4;
  int64 timestamp = 5;
}

message ApiResponse {
  int32 status = 1;
  map<string, string> headers = 2;
  bytes body = 3;
  string error = 4;
  int64 timestamp = 5;
}

message EncryptedData {
  bytes iv = 1;
  bytes ciphertext = 2;
  bytes tag = 3;
  string algorithm = 4;
}

message BatchRequest {
  repeated ApiRequest requests = 1;
  bool parallel = 2;
  int32 timeout = 3;
}

message BatchResponse {
  repeated ApiResponse responses = 1;
  int64 total_time = 2;
  bool success = 3;
}
`;

// Load protobuf definitions
let freefireRoot = null;

try {
  freefireRoot = protobuf.Root.fromJSON({
    nested: {
      freefire: {
        nested: {
          LoginRequest: {
            fields: {
              uid: { type: "string", id: 1 },
              password: { type: "string", id: 2 },
              client_type: { type: "string", id: 3 },
              client_secret: { type: "string", id: 4 },
              client_id: { type: "string", id: 5 }
            }
          },
          LoginResponse: {
            fields: {
              open_id: { type: "string", id: 1 },
              access_token: { type: "string", id: 2 },
              token_type: { type: "string", id: 3 },
              expires_in: { type: "int32", id: 4 },
              refresh_token: { type: "string", id: 5 },
              scope: { type: "string", id: 6 }
            }
          },
          UserInfo: {
            fields: {
              open_id: { type: "string", id: 1 },
              nickname: { type: "string", id: 2 },
              avatar: { type: "string", id: 3 },
              level: { type: "int32", id: 4 },
              exp: { type: "int32", id: 5 },
              region: { type: "string", id: 6 },
              language: { type: "string", id: 7 }
            }
          },
          GameData: {
            fields: {
              kills: { type: "int32", id: 1 },
              deaths: { type: "int32", id: 2 },
              assists: { type: "int32", id: 3 },
              kd_ratio: { type: "double", id: 4 },
              matches_played: { type: "int32", id: 5 },
              matches_won: { type: "int32", id: 6 },
              win_rate: { type: "double", id: 7 },
              rank_points: { type: "int32", id: 8 },
              rank_tier: { type: "string", id: 9 }
            }
          },
          ApiRequest: {
            fields: {
              endpoint: { type: "string", id: 1 },
              headers: { type: "map<string, string>", id: 2 },
              body: { type: "bytes", id: 3 },
              method: { type: "string", id: 4 },
              timestamp: { type: "int64", id: 5 }
            }
          },
          ApiResponse: {
            fields: {
              status: { type: "int32", id: 1 },
              headers: { type: "map<string, string>", id: 2 },
              body: { type: "bytes", id: 3 },
              error: { type: "string", id: 4 },
              timestamp: { type: "int64", id: 5 }
            }
          },
          EncryptedData: {
            fields: {
              iv: { type: "bytes", id: 1 },
              ciphertext: { type: "bytes", id: 2 },
              tag: { type: "bytes", id: 3 },
              algorithm: { type: "string", id: 4 }
            }
          },
          BatchRequest: {
            fields: {
              requests: { type: "ApiRequest", id: 1, rule: "repeated" },
              parallel: { type: "bool", id: 2 },
              timeout: { type: "int32", id: 3 }
            }
          },
          BatchResponse: {
            fields: {
              responses: { type: "ApiResponse", id: 1, rule: "repeated" },
              total_time: { type: "int64", id: 2 },
              success: { type: "bool", id: 3 }
            }
          }
        }
      }
    }
  });
  
  console.log('Protobuf definitions loaded successfully');
} catch (error) {
  console.error('Failed to load protobuf definitions:', error);
}

/**
 * @route POST /api/protobuf/decode
 * @desc Decode protobuf message
 * @access Public
 */
router.post('/decode', async (req, res) => {
  try {
    const { hex_data, message_type = 'ApiResponse', base64_data } = req.body;
    
    if (!hex_data && !base64_data) {
      return res.status(400).json({
        success: false,
        error: 'Either hex_data or base64_data is required'
      });
    }

    // Convert input to buffer
    let buffer;
    if (hex_data) {
      try {
        buffer = Buffer.from(hex_data.replace(/\s/g, ''), 'hex');
      } catch (hexError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid hex string format'
        });
      }
    } else if (base64_data) {
      try {
        buffer = Buffer.from(base64_data, 'base64');
      } catch (base64Error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid base64 string format'
        });
      }
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Empty data provided'
      });
    }

    console.log(`Decoding protobuf message (type: ${message_type}, length: ${buffer.length} bytes)`);

    // Get message type
    let MessageType;
    try {
      MessageType = freefireRoot.lookupType(`freefire.${message_type}`);
      if (!MessageType) {
        throw new Error(`Message type '${message_type}' not found`);
      }
    } catch (lookupError) {
      return res.status(400).json({
        success: false,
        error: `Invalid message type: ${lookupError.message}`,
        available_types: getAvailableMessageTypes()
      });
    }

    // Decode the message
    let decodedMessage;
    try {
      decodedMessage = MessageType.decode(buffer);
    } catch (decodeError) {
      // Try to decode as raw protobuf without specific type
      return attemptRawDecode(buffer, res);
    }

    // Convert to plain object
    const plainObject = MessageType.toObject(decodedMessage, {
      longs: String,
      enums: String,
      bytes: String,
      defaults: true,
      arrays: true,
      objects: true
    });

    // Analyze the message
    const analysis = analyzeProtobufMessage(decodedMessage, MessageType, buffer);

    // Format bytes fields for display
    const formattedObject = formatBytesFields(plainObject);

    res.json({
      success: true,
      input: {
        type: message_type,
        length: buffer.length,
        hex: buffer.toString('hex').substring(0, 100) + (buffer.length > 50 ? '...' : ''),
        base64: buffer.toString('base64')
      },
      decoded: formattedObject,
      analysis,
      raw: {
        buffer: buffer.toString('hex'),
        base64: buffer.toString('base64')
      }
    });

  } catch (error) {
    console.error('Protobuf Decode Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to decode protobuf message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/protobuf/encode
 * @desc Encode data to protobuf
 * @access Public
 */
router.post('/encode', async (req, res) => {
  try {
    const { message_type = 'LoginRequest', data } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data object is required'
      });
    }

    console.log(`Encoding protobuf message (type: ${message_type})`);

    // Get message type
    let MessageType;
    try {
      MessageType = freefireRoot.lookupType(`freefire.${message_type}`);
      if (!MessageType) {
        throw new Error(`Message type '${message_type}' not found`);
      }
    } catch (lookupError) {
      return res.status(400).json({
        success: false,
        error: `Invalid message type: ${lookupError.message}`,
        available_types: getAvailableMessageTypes()
      });
    }

    // Verify the data
    const verifyError = MessageType.verify(data);
    if (verifyError) {
      return res.status(400).json({
        success: false,
        error: `Data verification failed: ${verifyError}`,
        required_fields: getMessageFields(MessageType)
      });
    }

    // Create message instance
    const message = MessageType.create(data);

    // Encode to buffer
    const buffer = MessageType.encode(message).finish();

    // Create analysis
    const analysis = {
      encodedSize: buffer.length,
      fieldCount: Object.keys(data).length,
      estimatedWireSize: calculateWireSize(message, MessageType)
    };

    res.json({
      success: true,
      output: {
        hex: buffer.toString('hex'),
        base64: buffer.toString('base64'),
        length: buffer.length
      },
      input: {
        type: message_type,
        data: data
      },
      analysis,
      download: {
        hex_url: `data:application/octet-stream;base64,${Buffer.from(buffer.toString('hex')).toString('base64')}`,
        raw_url: `data:application/octet-stream;base64,${buffer.toString('base64')}`
      }
    });

  } catch (error) {
    console.error('Protobuf Encode Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to encode protobuf message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/protobuf/analyze
 * @desc Analyze protobuf wire format without decoding
 * @access Public
 */
router.post('/analyze', async (req, res) => {
  try {
    const { hex_data, base64_data } = req.body;
    
    if (!hex_data && !base64_data) {
      return res.status(400).json({
        success: false,
        error: 'Either hex_data or base64_data is required'
      });
    }

    // Convert input to buffer
    let buffer;
    if (hex_data) {
      try {
        buffer = Buffer.from(hex_data.replace(/\s/g, ''), 'hex');
      } catch (hexError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid hex string format'
        });
      }
    } else if (base64_data) {
      try {
        buffer = Buffer.from(base64_data, 'base64');
      } catch (base64Error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid base64 string format'
        });
      }
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Empty data provided'
      });
    }

    console.log(`Analyzing protobuf wire data (length: ${buffer.length} bytes)`);

    // Analyze wire format
    const analysis = analyzeWireFormat(buffer);

    // Try to guess message type
    const guessedType = guessMessageType(buffer, analysis);

    res.json({
      success: true,
      input: {
        length: buffer.length,
        hex: buffer.toString('hex').substring(0, 100) + (buffer.length > 50 ? '...' : ''),
        base64: buffer.toString('base64')
      },
      analysis,
      guesses: {
        message_type: guessedType,
        confidence: guessConfidence(analysis, guessedType)
      },
      raw_fields: extractRawFields(buffer)
    });

  } catch (error) {
    console.error('Protobuf Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze protobuf data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/protobuf/validate
 * @desc Validate protobuf message
 * @access Public
 */
router.post('/validate', async (req, res) => {
  try {
    const { message_type, hex_data, base64_data, schema } = req.body;
    
    if (!hex_data && !base64_data) {
      return res.status(400).json({
        success: false,
        error: 'Either hex_data or base64_data is required'
      });
    }

    // Convert input to buffer
    let buffer;
    if (hex_data) {
      buffer = Buffer.from(hex_data.replace(/\s/g, ''), 'hex');
    } else if (base64_data) {
      buffer = Buffer.from(base64_data, 'base64');
    }

    let validationResults = [];
    let MessageType;

    // If schema is provided, use it
    if (schema) {
      try {
        const customRoot = protobuf.Root.fromJSON(JSON.parse(schema));
        MessageType = customRoot.lookupType(message_type || 'Message');
      } catch (schemaError) {
        return res.status(400).json({
          success: false,
          error: `Invalid schema: ${schemaError.message}`
        });
      }
    } 
    // Otherwise use built-in types
    else if (message_type) {
      try {
        MessageType = freefireRoot.lookupType(`freefire.${message_type}`);
      } catch (lookupError) {
        return res.status(400).json({
          success: false,
          error: `Message type not found: ${lookupError.message}`
        });
      }
    }

    if (MessageType) {
      // Validate with specific message type
      try {
        const decoded = MessageType.decode(buffer);
        const plain = MessageType.toObject(decoded);
        
        validationResults.push({
          type: 'specific',
          message_type: message_type,
          valid: true,
          field_count: Object.keys(plain).length,
          missing_required: checkRequiredFields(plain, MessageType)
        });
      } catch (decodeError) {
        validationResults.push({
          type: 'specific',
          message_type: message_type,
          valid: false,
          error: decodeError.message
        });
      }
    }

    // Also try raw validation
    const rawAnalysis = analyzeWireFormat(buffer);
    validationResults.push({
      type: 'raw',
      valid: rawAnalysis.is_likely_protobuf,
      confidence: rawAnalysis.confidence,
      field_count: rawAnalysis.field_count,
      issues: rawAnalysis.issues
    });

    res.json({
      success: true,
      validation: validationResults,
      summary: {
        is_valid_protobuf: validationResults.some(r => r.valid),
        best_match: validationResults.find(r => r.valid && r.type === 'specific') || 
                    validationResults.find(r => r.valid),
        recommendations: generateValidationRecommendations(validationResults)
      }
    });

  } catch (error) {
    console.error('Protobuf Validation Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate protobuf message'
    });
  }
});

/**
 * @route GET /api/protobuf/types
 * @desc Get available protobuf message types
 * @access Public
 */
router.get('/types', (req, res) => {
  try {
    const types = getAvailableMessageTypes();
    
    res.json({
      success: true,
      types,
      count: types.length,
      schemas: getMessageSchemas()
    });
  } catch (error) {
    console.error('Get Types Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get message types'
    });
  }
});

/**
 * @route GET /api/protobuf/schema/:type
 * @desc Get schema for specific message type
 * @access Public
 */
router.get('/schema/:type', (req, res) => {
  try {
    const { type } = req.params;
    
    const MessageType = freefireRoot.lookupType(`freefire.${type}`);
    if (!MessageType) {
      return res.status(404).json({
        success: false,
        error: `Message type '${type}' not found`
      });
    }

    const schema = MessageType.toJSON();
    
    res.json({
      success: true,
      type,
      schema,
      fields: getMessageFields(MessageType),
      example: generateExample(MessageType)
    });

  } catch (error) {
    console.error('Get Schema Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get schema'
    });
  }
});

// Helper Functions

function attemptRawDecode(buffer, res) {
  try {
    // Try to decode as raw protobuf using field-by-field analysis
    const fields = [];
    let position = 0;
    
    while (position < buffer.length) {
      const fieldInfo = parseField(buffer, position);
      if (!fieldInfo) break;
      
      fields.push({
        position,
        ...fieldInfo
      });
      
      position = fieldInfo.nextPosition;
    }
    
    if (fields.length === 0) {
      throw new Error('No valid protobuf fields found');
    }
    
    // Try to guess message type based on fields
    const guessedType = guessMessageTypeFromFields(fields);
    
    res.json({
      success: true,
      decoded: {
        raw_fields: fields,
        guessed_type: guessedType
      },
      analysis: {
        field_count: fields.length,
        is_complete: position >= buffer.length,
        issues: position < buffer.length ? ['Incomplete parsing'] : []
      },
      note: 'Decoded as raw protobuf fields (no specific message type)'
    });
    
  } catch (rawError) {
    throw new Error(`Failed to decode as specific type or raw protobuf: ${rawError.message}`);
  }
}

function parseField(buffer, start) {
  if (start >= buffer.length) return null;
  
  // Read field tag (varint)
  let tag = 0;
  let shift = 0;
  let pos = start;
  
  while (pos < buffer.length) {
    const byte = buffer[pos];
    tag |= (byte & 0x7F) << shift;
    pos++;
    
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  
  if (pos >= buffer.length) return null;
  
  const fieldNumber = tag >> 3;
  const wireType = tag & 0x07;
  
  // Parse value based on wire type
  let value;
  let valueLength;
  
  switch (wireType) {
    case 0: // VARINT
      value = 0;
      shift = 0;
      while (pos < buffer.length) {
        const byte = buffer[pos];
        value |= (byte & 0x7F) << shift;
        pos++;
        
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }
      valueLength = pos - start - (Math.ceil(shift / 7) || 1);
      break;
      
    case 1: // 64-bit
      if (pos + 8 > buffer.length) return null;
      value = buffer.readBigUInt64LE(pos);
      pos += 8;
      valueLength = 8;
      break;
      
    case 2: // Length-delimited
      let length = 0;
      shift = 0;
      while (pos < buffer.length) {
        const byte = buffer[pos];
        length |= (byte & 0x7F) << shift;
        pos++;
        
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }
      
      if (pos + length > buffer.length) return null;
      value = buffer.slice(pos, pos + length);
      pos += length;
      valueLength = length;
      break;
      
    case 5: // 32-bit
      if (pos + 4 > buffer.length) return null;
      value = buffer.readUInt32LE(pos);
      pos += 4;
      valueLength = 4;
      break;
      
    default:
      // Unsupported wire type
      return null;
  }
  
  return {
    fieldNumber,
    wireType,
    wireTypeName: getWireTypeName(wireType),
    value: wireType === 2 ? value.toString('hex') : value,
    valueLength,
    start,
    end: pos - 1,
    nextPosition: pos,
    raw: buffer.slice(start, pos).toString('hex')
  };
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

function analyzeProtobufMessage(message, MessageType, buffer) {
  const fields = MessageType.fields;
  const fieldValues = {};
  let totalSize = 0;
  
  Object.keys(fields).forEach(fieldName => {
    const field = fields[fieldName];
    const value = message[fieldName];
    
    if (value !== undefined && value !== null) {
      const fieldSize = estimateFieldSize(field, value);
      totalSize += fieldSize;
      
      fieldValues[fieldName] = {
        type: field.type,
        id: field.id,
        value: field.type === 'bytes' ? `[${value.length} bytes]` : value,
        size: fieldSize,
        wire_type: getWireTypeForField(field)
      };
    }
  });
  
  return {
    field_count: Object.keys(fieldValues).length,
    total_size: totalSize,
    buffer_size: buffer.length,
    efficiency: totalSize > 0 ? ((totalSize / buffer.length) * 100).toFixed(2) + '%' : '0%',
    fields: fieldValues,
    missing_fields: Object.keys(fields).filter(f => message[f] === undefined || message[f] === null)
  };
}

function estimateFieldSize(field, value) {
  // Simplified size estimation
  const baseSize = 1; // Tag size
  
  switch (field.type) {
    case 'string':
      return baseSize + Buffer.from(value).length + 1; // +1 for length varint
    case 'bytes':
      return baseSize + value.length + 1; // +1 for length varint
    case 'int32':
    case 'uint32':
    case 'sint32':
    case 'bool':
    case 'enum':
      return baseSize + (value < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : 4);
    case 'int64':
    case 'uint64':
    case 'sint64':
      return baseSize + 8;
    case 'double':
      return baseSize + 8;
    case 'float':
      return baseSize + 4;
    case 'message':
      return baseSize + estimateMessageSize(value);
    default:
      return baseSize + 1;
  }
}

function estimateMessageSize(obj) {
  if (!obj) return 0;
  return Buffer.from(JSON.stringify(obj)).length;
}

function getWireTypeForField(field) {
  const wireTypes = {
    'string': 2,
    'bytes': 2,
    'int32': 0,
    'uint32': 0,
    'sint32': 0,
    'bool': 0,
    'enum': 0,
    'int64': 0,
    'uint64': 0,
    'sint64': 0,
    'double': 1,
    'float': 5,
    'message': 2
  };
  return wireTypes[field.type] || 2;
}

function formatBytesFields(obj) {
  const result = { ...obj };
  
  Object.keys(result).forEach(key => {
    if (Buffer.isBuffer(result[key])) {
      result[key] = {
        hex: result[key].toString('hex'),
        base64: result[key].toString('base64'),
        length: result[key].length,
        preview: result[key].toString('hex').substring(0, 50) + (result[key].length > 25 ? '...' : '')
      };
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = formatBytesFields(result[key]);
    }
  });
  
  return result;
}

function getAvailableMessageTypes() {
  if (!freefireRoot) return [];
  
  const types = [];
  const freefireNs = freefireRoot.nested.freefire.nested;
  
  Object.keys(freefireNs).forEach(typeName => {
    if (freefireNs[typeName].constructor.name === 'Type') {
      types.push(typeName);
    }
  });
  
  return types;
}

function getMessageFields(MessageType) {
  const fields = MessageType.fields;
  const fieldInfo = {};
  
  Object.keys(fields).forEach(fieldName => {
    const field = fields[fieldName];
    fieldInfo[fieldName] = {
      id: field.id,
      type: field.type,
      rule: field.rule,
      required: field.required || false
    };
  });
  
  return fieldInfo;
}

function generateExample(MessageType) {
  const fields = MessageType.fields;
  const example = {};
  
  Object.keys(fields).forEach(fieldName => {
    const field = fields[fieldName];
    
    switch (field.type) {
      case 'string':
        example[fieldName] = fieldName === 'uid' ? '1234567890' :
                            fieldName === 'password' ? 'example_password' :
                            fieldName === 'nickname' ? 'Player123' :
                            `example_${fieldName}`;
        break;
      case 'int32':
      case 'uint32':
        example[fieldName] = field.id * 100;
        break;
      case 'bool':
        example[fieldName] = true;
        break;
      case 'bytes':
        example[fieldName] = Buffer.from('example').toString('base64');
        break;
      case 'double':
        example[fieldName] = 1.5;
        break;
      default:
        example[fieldName] = `example_${field.type}`;
    }
  });
  
  return example;
}

function calculateWireSize(message, MessageType) {
  const buffer = MessageType.encode(message).finish();
  return buffer.length;
}

function analyzeWireFormat(buffer) {
  const fields = [];
  let position = 0;
  let issues = [];
  
  while (position < buffer.length) {
    const field = parseField(buffer, position);
    if (!field) {
      issues.push(`Failed to parse field at position ${position}`);
      break;
    }
    
    fields.push(field);
    position = field.nextPosition;
  }
  
  const isLikelyProtobuf = fields.length > 0 && issues.length === 0;
  const confidence = calculateConfidence(fields, buffer.length);
  
  return {
    field_count: fields.length,
    fields,
    issues,
    is_likely_protobuf: isLikelyProtobuf,
    confidence: confidence + '%',
    total_length: buffer.length,
    parsed_length: position,
    parsing_complete: position >= buffer.length
  };
}

function calculateConfidence(fields, totalLength) {
  if (fields.length === 0) return 0;
  
  const validFields = fields.filter(f => f.wireTypeName !== 'UNKNOWN');
  const fieldConfidence = (validFields.length / fields.length) * 50;
  
  const lengthConfidence = fields.reduce((sum, f) => sum + (f.end - f.start + 1), 0) / totalLength * 50;
  
  return Math.min(100, Math.round(fieldConfidence + lengthConfidence));
}

function guessMessageType(buffer, analysis) {
  if (analysis.fields.length === 0) return 'Unknown';
  
  // Simple heuristic based on field numbers and types
  const fieldNumbers = analysis.fields.map(f => f.fieldNumber);
  
  // LoginRequest typically has fields 1-5
  if (fieldNumbers.includes(1) && fieldNumbers.includes(2) && fieldNumbers.length >= 3) {
    return 'LoginRequest';
  }
  
  // LoginResponse typically has fields 1-6
  if (fieldNumbers.includes(1) && fieldNumbers.includes(2) && fieldNumbers.includes(4)) {
    return 'LoginResponse';
  }
  
  // UserInfo has various fields
  if (fieldNumbers.includes(1) && fieldNumbers.includes(2) && fieldNumbers.includes(4)) {
    return 'UserInfo';
  }
  
  return 'Unknown';
}

function guessMessageTypeFromFields(fields) {
  const fieldNumbers = fields.map(f => f.fieldNumber);
  
  if (fieldNumbers.includes(1) && fields.find(f => f.fieldNumber === 1 && f.wireType === 2)) {
    return 'LoginRequest';
  }
  
  return 'GenericMessage';
}

function guessConfidence(analysis, guessedType) {
  if (guessedType === 'Unknown') return 'low';
  
  // Calculate confidence based on field patterns
  const fieldPatterns = {
    LoginRequest: [1, 2, 3, 4, 5],
    LoginResponse: [1, 2, 3, 4, 5, 6],
    UserInfo: [1, 2, 3, 4, 5, 6, 7]
  };
  
  const expected = fieldPatterns[guessedType];
  if (!expected) return 'medium';
  
  const actual = analysis.fields.map(f => f.fieldNumber);
  const matches = actual.filter(n => expected.includes(n)).length;
  
  const score = matches / expected.length;
  
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function extractRawFields(buffer) {
  const fields = [];
  let position = 0;
  
  while (position < buffer.length && fields.length < 10) { // Limit to first 10 fields
    const field = parseField(buffer, position);
    if (!field) break;
    
    fields.push({
      offset: position,
      tag_hex: buffer.slice(position, field.nextPosition).toString('hex').substring(0, 20),
      field_number: field.fieldNumber,
      wire_type: field.wireTypeName,
      value_preview: typeof field.value === 'string' ? 
        field.value.substring(0, 30) + (field.value.length > 30 ? '...' : '') : 
        field.value
    });
    
    position = field.nextPosition;
  }
  
  return fields;
}

function checkRequiredFields(data, MessageType) {
  const fields = MessageType.fields;
  const missing = [];
  
  Object.keys(fields).forEach(fieldName => {
    const field = fields[fieldName];
    if (field.required && (data[fieldName] === undefined || data[fieldName] === null)) {
      missing.push(fieldName);
    }
  });
  
  return missing;
}

function generateValidationRecommendations(validationResults) {
  const recommendations = [];
  
  validationResults.forEach(result => {
    if (!result.valid) {
      if (result.type === 'specific') {
        recommendations.push(`Fix ${result.message_type}: ${result.error}`);
      } else if (result.issues && result.issues.length > 0) {
        recommendations.push(`Raw issues: ${result.issues.join(', ')}`);
      }
    }
  });
  
  if (recommendations.length === 0) {
    recommendations.push('Message appears valid. No recommendations.');
  }
  
  return recommendations;
}

function getMessageSchemas() {
  const schemas = {};
  const types = getAvailableMessageTypes();
  
  types.forEach(type => {
    const MessageType = freefireRoot.lookupType(`freefire.${type}`);
    schemas[type] = {
      fields: getMessageFields(MessageType),
      example: generateExample(MessageType)
    };
  });
  
  return schemas;
}

module.exports = router;