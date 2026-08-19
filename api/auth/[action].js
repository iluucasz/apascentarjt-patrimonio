// Um único arquivo para todas as rotas /api/auth/* — o plano Hobby da Vercel
// limita a 12 Serverless Functions por deployment, e cada arquivo em api/
// (fora de _lib) vira uma function. As URLs continuam as mesmas de antes
// (/api/auth/login, /api/auth/me, etc.), só a organização interna mudou.

import { getPool } from '../_lib/db.js';
import { genOtpCode, hashPassword, verifyPassword } from '../_lib/crypto.js';
import { setSessionCookie, signSession, clearSessionCookie } from '../_lib/session.js';
import { methodNotAllowed, requireUser, sanitizeUser, sendError, sendJson } from '../_lib/http.js';

async function me(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  sendJson(res, 200, sanitizeUser(user));
}

async function login(req, res) {
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

async function logout(req, res) {
  clearSessionCookie(res);
  sendJson(res, 200, { success: true });
}

async function register(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return sendError(res, 400, 'E-mail e senha são obrigatórios');

  const pool = getPool();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await pool.query('select id from users where lower(email) = lower($1)', [normalizedEmail]);
  if (existing.rows[0]) return sendError(res, 409, 'Já existe uma conta com este e-mail');

  const { rows: countRows } = await pool.query('select count(*)::int as count from users');
  const isFirstUser = countRows[0].count === 0;
  const password_hash = hashPassword(password);

  await pool.query(
    `insert into users (email, password_hash, role, email_verified)
     values ($1, $2, $3, false)`,
    [normalizedEmail, password_hash, isFirstUser ? 'admin' : 'user']
  );

  const devOtpCode = genOtpCode();
  await pool.query(
    `insert into auth_pending_otp (email, code, expires_at)
     values ($1, $2, now() + interval '15 minutes')
     on conflict (email) do update set code = excluded.code, expires_at = excluded.expires_at`,
    [normalizedEmail, devOtpCode]
  );

  sendJson(res, 200, { devOtpCode });
}

async function verifyOtp(req, res) {
  const { email, otpCode } = req.body || {};
  if (!email || !otpCode) return sendError(res, 400, 'E-mail e código são obrigatórios');

  const pool = getPool();
  const normalizedEmail = email.trim().toLowerCase();

  const { rows: pendingRows } = await pool.query(
    'select * from auth_pending_otp where email = $1 and code = $2 and expires_at > now()',
    [normalizedEmail, otpCode]
  );
  if (!pendingRows[0]) return sendError(res, 401, 'Código de verificação inválido');

  const { rows: userRows } = await pool.query('select * from users where lower(email) = lower($1)', [normalizedEmail]);
  const user = userRows[0];
  if (!user) return sendError(res, 404, 'Usuário não encontrado');

  await pool.query('update users set email_verified = true, updated_date = now() where id = $1', [user.id]);
  await pool.query('delete from auth_pending_otp where email = $1', [normalizedEmail]);

  const token = signSession(user.id);
  setSessionCookie(res, token);
  sendJson(res, 200, { access_token: token });
}

async function resendOtp(req, res) {
  const { email } = req.body || {};
  if (!email) return sendError(res, 400, 'E-mail é obrigatório');

  const pool = getPool();
  const normalizedEmail = email.trim().toLowerCase();

  const { rows } = await pool.query('select id from users where lower(email) = lower($1)', [normalizedEmail]);
  if (!rows[0]) return sendError(res, 404, 'Usuário não encontrado');

  const devOtpCode = genOtpCode();
  await pool.query(
    `insert into auth_pending_otp (email, code, expires_at)
     values ($1, $2, now() + interval '15 minutes')
     on conflict (email) do update set code = excluded.code, expires_at = excluded.expires_at`,
    [normalizedEmail, devOtpCode]
  );

  sendJson(res, 200, { devOtpCode });
}

async function resetPasswordRequest(req, res) {
  const { email } = req.body || {};
  if (!email) return sendError(res, 400, 'E-mail é obrigatório');

  const pool = getPool();
  const normalizedEmail = email.trim().toLowerCase();

  const { rows } = await pool.query('select id from users where lower(email) = lower($1)', [normalizedEmail]);
  if (!rows[0]) {
    // Não revela se o e-mail existe ou não.
    return sendJson(res, 200, { resetToken: null });
  }

  const { rows: tokenRows } = await pool.query(
    `insert into auth_reset_tokens (email, expires_at)
     values ($1, now() + interval '30 minutes')
     returning token`,
    [normalizedEmail]
  );

  sendJson(res, 200, { resetToken: tokenRows[0].token });
}

async function resetPassword(req, res) {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken || !newPassword) return sendError(res, 400, 'Token e nova senha são obrigatórios');

  const pool = getPool();
  const { rows } = await pool.query(
    'select * from auth_reset_tokens where token = $1 and expires_at > now()',
    [resetToken]
  );
  const entry = rows[0];
  if (!entry) return sendError(res, 401, 'Link de redefinição inválido ou expirado');

  const { rows: userRows } = await pool.query('select id from users where lower(email) = lower($1)', [entry.email]);
  const user = userRows[0];
  if (!user) return sendError(res, 404, 'Usuário não encontrado');

  const password_hash = hashPassword(newPassword);
  await pool.query('update users set password_hash = $1, updated_date = now() where id = $2', [password_hash, user.id]);
  await pool.query('delete from auth_reset_tokens where token = $1', [resetToken]);

  sendJson(res, 200, { success: true });
}

const ROUTES = {
  me: { method: 'GET', handler: me },
  login: { method: 'POST', handler: login },
  logout: { method: 'POST', handler: logout },
  register: { method: 'POST', handler: register },
  'verify-otp': { method: 'POST', handler: verifyOtp },
  'resend-otp': { method: 'POST', handler: resendOtp },
  'reset-password-request': { method: 'POST', handler: resetPasswordRequest },
  'reset-password': { method: 'POST', handler: resetPassword },
};

export default async function handler(req, res) {
  const route = ROUTES[req.query.action];
  if (!route) return sendError(res, 404, 'Rota não encontrada');
  if (req.method !== route.method) return methodNotAllowed(req, res, [route.method]);
  return route.handler(req, res);
}
