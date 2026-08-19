import { getPool } from '../_lib/db.js';
import { hashPassword } from '../_lib/crypto.js';
import { methodNotAllowed, sendError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

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
