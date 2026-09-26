// Um único arquivo para /api/entities/:entity/list|filter|bulk|:id — o plano
// Hobby da Vercel limita a 12 Serverless Functions por deployment. As URLs
// continuam as mesmas de antes, só a organização interna mudou (ver também
// api/entities/[entity]/index.js, que cobre o POST de criação sem segmento
// extra no caminho).
//
// Usa um segmento dinâmico simples ([action], não catch-all [...action]):
// na Vercel, fora do Next.js, rotas catch-all não são resolvidas por essas
// Functions (o parâmetro chega vazio e cai em 404) — só [nome] funciona.
// Como list/filter/bulk/:id nunca têm mais de um segmento extra depois da
// entidade, um segmento simples cobre todos os casos.

import { getPool } from '../../_lib/db.js';
import {
  bulkCreateEntity,
  deleteEntity,
  filterEntity,
  getEntity,
  getEntityConfig,
  listEntity,
  updateEntity,
} from '../../_lib/entities.js';
import { methodNotAllowed, requireUser, sendError, sendJson } from '../../_lib/http.js';
import { checkEntityWrite, resolveScope, scopeForQuery } from '../../_lib/scope.js';

async function handleList(req, res, pool, entity, scope) {
  if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);
  const { sort, limit } = req.query;
  const rows = await listEntity(pool, entity, { sort, limit, scopeIds: scope.viewIds });
  sendJson(res, 200, rows);
}

async function handleFilter(req, res, pool, entity, scope) {
  if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);
  const { sort, limit, query } = req.query;
  let parsedQuery = {};
  if (query) {
    try {
      parsedQuery = JSON.parse(query);
    } catch {
      return sendError(res, 400, 'Parâmetro query inválido');
    }
  }
  const scopeIds = scopeForQuery(scope, parsedQuery);
  const rows = await filterEntity(pool, entity, { query: parsedQuery, sort, limit, scopeIds });
  sendJson(res, 200, rows);
}

async function handleBulk(req, res, pool, entity, scope) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);
  if (entity === 'User') return sendError(res, 403, 'Não permitido para usuários');
  const dataArray = Array.isArray(req.body) ? req.body : [];
  for (const data of dataArray) {
    const denied = await checkEntityWrite(pool, entity, { data }, scope.restrictedIds);
    if (denied) return sendError(res, 403, denied);
  }
  const created = await bulkCreateEntity(pool, entity, dataArray);
  sendJson(res, 201, created);
}

async function handleById(req, res, pool, entity, id, user, scope) {
  if (req.method === 'GET') {
    const row = await getEntity(pool, entity, id, { scopeIds: scope.restrictedIds });
    if (!row) return sendError(res, 404, 'Não encontrado');
    return sendJson(res, 200, row);
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (entity === 'User' && user.role !== 'admin') {
      return sendError(res, 403, 'Apenas administradores podem editar usuários');
    }
    const denied = await checkEntityWrite(pool, entity, { id, data: req.body || {} }, scope.restrictedIds);
    if (denied) return sendError(res, 403, denied);
    try {
      const updated = await updateEntity(pool, entity, id, req.body || {});
      return sendJson(res, 200, updated);
    } catch (err) {
      return sendError(res, 404, err.message);
    }
  }

  if (req.method === 'DELETE') {
    if (entity === 'User') {
      if (user.role !== 'admin') return sendError(res, 403, 'Apenas administradores podem excluir usuários');
      if (id === user.id) return sendError(res, 400, 'Você não pode excluir a própria conta');
      const { rows: adminRows } = await pool.query(
        "select count(*)::int as count from users where role = 'admin' and id != $1",
        [id]
      );
      if (adminRows[0].count === 0) {
        const { rows: targetRows } = await pool.query('select role from users where id = $1', [id]);
        if (targetRows[0]?.role === 'admin') {
          return sendError(res, 400, 'Não é possível excluir o último administrador');
        }
      }
    }
    const denied = await checkEntityWrite(pool, entity, { id }, scope.restrictedIds);
    if (denied) return sendError(res, 403, denied);
    const result = await deleteEntity(pool, entity, id);
    return sendJson(res, 200, result);
  }

  return methodNotAllowed(req, res, ['GET', 'PUT', 'DELETE']);
}

export default async function handler(req, res) {
  const { entity } = req.query;
  const config = getEntityConfig(entity);
  if (!config) return sendError(res, 404, `Entidade desconhecida: ${entity}`);

  const user = await requireUser(req, res);
  if (!user) return;

  const { action } = req.query;
  const pool = getPool();
  const scope = await resolveScope(pool, user, req);

  if (action === 'list') return handleList(req, res, pool, entity, scope);
  if (action === 'filter') return handleFilter(req, res, pool, entity, scope);
  if (action === 'bulk') return handleBulk(req, res, pool, entity, scope);
  if (action) return handleById(req, res, pool, entity, action, user, scope);

  return sendError(res, 404, 'Rota não encontrada');
}
