import { getPool } from '../../_lib/db.js';
import { bulkCreateEntity, getEntityConfig } from '../../_lib/entities.js';
import { methodNotAllowed, requireUser, sendError, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  const { entity } = req.query;
  const config = getEntityConfig(entity);
  if (!config) return sendError(res, 404, `Entidade desconhecida: ${entity}`);
  if (entity === 'User') return sendError(res, 403, 'Não permitido para usuários');

  const user = await requireUser(req, res);
  if (!user) return;

  const dataArray = Array.isArray(req.body) ? req.body : [];
  const created = await bulkCreateEntity(getPool(), entity, dataArray);
  sendJson(res, 201, created);
}
