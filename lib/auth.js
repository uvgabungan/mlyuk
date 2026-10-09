import crypto from 'node:crypto';

// Default credentials (can be overridden via environment variables)
const DEFAULT_USER = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_PASS = process.env.ADMIN_PASSWORD || 'admin123';

// Generate server session secret once per boot
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'streamhub_secure_session_secret_2026';

/**
 * Hash a string with sha256
 */
export function hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Generate a signed session token
 */
export function createSessionToken(username) {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = `${username}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

/**
 * Verify a session token
 */
export function verifySessionToken(token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const [username, expiresAtStr, signature] = raw.split(':');
    if (!username || !expiresAtStr || !signature) return null;

    const expiresAt = Number(expiresAtStr);
    if (Date.now() > expiresAt) return null; // Expired

    const payload = `${username}:${expiresAtStr}`;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    if (signature !== expectedSig) return null;

    return { username, expiresAt };
  } catch {
    return null;
  }
}

/**
 * Validate username and password
 */
export function validateLogin(username, password) {
  const targetUser = process.env.ADMIN_USERNAME || 'admin';
  const targetPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (!username || !password) return false;
  return username.trim() === targetUser.trim() && password === targetPass;
}

/**
 * Extract auth cookie from request headers
 */
export function getSessionFromRequest(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/stream_admin_token=([^;]+)/);
  if (!match) return null;
  return verifySessionToken(match[1]);
}
