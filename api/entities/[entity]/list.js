import { getPool } from '../../_lib/db.js';
import { getEntityConfig, listEntity } from '../../_lib/entities.js';
import { methodNotAllowed, requireUser, sendError, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);

  const { entity, sort, limit } = req.query;
  const config = getEntityConfig(entity);
  if (!config) return sendError(res, 404, `Entidade desconhecida: ${entity}`);

  const user = await requireUser(req, res);
  if (!user) return;

  const rows = await listEntity(getPool(), entity, { sort, limit });
  sendJson(res, 200, rows);
}
