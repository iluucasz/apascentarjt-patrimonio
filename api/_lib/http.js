import { getPool } from './db.js';
import { getSessionToken, verifySession } from './session.js';

export function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));
}

export function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

export function methodNotAllowed(req, res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  sendError(res, 405, `Método não permitido`);
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

/**
 * Carrega o usuário autenticado a partir do cookie de sessão.
 * Envia 401 e retorna null se não houver sessão válida.
 */
export async function requireUser(req, res) {
  const token = getSessionToken(req);
  const userId = token && verifySession(token);
  if (!userId) {
    sendError(res, 401, 'Não autenticado');
    return null;
  }
  const pool = getPool();
  const { rows } = await pool.query('select * from users where id = $1', [userId]);
  if (!rows[0]) {
    sendError(res, 401, 'Não autenticado');
    return null;
  }
  return rows[0];
}

export function requireRole(res, user, roles) {
  if (!roles.includes(user.role)) {
    sendError(res, 403, 'Sem permissão para esta ação');
    return false;
  }
  return true;
}
