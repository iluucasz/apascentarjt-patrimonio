// Mapeia cada entidade (nome usado pelo front) para sua tabela real no Postgres
// e a lista de colunas editáveis, com o tipo usado para coerção de valores.

import { SCOPE_CONDITIONS } from './scope.js';

export const ENTITIES = {
  SystemSettings: {
    table: 'system_settings',
    columns: {
      church_name: 'text',
      church_logo_url: 'text',
      logo_bg_color: 'text',
      asset_prefix: 'text',
      next_asset_sequence: 'number',
      digit_count: 'number',
      public_asset_lookup: 'boolean',
    },
  },
  Category: {
    table: 'categories',
    columns: {
      name: 'text',
      description: 'text',
      active: 'boolean',
    },
  },
  Location: {
    table: 'locations',
    columns: {
      name: 'text',
      description: 'text',
      parent_location_id: 'uuid',
      parent_location_name: 'text',
      active: 'boolean',
      is_main: 'boolean',
      logo_url: 'text',
      logo_bg_color: 'text',
    },
  },
  Asset: {
    table: 'assets',
    columns: {
      asset_number: 'text',
      name: 'text',
      description: 'text',
      category_id: 'uuid',
      category_name: 'text',
      brand: 'text',
      model: 'text',
      serial_number: 'text',
      location_id: 'uuid',
      location_name: 'text',
      responsible_person: 'text',
      acquisition_date: 'date',
      acquisition_value: 'number',
      supplier: 'text',
      invoice_number: 'text',
      status: 'text',
      condition: 'text',
      notes: 'text',
      photo_url: 'text',
      archived_at: 'timestamptz',
      disposed_reason: 'text',
      disposed_notes: 'text',
      variant: 'text',
      batch_id: 'uuid',
      location_detail: 'text',
    },
  },
  AssetMovement: {
    table: 'asset_movements',
    columns: {
      asset_id: 'uuid',
      asset_number: 'text',
      asset_name: 'text',
      from_location_id: 'uuid',
      from_location_name: 'text',
      to_location_id: 'uuid',
      to_location_name: 'text',
      responsible_person: 'text',
      movement_type: 'text',
      notes: 'text',
      moved_by_name: 'text',
    },
  },
  MaintenanceRecord: {
    table: 'maintenance_records',
    columns: {
      asset_id: 'uuid',
      asset_number: 'text',
      asset_name: 'text',
      description: 'text',
      provider: 'text',
      start_date: 'date',
      end_date: 'date',
      cost: 'number',
      status: 'text',
      notes: 'text',
      created_by_name: 'text',
    },
  },
  AssetDocument: {
    table: 'asset_documents',
    columns: {
      asset_id: 'uuid',
      asset_number: 'text',
      name: 'text',
      type: 'text',
      file_url: 'text',
      uploaded_by_name: 'text',
    },
  },
  AuditLog: {
    table: 'audit_logs',
    columns: {
      action: 'text',
      entity_type: 'text',
      entity_id: 'text',
      entity_label: 'text',
      old_data: 'jsonb',
      new_data: 'jsonb',
      user_name: 'text',
    },
  },
  Inventory: {
    table: 'inventories',
    columns: {
      name: 'text',
      location_id: 'uuid',
      location_name: 'text',
      all_locations: 'boolean',
      status: 'text',
      started_at: 'timestamptz',
      finished_at: 'timestamptz',
      created_by_name: 'text',
      summary: 'jsonb',
    },
  },
  InventoryItem: {
    table: 'inventory_items',
    columns: {
      inventory_id: 'uuid',
      asset_id: 'uuid',
      asset_number: 'text',
      asset_name: 'text',
      expected_location_id: 'uuid',
      expected_location_name: 'text',
      found_location_id: 'uuid',
      found_location_name: 'text',
      status: 'text',
      scanned_at: 'timestamptz',
      scanned_by_name: 'text',
      notes: 'text',
    },
  },
  User: {
    table: 'users',
    columns: {
      email: 'text',
      full_name: 'text',
      role: 'text',
      email_verified: 'boolean',
      invited: 'boolean',
      allowed_location_ids: 'uuid[]',
    },
    // password_hash nunca é exposto nem editável via API genérica de entidades.
    secret: true,
  },
};

const META_FIELDS = ['id', 'created_date', 'updated_date'];

export function getEntityConfig(name) {
  return ENTITIES[name] || null;
}

