import { getPool } from '../_lib/db.js';
import { genOtpCode, hashPassword } from '../_lib/crypto.js';
import { methodNotAllowed, sendError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

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
