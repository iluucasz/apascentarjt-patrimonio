import { getPool } from '../../_lib/db.js';
import { createEntity, getEntityConfig } from '../../_lib/entities.js';
import { methodNotAllowed, requireUser, sendError, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  const { entity } = req.query;
  const config = getEntityConfig(entity);
  if (!config) return sendError(res, 404, `Entidade desconhecida: ${entity}`);
  if (entity === 'User') {
    return sendError(res, 403, 'Use /api/auth/register ou /api/auth/invite para criar usuários');
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const created = await createEntity(getPool(), entity, req.body || {});
  sendJson(res, 201, created);
}
