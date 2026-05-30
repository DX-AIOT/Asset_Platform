/**
 * Lightweight in-memory mock of the auth API (DXS-8 endpoints).
 * Mimics the NestJS backend contract so the Next.js web app works
 * without Docker/PostgreSQL/Redis.
 *
 * Usage: node scripts/mock-api.mjs
 */

import { createServer } from 'http';
import { createHmac, randomUUID, randomBytes } from 'crypto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const PORT = 3001;
const JWT_SECRET = 'mock-jwt-secret';
const REFRESH_SECRET = 'mock-refresh-secret';

// In-memory store
const users = new Map();          // email -> userRecord
const refreshTokens = new Set();  // valid refresh token strings
const userRefreshTokens = new Map(); // userId -> Set of refresh tokens (for logout invalidation)

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function makeJWT(payload, secret, expiresInSecs = 7 * 86400) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  // jti (JWT ID) ensures uniqueness even within the same second (prevents token rotation race condition)
  const jti = randomBytes(8).toString('hex');
  const body = base64url(JSON.stringify({ ...payload, jti, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSecs }));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token, secret) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    if (expected !== sig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(body);
}

function issueTokens(user) {
  const accessToken = makeJWT({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, 900); // 15 min
  const refreshToken = makeJWT({ sub: user.id, type: 'refresh' }, REFRESH_SECRET, 30 * 86400);
  refreshTokens.add(refreshToken);
  // Track per-user refresh tokens for logout invalidation
  if (!userRefreshTokens.has(user.id)) userRefreshTokens.set(user.id, new Set());
  userRefreshTokens.get(user.id).add(refreshToken);
  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
  };
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

function getBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

const server = createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    return res.end();
  }

  // Health check
  if (url === '/api/health' && req.method === 'GET') {
    return sendJSON(res, 200, { status: 'ok', timestamp: new Date().toISOString(), environment: 'local-mock' });
  }

  // POST /api/auth/register
  if (url === '/api/auth/register' && req.method === 'POST') {
    const body = await readBody(req);
    const { email, password, firstName, lastName } = body;
    if (!email || !password) return sendJSON(res, 400, { message: 'Email and password required' });
    if (!EMAIL_REGEX.test(email)) return sendJSON(res, 400, { message: 'email must be an email' });
    if (password.length < 6) return sendJSON(res, 400, { message: 'Password must be at least 6 characters' });
    if (users.has(email)) return sendJSON(res, 409, { message: 'Email already registered' });

    const user = { id: randomUUID(), email, password, firstName: firstName || '', lastName: lastName || '', role: 'user' };
    users.set(email, user);
    console.log(`[register] New user: ${email}`);
    return sendJSON(res, 201, issueTokens(user));
  }

  // POST /api/auth/login
  if (url === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    const { email, password } = body;
    const user = users.get(email);
    if (!user || user.password !== password) {
      return sendJSON(res, 401, { message: 'Invalid credentials' });
    }
    console.log(`[login] User: ${email}`);
    return sendJSON(res, 200, issueTokens(user));
  }

  // POST /api/auth/refresh
  if (url === '/api/auth/refresh' && req.method === 'POST') {
    const body = await readBody(req);
    const { refreshToken } = body;
    if (!refreshToken || !refreshTokens.has(refreshToken)) {
      return sendJSON(res, 401, { message: 'Invalid refresh token' });
    }
    const payload = verifyJWT(refreshToken, REFRESH_SECRET);
    if (!payload) {
      refreshTokens.delete(refreshToken);
      return sendJSON(res, 401, { message: 'Refresh token expired' });
    }
    // Find user by id
    const user = [...users.values()].find(u => u.id === payload.sub);
    if (!user) return sendJSON(res, 401, { message: 'User not found' });
    refreshTokens.delete(refreshToken);
    console.log(`[refresh] User: ${user.email}`);
    return sendJSON(res, 200, issueTokens(user));
  }

  // GET /api/auth/me
  if (url === '/api/auth/me' && req.method === 'GET') {
    const token = getBearerToken(req);
    if (!token) return sendJSON(res, 401, { message: 'No token provided' });
    const payload = verifyJWT(token, JWT_SECRET);
    if (!payload) return sendJSON(res, 401, { message: 'Invalid or expired token' });
    const user = [...users.values()].find(u => u.id === payload.sub);
    if (!user) return sendJSON(res, 401, { message: 'User not found' });
    return sendJSON(res, 200, { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role });
  }

  // POST /api/auth/logout
  if (url === '/api/auth/logout' && req.method === 'POST') {
    const token = getBearerToken(req);
    if (!token) return sendJSON(res, 401, { message: 'No token provided' });
    const payload = verifyJWT(token, JWT_SECRET);
    if (!payload) return sendJSON(res, 401, { message: 'Invalid or expired token' });
    // Invalidate all refresh tokens for this user
    const userTokens = userRefreshTokens.get(payload.sub);
    if (userTokens) {
      userTokens.forEach(t => refreshTokens.delete(t));
      userRefreshTokens.delete(payload.sub);
    }
    console.log(`[logout] User: ${payload.email}`);
    return sendJSON(res, 200, { message: 'Logged out successfully' });
  }

  sendJSON(res, 404, { message: `Route not found: ${url}` });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock API server running on http://localhost:${PORT}/api`);
  console.log('Endpoints:');
  console.log('  POST /api/auth/register');
  console.log('  POST /api/auth/login');
  console.log('  POST /api/auth/refresh');
  console.log('  GET  /api/auth/me');
  console.log('  POST /api/auth/logout');
  console.log('  GET  /api/health');
});
