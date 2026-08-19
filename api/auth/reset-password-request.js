import { getPool } from '../_lib/db.js';
import { methodNotAllowed, sendError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

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
