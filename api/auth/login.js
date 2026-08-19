import { getPool } from '../_lib/db.js';
import { verifyPassword } from '../_lib/crypto.js';
import { signSession, setSessionCookie } from '../_lib/session.js';
import { methodNotAllowed, sanitizeUser, sendError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  const { email, password } = req.body || {};
  if (!email || !password) return sendError(res, 400, 'E-mail e senha são obrigatórios');

  const pool = getPool();
  const { rows } = await pool.query('select * from users where lower(email) = lower($1)', [email.trim()]);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return sendError(res, 401, 'E-mail ou senha inválidos');
  }

  const token = signSession(user.id);
  setSessionCookie(res, token);
  sendJson(res, 200, sanitizeUser(user));
}
