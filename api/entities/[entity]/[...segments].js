// Um único arquivo para /api/entities/:entity/list|filter|bulk|:id — o plano
// Hobby da Vercel limita a 12 Serverless Functions por deployment. As URLs
// continuam as mesmas de antes, só a organização interna mudou (ver também
// api/entities/[entity]/index.js, que cobre o POST de criação sem segmento
// extra no caminho).

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

async function handleList(req, res, pool, entity) {
  if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);
  const { sort, limit } = req.query;
  const rows = await listEntity(pool, entity, { sort, limit });
  sendJson(res, 200, rows);
}

async function handleFilter(req, res, pool, entity) {
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
  const rows = await filterEntity(pool, entity, { query: parsedQuery, sort, limit });
  sendJson(res, 200, rows);
}

async function handleBulk(req, res, pool, entity) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);
  if (entity === 'User') return sendError(res, 403, 'Não permitido para usuários');
  const dataArray = Array.isArray(req.body) ? req.body : [];
  const created = await bulkCreateEntity(pool, entity, dataArray);
  sendJson(res, 201, created);
}

async function handleById(req, res, pool, entity, id, user) {
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

export default async function handler(req, res) {
  const { entity } = req.query;
  const config = getEntityConfig(entity);
  if (!config) return sendError(res, 404, `Entidade desconhecida: ${entity}`);

  const user = await requireUser(req, res);
  if (!user) return;

  const segments = Array.isArray(req.query.segments)
    ? req.query.segments
    : [req.query.segments].filter(Boolean);
  const pool = getPool();

  if (segments.length === 1 && segments[0] === 'list') return handleList(req, res, pool, entity);
  if (segments.length === 1 && segments[0] === 'filter') return handleFilter(req, res, pool, entity);
  if (segments.length === 1 && segments[0] === 'bulk') return handleBulk(req, res, pool, entity);
  if (segments.length === 1) return handleById(req, res, pool, entity, segments[0], user);

  return sendError(res, 404, 'Rota não encontrada');
}
