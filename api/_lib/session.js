import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'session';

function getSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error('AUTH_JWT_SECRET não configurada');
  return secret;
}

export function signSession(userId) {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: '30d' });
}

export function verifySession(token) {
  try {
    const payload = jwt.verify(token, getSecret());
    return payload.sub;
  } catch {
    return null;
  }
}

function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

export function getSessionToken(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

export function setSessionCookie(res, token) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(res) {
  const attrs = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}
