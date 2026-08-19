import { getPool } from '../_lib/db.js';
import { genOtpCode } from '../_lib/crypto.js';
import { methodNotAllowed, sendError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

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
