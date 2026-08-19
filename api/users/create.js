import { getPool } from '../_lib/db.js';
import { hashPassword } from '../_lib/crypto.js';
import { methodNotAllowed, requireUser, sanitizeUser, sendError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  const user = await requireUser(req, res);
  if (!user) return;
  if (user.role !== 'admin') return sendError(res, 403, 'Apenas administradores podem criar usuários');

  const { email, password, role } = req.body || {};
  if (!email || !password) return sendError(res, 400, 'E-mail e senha são obrigatórios');
  if (password.length < 6) return sendError(res, 400, 'A senha deve ter pelo menos 6 caracteres');

  const pool = getPool();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await pool.query('select id from users where lower(email) = lower($1)', [normalizedEmail]);
  if (existing.rows[0]) return sendError(res, 409, 'Já existe uma conta com este e-mail');

  const password_hash = hashPassword(password);
  const { rows } = await pool.query(
    `insert into users (email, password_hash, role, email_verified, invited)
     values ($1, $2, $3, true, false)
     returning *`,
    [normalizedEmail, password_hash, role || 'user']
  );

  sendJson(res, 201, sanitizeUser(rows[0]));
}
