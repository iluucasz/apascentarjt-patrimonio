// Escopo por filial/local.
//
// Duas coisas limitam o que um usuário enxerga:
// - restrição do usuário (users.allowed_location_ids): só vale para quem não é
//   admin; null/vazio = vê tudo. É regra de acesso: aplicada em toda leitura e
//   em toda escrita.
// - filial escolhida no seletor da barra lateral (header X-Filial): só um filtro
//   de visualização das listagens. Escolher a filial principal (locations.is_main)
//   ou nenhuma = ver tudo.
//
// Um local inclui todos os seus sublocais (parent_location_id), em qualquer
// profundidade.

function subtree(locations, rootIds) {
  const children = new Map();
  for (const l of locations) {
    if (!l.parent_location_id) continue;
    if (!children.has(l.parent_location_id)) children.set(l.parent_location_id, []);
    children.get(l.parent_location_id).push(l.id);
  }
  const known = new Set(locations.map((l) => l.id));
  const seen = new Set();
  const stack = rootIds.filter((id) => known.has(id));
  while (stack.length > 0) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(children.get(id) || []));
  }
  return [...seen];
}

export function isRestrictedUser(user) {
  return user.role !== 'admin' && Array.isArray(user.allowed_location_ids) && user.allowed_location_ids.length > 0;
}

/**
 * Resolve o escopo da requisição.
 * - restrictedIds: locais que o usuário pode acessar (null = sem restrição).
 * - viewIds: restrictedIds combinado com a filial escolhida (null = tudo).
 */
export async function resolveScope(pool, user, req) {
  const restricted = isRestrictedUser(user);
  const viewId = String(req.headers?.['x-filial'] || '').trim() || null;
  if (!restricted && !viewId) return { restrictedIds: null, viewIds: null };

  // select * para não depender da coluna is_main antes da migração.
  const { rows: locations } = await pool.query('select * from locations');
  const restrictedIds = restricted ? subtree(locations, user.allowed_location_ids) : null;

  let viewIds = restrictedIds;
  const viewLocation = viewId && locations.find((l) => l.id === viewId);
  if (viewLocation && !viewLocation.is_main) {
    const filialIds = subtree(locations, [viewLocation.id]);
    viewIds = restrictedIds ? filialIds.filter((id) => restrictedIds.includes(id)) : filialIds;
  }
  return { restrictedIds, viewIds };
}

const ASSET_IN_SCOPE = (p) => `asset_id in (select id from assets where location_id = any(${p}::uuid[]))`;

// Condição SQL (com o placeholder do array de locais) que limita cada entidade
// ao escopo. Entidades sem entrada aqui não são filtradas.
export const SCOPE_CONDITIONS = {
  Asset: (p) => `location_id = any(${p}::uuid[])`,
  // Uma movimentação aparece para os dois lados (origem e destino) e no
  // histórico dos patrimônios que estão no escopo.
  AssetMovement: (p) => `(from_location_id = any(${p}::uuid[]) or to_location_id = any(${p}::uuid[]) or ${ASSET_IN_SCOPE(p)})`,
  MaintenanceRecord: ASSET_IN_SCOPE,
  AssetDocument: ASSET_IN_SCOPE,
  InventoryItem: ASSET_IN_SCOPE,
  Inventory: (p) => `location_id = any(${p}::uuid[])`,
  AuditLog: (p) => `entity_id in (select id::text from assets where location_id = any(${p}::uuid[]))`,
};

// Filtros que apontam para um registro específico (abrir um patrimônio, um
// lote, o histórico de um item...) ignoram a filial escolhida no seletor — só
// a restrição do usuário continua valendo. Assim, escanear um QR Code de outra
// filial ou editar um lote dividido entre filiais continua funcionando.
const IDENTIFYING_KEYS = ['id', 'asset_number', 'batch_id', 'asset_id', 'entity_id', 'inventory_id'];

export function scopeForQuery(scope, query = {}) {
  const identifying = Object.keys(query).some((k) => IDENTIFYING_KEYS.includes(k));
  return identifying ? scope.restrictedIds : scope.viewIds;
}

async function assetLocation(pool, assetId) {
  if (!assetId) return null;
  const { rows } = await pool.query('select location_id from assets where id = $1', [assetId]);
  return rows[0] ? rows[0].location_id : null;
}

const ASSET_CHILD_TABLES = {
  AssetMovement: 'asset_movements',
  MaintenanceRecord: 'maintenance_records',
  AssetDocument: 'asset_documents',
  InventoryItem: 'inventory_items',
};

/**
 * Confere se um usuário restrito pode criar/alterar/excluir um registro pela
 * API genérica de entidades. Retorna a mensagem de erro, ou null se pode.
 * Mover um patrimônio para um local fora da restrição é permitido (o usuário
 * só precisa ter acesso ao patrimônio antes da mudança).
 */
export async function checkEntityWrite(pool, entity, { id, data = {} }, allowedIds) {
  if (!allowedIds) return null;
  const inScope = (locationId) => !!locationId && allowedIds.includes(locationId);
  const denied = 'Você não tem acesso a este local';

  if (entity === 'Asset') {
    if (id) return inScope(await assetLocation(pool, id)) ? null : denied;
    return inScope(data.location_id) ? null : denied;
  }

  if (ASSET_CHILD_TABLES[entity]) {
    const assetIds = [];
    if (id) {
      const { rows } = await pool.query(`select asset_id from ${ASSET_CHILD_TABLES[entity]} where id = $1`, [id]);
      if (rows[0]) assetIds.push(rows[0].asset_id);
    }
    if (data.asset_id) assetIds.push(data.asset_id);
    if (assetIds.length === 0) return denied;
    for (const assetId of assetIds) {
      if (!inScope(await assetLocation(pool, assetId))) return denied;
    }
    return null;
  }

  if (entity === 'Inventory') {
    if (id) {
      const { rows } = await pool.query('select location_id from inventories where id = $1', [id]);
      if (!inScope(rows[0]?.location_id)) return denied;
    }
    if (!id || 'location_id' in data) return inScope(data.location_id) ? null : denied;
    return null;
  }

  if (entity === 'Location') {
    if (!id) return inScope(data.parent_location_id) ? null : denied;
    if (!inScope(id)) return denied;
    if (!('parent_location_id' in data)) return null;
    const { rows } = await pool.query('select parent_location_id from locations where id = $1', [id]);
    const unchanged = (rows[0]?.parent_location_id || null) === (data.parent_location_id || null);
    return unchanged || inScope(data.parent_location_id) ? null : denied;
  }

  return null;
}

// Mesma regra para as funções de negócio: todos os patrimônios precisam estar
// no escopo do usuário restrito.
export async function assetsOutsideScope(client, ids, allowedIds) {
  if (!allowedIds || ids.length === 0) return 0;
  const { rows } = await client.query(
    'select count(*)::int as count from assets where id = any($1::uuid[]) and (location_id is null or not (location_id = any($2::uuid[])))',
    [ids, allowedIds]
  );
  return rows[0].count;
}
