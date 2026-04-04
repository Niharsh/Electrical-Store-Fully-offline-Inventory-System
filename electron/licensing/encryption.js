const crypto = require('crypto');

/**
 * Encryption/Decryption for license files
 * Uses AES-256-CBC encryption
 * Secret key is stored securely in main process
 */

// Secret key - MUST be 32 bytes for AES-256
// In production, this should be derived from app metadata or securely stored
const SECRET_KEY = Buffer.from('choudhary-electrical-store-license-key-2026@secure');
const SECRET_KEY_HASH = crypto.createHash('sha256').update(SECRET_KEY).digest();

/**
 * Encrypt license data
 * @param {Object} data - License object to encrypt
 * @returns {String} Encrypted data (base64)
 */
function encryptLicense(data) {
  try {
    console.log('[license] Encrypting license data...');
    
    // Generate random IV for this encryption
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY_HASH, iv);
    
    // Encrypt the JSON data
    const jsonString = JSON.stringify(data);
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data
    const result = iv.toString('hex') + ':' + encrypted;
    
    console.log('[license] License encrypted successfully');
    return result;
    
  } catch (err) {
    console.error('[license] Encryption error:', err);
    throw new Error('Failed to encrypt license: ' + err.message);
  }
}

/**
 * Decrypt license data
 * @param {String} encryptedData - Encrypted data (base64)
 * @returns {Object} Decrypted license object
 */
function decryptLicense(encryptedData) {
  try {
    console.log('[license] Decrypting license data...');
    
    // Split IV and encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY_HASH, iv);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse JSON
    const data = JSON.parse(decrypted);
    
    console.log('[license] License decrypted successfully');
    return data;
    
  } catch (err) {
    console.error('[license] Decryption error:', err);
    throw new Error('Failed to decrypt license: ' + err.message);
  }
}

/**
 * Generate HMAC signature for license data
 * Ensures license integrity
 */
function generateSignature(data) {
  const hmac = crypto.createHmac('sha256', SECRET_KEY_HASH);
  hmac.update(JSON.stringify(data));
  return hmac.digest('hex');
}

/**
 * Verify HMAC signature
 */
function verifySignature(data, signature) {
  const expectedSignature = generateSignature(data);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

module.exports = {
  encryptLicense,
  decryptLicense,
  generateSignature,
  verifySignature
};
