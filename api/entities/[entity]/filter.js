import { getPool } from '../../_lib/db.js';
import { getEntityConfig, filterEntity } from '../../_lib/entities.js';
import { methodNotAllowed, requireUser, sendError, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);

  const { entity, sort, limit, query } = req.query;
  const config = getEntityConfig(entity);
  if (!config) return sendError(res, 404, `Entidade desconhecida: ${entity}`);

  const user = await requireUser(req, res);
  if (!user) return;

  let parsedQuery = {};
  if (query) {
    try {
      parsedQuery = JSON.parse(query);
    } catch {
      return sendError(res, 400, 'Parâmetro query inválido');
    }
  }

  const rows = await filterEntity(getPool(), entity, { query: parsedQuery, sort, limit });
  sendJson(res, 200, rows);
}
