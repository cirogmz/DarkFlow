import crypto from 'crypto';

// Secret key for symmetric encryption (AES-256-GCM)
const SECRET = process.env.AUTH_SECRET || 'darkflow-secret-key-32-chars-long!!';
// Derive a 32-byte key from the secret
const KEY = crypto.scryptSync(SECRET, 'salt-for-darkflow', 32);
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'BRAND_ADMIN' | 'KITCHEN' | 'DELIVERY' | 'CASHIER';
  brandIds: string[]; // Brands this user is associated with
  activeBrandId?: string; // Brand selected during login
  expiresAt: number;
}

/**
 * Encrypt session data to create a token
 */
export function encryptSession(data: Omit<SessionData, 'expiresAt'>, lifespanMs = 8 * 60 * 60 * 1000): string {
  const expiresAt = Date.now() + lifespanMs;
  const payload = JSON.stringify({ ...data, expiresAt });
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  
  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return format: iv:encrypted:authTag
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt session token to retrieve session data
 */
export function decryptSession(token: string): SessionData | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return null;
    
    const [ivHex, encryptedHex, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    const data = JSON.parse(decrypted) as SessionData;
    
    // Check expiration
    if (Date.now() > data.expiresAt) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Session decryption failed:', error);
    return null;
  }
}

/**
 * Get current session from Request cookies
 */
export function getSessionFromCookies(cookieString?: string): SessionData | null {
  if (!cookieString) return null;
  
  const match = cookieString.match(/(^|;)\s*df_session=([^;]+)/);
  if (!match) return null;
  
  const token = decodeURIComponent(match[2]);
  return decryptSession(token);
}
