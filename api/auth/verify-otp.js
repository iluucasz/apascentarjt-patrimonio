import { getPool } from '../_lib/db.js';
import { setSessionCookie, signSession } from '../_lib/session.js';
import { methodNotAllowed, sendError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

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