function coerceValue(type, value) {
  if (value === undefined) return undefined;
  if (value === '' && type !== 'text') return null;
  if (value === null) return null;
  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'jsonb':
      return JSON.stringify(value);
    case 'uuid[]':
      return Array.isArray(value) && value.length > 0 ? value : null;
    default:
      return value;
  }
}

function buildColumnValues(config, data) {
  const cols = [];
  const values = [];
  for (const [col, type] of Object.entries(config.columns)) {
    if (!(col in data)) continue;
    const value = coerceValue(type, data[col]);
    if (value === undefined) continue;
    cols.push(col);
    values.push(value);
  }
  return { cols, values };
}

// Colunas que nunca saem pela API genérica. Selecionar * e remover depois (em
// vez de listar as colunas no select) evita quebrar a leitura quando uma
// coluna nova ainda não foi criada pela migração.
const SECRET_COLUMNS = ['password_hash'];

function clean(config, row) {
  if (!row || !config.secret) return row;
  const out = { ...row };
  for (const col of SECRET_COLUMNS) delete out[col];
  return out;
}

function assertSortField(config, field) {
  if (META_FIELDS.includes(field) || field in config.columns) return field;
  throw new Error(`Campo de ordenação inválido: ${field}`);
}

// Condição de escopo por filial/local (ver _lib/scope.js). scopeIds null = sem
// filtro; array (mesmo vazio) = só registros desses locais.
function pushScope(name, scopeIds, where, params) {
  const condition = SCOPE_CONDITIONS[name];
  if (!condition || !scopeIds) return;
  params.push(scopeIds);
  where.push(condition(`$${params.length}`));
}

function orderBy(config, sort) {
  if (!sort) return ' order by created_date asc';
  const desc = sort.startsWith('-');
  const field = assertSortField(config, desc ? sort.slice(1) : sort);
  return ` order by ${field} ${desc ? 'desc' : 'asc'}`;
}

export async function listEntity(pool, name, { sort, limit, scopeIds = null } = {}) {
  return filterEntity(pool, name, { sort, limit, scopeIds });
}

export async function filterEntity(pool, name, { query = {}, sort, limit, scopeIds = null } = {}) {
  const config = getEntityConfig(name);
  const params = [];
  const where = [];
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'id' && !(key in config.columns)) continue;
    params.push(value);
    where.push(`${key} = $${params.length}`);
  }
  pushScope(name, scopeIds, where, params);
  let sql = `select * from ${config.table}`;
  if (where.length) sql += ` where ${where.join(' and ')}`;
  sql += orderBy(config, sort);
  if (limit) {
    params.push(Number(limit));
    sql += ` limit $${params.length}`;
  }
  const { rows } = await pool.query(sql, params);
  return rows.map((row) => clean(config, row));
}

export async function getEntity(pool, name, id, { scopeIds = null } = {}) {
  const rows = await filterEntity(pool, name, { query: { id }, scopeIds });
  return rows[0] || null;
}

export async function createEntity(pool, name, data) {
  const config = getEntityConfig(name);
  const { cols, values } = buildColumnValues(config, data);
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const sql = cols.length
    ? `insert into ${config.table} (${cols.join(', ')}) values (${placeholders.join(', ')}) returning *`
    : `insert into ${config.table} default values returning *`;
  const { rows } = await pool.query(sql, values);
  return clean(config, rows[0]);
}

export async function bulkCreateEntity(pool, name, dataArray) {
  const config = getEntityConfig(name);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const created = [];
    for (const data of dataArray) {
      const { cols, values } = buildColumnValues(config, data);
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      const sql = cols.length
        ? `insert into ${config.table} (${cols.join(', ')}) values (${placeholders.join(', ')}) returning *`
        : `insert into ${config.table} default values returning *`;
      const { rows } = await client.query(sql, values);
      created.push(clean(config, rows[0]));
    }
    await client.query('commit');
    return created;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateEntity(pool, name, id, data) {
  const config = getEntityConfig(name);
  const { cols, values } = buildColumnValues(config, data);
  const sets = cols.map((col, i) => `${col} = $${i + 2}`);
  sets.push('updated_date = now()');
  const sql = `update ${config.table} set ${sets.join(', ')} where id = $1 returning *`;
  const { rows } = await pool.query(sql, [id, ...values]);
  if (!rows[0]) throw new Error(`${name} ${id} não encontrado`);
  return clean(config, rows[0]);
}

export async function deleteEntity(pool, name, id) {
  const config = getEntityConfig(name);
  await pool.query(`delete from ${config.table} where id = $1`, [id]);
  return { success: true };
}
