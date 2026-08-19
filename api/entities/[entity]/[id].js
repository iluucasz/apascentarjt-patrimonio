import { getPool } from '../../_lib/db.js';
import { deleteEntity, getEntity, getEntityConfig, updateEntity } from '../../_lib/entities.js';
import { methodNotAllowed, requireUser, sendError, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  const { entity, id } = req.query;
  const config = getEntityConfig(entity);
  if (!config) return sendError(res, 404, `Entidade desconhecida: ${entity}`);

  const user = await requireUser(req, res);
  if (!user) return;

  const pool = getPool();

  if (req.method === 'GET') {
    const row = await getEntity(pool, entity, id);
    if (!row) return sendError(res, 404, 'Não encontrado');
    return sendJson(res, 200, row);
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (entity === 'User' && user.role !== 'admin') {
      return sendError(res, 403, 'Apenas administradores podem editar usuários');
    }
    try {
      const updated = await updateEntity(pool, entity, id, req.body || {});
      return sendJson(res, 200, updated);
    } catch (err) {
      return sendError(res, 404, err.message);
    }
  }

  if (req.method === 'DELETE') {
    if (entity === 'User') return sendError(res, 403, 'Não permitido para usuários');
    const result = await deleteEntity(pool, entity, id);
    return sendJson(res, 200, result);
  }

  return methodNotAllowed(req, res, ['GET', 'PUT', 'DELETE']);
}
