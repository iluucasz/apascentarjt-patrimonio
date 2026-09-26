// Um único arquivo para /api/functions/:name — dispatcher para as "funções de
// negócio" nomeadas (equivalente ao antigo db.functions.invoke do mock). O
// plano Hobby da Vercel limita a 12 Serverless Functions por deployment, e
// isso deixa espaço para adicionar mais funções aqui sem criar novos arquivos.

import { randomUUID } from 'node:crypto';

import { getPool } from '../_lib/db.js';
import { methodNotAllowed, requireUser, sendError, sendJson } from '../_lib/http.js';

async function createAsset(req, res, user) {
  if (user.role !== 'admin' && user.role !== 'manager') {
    return sendError(res, 403, 'Sem permissão para cadastrar patrimônio');
  }

  const payload = req.body || {};
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: settingsRows } = await client.query(
      'select * from system_settings order by created_date asc limit 1 for update'
    );
    const settings = settingsRows[0] || null;
    const prefix = settings?.asset_prefix || 'PAT';
    const digits = settings?.digit_count || 6;
    const seq = settings?.next_asset_sequence || 1;
    const asset_number = `${prefix}-${String(seq).padStart(digits, '0')}`;

    const { rows: assetRows } = await client.query(
      `insert into assets (
        asset_number, name, description, category_id, category_name, brand, model,
        serial_number, location_id, location_name, responsible_person, acquisition_date,
        acquisition_value, supplier, invoice_number, status, condition, notes, photo_url
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      returning *`,
      [
        asset_number,
        payload.name,
        payload.description || '',
        payload.category_id || null,
        payload.category_name || '',
        payload.brand || '',
        payload.model || '',
        payload.serial_number || '',
        payload.location_id || null,
        payload.location_name || '',
        payload.responsible_person || '',
        payload.acquisition_date || null,
        payload.acquisition_value || 0,
        payload.supplier || '',
        payload.invoice_number || '',
        payload.status || 'active',
        payload.condition || 'good',
        payload.notes || '',
        payload.photo_url || '',
      ]
    );
    const asset = assetRows[0];

    if (settings) {
      await client.query('update system_settings set next_asset_sequence = $1, updated_date = now() where id = $2', [
        seq + 1,
        settings.id,
      ]);
    }

    await client.query(
      `insert into audit_logs (action, entity_type, entity_id, entity_label, new_data, user_name)
       values ($1,$2,$3,$4,$5,$6)`,
      ['asset_create', 'Asset', asset.id, asset_number, JSON.stringify(asset), user.full_name || user.email]
    );

    await client.query('commit');
    sendJson(res, 201, { data: { asset } });
  } catch (err) {
    await client.query('rollback');
    sendError(res, 500, err.message);
  } finally {
    client.release();
  }
}

const MAX_BATCH_QUANTITY = 1000;

async function createAssetBatch(req, res, user) {
  if (user.role !== 'admin' && user.role !== 'manager') {
    return sendError(res, 403, 'Sem permissão para cadastrar patrimônio');
  }

  const payload = req.body || {};
  const variants = Array.isArray(payload.variants) ? payload.variants : [];
  const cleanVariants = variants
    .map((v) => ({ label: String(v?.label || '').trim(), quantity: Number(v?.quantity) || 0 }))
    .filter((v) => v.quantity > 0);
  const total = cleanVariants.reduce((sum, v) => sum + v.quantity, 0);

  if (!payload.name) return sendError(res, 400, 'Informe o nome do patrimônio');
  if (total < 1) return sendError(res, 400, 'Informe ao menos uma variante com quantidade');
  if (total > MAX_BATCH_QUANTITY) {
    return sendError(res, 400, `Máximo de ${MAX_BATCH_QUANTITY} unidades por lote`);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: settingsRows } = await client.query(
      'select * from system_settings order by created_date asc limit 1 for update'
    );
    const settings = settingsRows[0] || null;
    const prefix = settings?.asset_prefix || 'PAT';
    const digits = settings?.digit_count || 6;
    const startSeq = settings?.next_asset_sequence || 1;
    const batch_id = randomUUID();

    const sharedValues = [
      payload.description || '',
      payload.category_id || null,
      payload.category_name || '',
      payload.brand || '',
      payload.model || '',
      payload.location_id || null,
      payload.location_name || '',
      payload.responsible_person || '',
      payload.acquisition_date || null,
      payload.acquisition_value || 0,
      payload.supplier || '',
      payload.invoice_number || '',
      payload.status || 'active',
      payload.condition || 'good',
      payload.notes || '',
      payload.photo_url || '',
    ];
    const SHARED_COLS = [
      'description', 'category_id', 'category_name', 'brand', 'model',
      'location_id', 'location_name', 'responsible_person', 'acquisition_date',
      'acquisition_value', 'supplier', 'invoice_number', 'status', 'condition',
      'notes', 'photo_url',
    ];

    const cols = ['asset_number', 'name', ...SHARED_COLS, 'variant', 'batch_id'];
    const valueRows = [];
    const params = [];
    let seq = startSeq;
    for (const variant of cleanVariants) {
      for (let i = 0; i < variant.quantity; i++) {
        const asset_number = `${prefix}-${String(seq).padStart(digits, '0')}`;
        seq += 1;
        const rowValues = [asset_number, payload.name, ...sharedValues, variant.label, batch_id];
        const placeholders = rowValues.map((_, idx) => `$${params.length + idx + 1}`);
        valueRows.push(`(${placeholders.join(', ')})`);
        params.push(...rowValues);
      }
    }

    const { rows: assets } = await client.query(
      `insert into assets (${cols.join(', ')}) values ${valueRows.join(', ')} returning *`,
      params
    );

    if (settings) {
      await client.query('update system_settings set next_asset_sequence = $1, updated_date = now() where id = $2', [
        seq,
        settings.id,
      ]);
    }

    const first_asset_number = assets[0].asset_number;
    const last_asset_number = assets[assets.length - 1].asset_number;

    await client.query(
      `insert into audit_logs (action, entity_type, entity_id, entity_label, new_data, user_name)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        'asset_batch_create',
        'Asset',
        batch_id,
        `${payload.name} (x${total})`,
        JSON.stringify({ batch_id, count: total, first_asset_number, last_asset_number, variants: cleanVariants }),
        user.full_name || user.email,
      ]
    );

    await client.query('commit');
    sendJson(res, 201, { data: { batch_id, count: total, first_asset_number, last_asset_number, assets } });
  } catch (err) {
    await client.query('rollback');
    sendError(res, 500, err.message);
  } finally {
    client.release();
  }
}

const ASSET_STATUSES = ['active', 'maintenance', 'loaned', 'storage', 'disposed', 'lost'];
const ASSET_CONDITIONS = ['new', 'excellent', 'good', 'fair', 'poor', 'damaged'];
const MOVEMENT_TYPES = ['transfer', 'loan', 'return', 'allocation'];

// Trava a linha de system_settings até o commit (mesmo esquema de
// createAsset/createAssetBatch) e devolve um "cursor" da sequência patrimonial.
async function lockSequence(client) {
  const { rows } = await client.query(
    'select * from system_settings order by created_date asc limit 1 for update'
  );
  const settings = rows[0] || null;
  return {
    settings,
    prefix: settings?.asset_prefix || 'PAT',
    digits: settings?.digit_count || 6,
    next: settings?.next_asset_sequence || 1,
  };
}

function takeAssetNumbers(seq, count) {
  const numbers = [];
  for (let i = 0; i < count; i++) {
    numbers.push(`${seq.prefix}-${String(seq.next).padStart(seq.digits, '0')}`);
    seq.next += 1;
  }
  return numbers;
}

async function saveSequence(client, seq) {
  if (!seq.settings) return;
  await client.query('update system_settings set next_asset_sequence = $1, updated_date = now() where id = $2', [
    seq.next,
    seq.settings.id,
  ]);
}

// Colunas copiadas de uma unidade existente ao criar novas unidades de um lote.
// Número de série e dados de baixa ficam de fora: são individuais da unidade.
const CLONE_COLS = [
  'name', 'description', 'category_id', 'category_name', 'brand', 'model',
  'location_id', 'location_name', 'responsible_person', 'acquisition_date',
  'acquisition_value', 'supplier', 'invoice_number', 'status', 'condition',
  'notes', 'photo_url',
];

// `overrides` troca o valor copiado de algumas colunas (ex.: local/status das
// unidades novas de um lote cujas unidades já divergiram).
async function cloneUnits(client, templateId, assetNumbers, { variant, batch_id, overrides = {} }) {
  const params = [templateId, assetNumbers, variant, batch_id];
  const selectCols = CLONE_COLS.map((col) => {
    if (!(col in overrides)) return `t.${col}`;
    params.push(overrides[col]);
    return col === 'location_id' ? `$${params.length}::uuid` : `$${params.length}`;
  });
  const { rows } = await client.query(
    `insert into assets (asset_number, ${CLONE_COLS.join(', ')}, variant, batch_id)
     select n.asset_number, ${selectCols.join(', ')}, $3, $4
     from assets t cross join unnest($2::text[]) as n(asset_number)
     where t.id = $1
     returning *`,
    params
  );
  return rows;
}

// Valor mais frequente de `key` entre as unidades (desempate: o que aparece antes).
function mostCommon(units, key) {
  const counts = new Map();
  for (const u of units) counts.set(u[key], (counts.get(u[key]) || 0) + 1);
  let best = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) { best = value; bestCount = count; }
  }
  return best;
}

// Registra uma movimentação por unidade (com o local de origem de cada uma) e
// só depois atualiza o local, para o histórico ficar igual ao da movimentação
// individual feita em AssetDetail.
async function moveUnits(client, ids, move) {
  if (ids.length === 0) return 0;
  await client.query(
    `insert into asset_movements (
      asset_id, asset_number, asset_name, from_location_id, from_location_name,
      to_location_id, to_location_name, responsible_person, movement_type, notes, moved_by_name
    )
    select a.id, a.asset_number, a.name, a.location_id, a.location_name, $2, $3, $4, $5, $6, $7
    from assets a where a.id = any($1::uuid[])`,
    [
      ids,
      move.to_location_id,
      move.to_location_name,
      move.responsible_person || '',
      move.movement_type,
      move.notes || '',
      move.moved_by_name,
    ]
  );
  const { rowCount } = await client.query(
    'update assets set location_id = $2, location_name = $3, updated_date = now() where id = any($1::uuid[])',
    [ids, move.to_location_id, move.to_location_name]
  );
  return rowCount;
}

async function findLocationName(client, locationId) {
  const { rows } = await client.query('select name from locations where id = $1', [locationId]);
  return rows[0] ? rows[0].name : null;
}

async function updateAssetBatch(req, res, user) {
  if (user.role !== 'admin' && user.role !== 'manager') {
    return sendError(res, 403, 'Sem permissão para editar patrimônio');
  }

  const payload = req.body || {};
  const batch_id = payload.batch_id;
  if (!batch_id) return sendError(res, 400, 'Informe o lote');
  if (!payload.name) return sendError(res, 400, 'Informe o nome do patrimônio');

  // status/condition/location_id vazios = "manter o de cada unidade" (o lote
  // pode já ter unidades divergentes, movidas ou consertadas individualmente).
  const status = ASSET_STATUSES.includes(payload.status) ? payload.status : null;
  const condition = ASSET_CONDITIONS.includes(payload.condition) ? payload.condition : null;
  const locationId = payload.location_id || null;

  // Quantidade desejada e foto de cada variante. Uma variante que não aparece
  // na lista não é alterada.
  const targets = Array.isArray(payload.variants)
    ? payload.variants.map((v) => ({
        variant: String(v?.variant ?? ''),
        quantity: Math.max(0, Math.floor(Number(v?.quantity) || 0)),
        photo_url: String(v?.photo_url ?? ''),
      }))
    : [];
  if (new Set(targets.map((t) => t.variant)).size !== targets.length) {
    return sendError(res, 400, 'Há variantes repetidas');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: units } = await client.query(
      `select id, variant, status, condition, location_id, location_name from assets
       where batch_id = $1 order by created_date asc, asset_number asc for update`,
      [batch_id]
    );
    if (units.length === 0) {
      await client.query('rollback');
      return sendError(res, 404, 'Lote não encontrado');
    }

    const unitsByVariant = new Map();
    for (const u of units) {
      if (!unitsByVariant.has(u.variant)) unitsByVariant.set(u.variant, []);
      unitsByVariant.get(u.variant).push(u);
    }
    const currentCount = (variant) => unitsByVariant.get(variant)?.length || 0;
    const finalTotal = units.length + targets.reduce((sum, t) => sum + t.quantity - currentCount(t.variant), 0);
    if (finalTotal < 1) {
      await client.query('rollback');
      return sendError(res, 400, 'O lote precisa ter ao menos uma unidade. Para apagar tudo, use "Excluir lote inteiro".');
    }
    if (finalTotal > MAX_BATCH_QUANTITY) {
      await client.query('rollback');
      return sendError(res, 400, `Máximo de ${MAX_BATCH_QUANTITY} unidades por lote`);
    }
    if (user.role !== 'admin' && targets.some((t) => t.quantity < currentCount(t.variant))) {
      await client.query('rollback');
      return sendError(res, 403, 'Apenas administradores podem reduzir a quantidade (as unidades removidas são excluídas)');
    }

    const sharedCols = [
      'name', 'description', 'category_id', 'category_name', 'brand', 'model',
      'responsible_person', 'acquisition_date', 'acquisition_value', 'supplier',
      'invoice_number', 'notes',
    ];
    const sharedValues = [
      payload.name,
      payload.description || '',
      payload.category_id || null,
      payload.category_name || '',
      payload.brand || '',
      payload.model || '',
      payload.responsible_person || '',
      payload.acquisition_date || null,
      payload.acquisition_value || 0,
      payload.supplier || '',
      payload.invoice_number || '',
      payload.notes || '',
    ];
    if (status) { sharedCols.push('status'); sharedValues.push(status); }
    if (condition) { sharedCols.push('condition'); sharedValues.push(condition); }
    const setClause = sharedCols.map((col, i) => `${col} = $${i + 2}`).join(', ');
    // serial_number fica de fora de propósito: é sempre individual de cada
    // unidade e continua editável em /patrimonios/:id/editar.
    await client.query(
      `update assets set ${setClause}, updated_date = now() where batch_id = $1`,
      [batch_id, ...sharedValues]
    );

    // Reduzir remove as unidades mais recentes da variante; para escolher
    // exatamente quais unidades sair, a tela do lote tem seleção + excluir.
    const removeIds = new Set();
    for (const t of targets) {
      const current = unitsByVariant.get(t.variant) || [];
      current.slice(t.quantity).forEach((u) => removeIds.add(u.id));
    }
    const keptUnits = units.filter((u) => !removeIds.has(u.id));

    let moved = 0;
    let location = null;
    if (locationId) {
      const locationName = await findLocationName(client, locationId);
      if (locationName === null) {
        await client.query('rollback');
        return sendError(res, 404, 'Local não encontrado');
      }
      location = { id: locationId, name: locationName };
      moved = await moveUnits(
        client,
        keptUnits.filter((u) => u.location_id !== locationId).map((u) => u.id),
        {
          to_location_id: locationId,
          to_location_name: locationName,
          movement_type: 'transfer',
          notes: 'Local alterado na edição do lote',
          moved_by_name: user.full_name || user.email,
        }
      );
    }

    // Unidades novas entram no local/status/condição predominantes do lote (e
    // não nos de uma unidade que por acaso foi movida ou quebrou).
    const reference = keptUnits.length > 0 ? keptUnits : units;
    if (!location) {
      const commonLocationId = mostCommon(reference, 'location_id');
      const unit = reference.find((u) => u.location_id === commonLocationId);
      location = { id: commonLocationId, name: unit.location_name };
    }
    const overrides = {
      location_id: location.id,
      location_name: location.name,
      status: status || mostCommon(reference.filter((u) => u.status !== 'disposed'), 'status') || 'active',
      condition: condition || mostCommon(reference, 'condition'),
    };
    let seq = null;
    let added = 0;
    for (const t of targets) {
      const current = unitsByVariant.get(t.variant) || [];
      if (t.quantity <= current.length) continue;
      // Copia os demais campos de uma unidade da mesma variante; variante nova
      // usa uma unidade qualquer do lote.
      const template = current[0] || reference[0];
      if (!seq) seq = await lockSequence(client);
      const created = await cloneUnits(client, template.id, takeAssetNumbers(seq, t.quantity - current.length), {
        variant: t.variant,
        batch_id,
        overrides,
      });
      added += created.length;
    }
    if (seq) await saveSequence(client, seq);
    if (removeIds.size > 0) {
      await client.query('delete from assets where id = any($1::uuid[])', [[...removeIds]]);
    }

    for (const t of targets) {
      await client.query(
        'update assets set photo_url = $1, updated_date = now() where batch_id = $2 and variant = $3',
        [t.photo_url, batch_id, t.variant]
      );
    }

    await client.query(
      `insert into audit_logs (action, entity_type, entity_id, entity_label, new_data, user_name)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        'asset_batch_update',
        'Asset',
        batch_id,
        `${payload.name} (lote)`,
        JSON.stringify({ batch_id, count: finalTotal, added, removed: removeIds.size, moved, status, condition }),
        user.full_name || user.email,
      ]
    );

    await client.query('commit');
    sendJson(res, 200, { data: { count: finalTotal, added, removed: removeIds.size, moved } });
  } catch (err) {
    await client.query('rollback');
    sendError(res, 500, err.message);
  } finally {
    client.release();
  }
}

// Transforma um patrimônio avulso num lote com `quantity` unidades: o item
// original ganha um batch_id e as demais unidades são cópias dele.
async function expandAsset(req, res, user) {
  if (user.role !== 'admin' && user.role !== 'manager') {
    return sendError(res, 403, 'Sem permissão para cadastrar patrimônio');
  }

  const payload = req.body || {};
  const quantity = Math.floor(Number(payload.quantity) || 0);
  if (!payload.asset_id) return sendError(res, 400, 'Informe o patrimônio');
  if (quantity < 2) return sendError(res, 400, 'Informe uma quantidade maior que 1');
  if (quantity > MAX_BATCH_QUANTITY) {
    return sendError(res, 400, `Máximo de ${MAX_BATCH_QUANTITY} unidades por lote`);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows } = await client.query('select * from assets where id = $1 for update', [payload.asset_id]);
    const asset = rows[0];
    if (!asset) {
      await client.query('rollback');
      return sendError(res, 404, 'Patrimônio não encontrado');
    }
    if (asset.batch_id) {
      await client.query('rollback');
      return sendError(res, 400, 'Este patrimônio já faz parte de um lote; altere a quantidade em "Editar lote"');
    }

    const batch_id = randomUUID();
    await client.query('update assets set batch_id = $1, updated_date = now() where id = $2', [batch_id, asset.id]);
    const seq = await lockSequence(client);
    const created = await cloneUnits(client, asset.id, takeAssetNumbers(seq, quantity - 1), {
      variant: asset.variant,
      batch_id,
    });
    await saveSequence(client, seq);

    await client.query(
      `insert into audit_logs (action, entity_type, entity_id, entity_label, new_data, user_name)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        'asset_batch_create',
        'Asset',
        batch_id,
        `${asset.name} (x${quantity})`,
        JSON.stringify({ batch_id, count: quantity, from_asset_number: asset.asset_number }),
        user.full_name || user.email,
      ]
    );

    await client.query('commit');
    sendJson(res, 200, { data: { batch_id, count: quantity, added: created.length } });
  } catch (err) {
    await client.query('rollback');
    sendError(res, 500, err.message);
  } finally {
    client.release();
  }
}

async function moveAssets(req, res, user) {
  if (user.role !== 'admin' && user.role !== 'manager') {
    return sendError(res, 403, 'Sem permissão para movimentar patrimônio');
  }

  const payload = req.body || {};
  const ids = Array.isArray(payload.ids) ? payload.ids.filter(Boolean) : [];
  if (ids.length === 0) return sendError(res, 400, 'Selecione ao menos um patrimônio');
  if (!payload.to_location_id) return sendError(res, 400, 'Selecione o novo local');
  const movement_type = MOVEMENT_TYPES.includes(payload.movement_type) ? payload.movement_type : 'transfer';

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const locationName = await findLocationName(client, payload.to_location_id);
    if (locationName === null) {
      await client.query('rollback');
      return sendError(res, 404, 'Local não encontrado');
    }
    const count = await moveUnits(client, ids, {
      to_location_id: payload.to_location_id,
      to_location_name: locationName,
      responsible_person: payload.responsible_person,
      movement_type,
      notes: payload.notes,
      moved_by_name: user.full_name || user.email,
    });

    await client.query(
      `insert into audit_logs (action, entity_type, entity_id, entity_label, new_data, user_name)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        'asset_batch_move',
        'Asset',
        payload.batch_id || '',
        `${count} patrimônio${count === 1 ? '' : 's'} → ${locationName}`,
        JSON.stringify({ ids, to_location_id: payload.to_location_id, movement_type }),
        user.full_name || user.email,
      ]
    );

    await client.query('commit');
    sendJson(res, 200, { data: { count } });
  } catch (err) {
    await client.query('rollback');
    sendError(res, 500, err.message);
  } finally {
    client.release();
  }
}

// Altera status e/ou condição de várias unidades de uma vez (ex.: 5 cadeiras
// de um lote de 100 que quebraram).
async function updateAssetsState(req, res, user) {
  if (user.role !== 'admin' && user.role !== 'manager') {
    return sendError(res, 403, 'Sem permissão para editar patrimônio');
  }

  const payload = req.body || {};
  const ids = Array.isArray(payload.ids) ? payload.ids.filter(Boolean) : [];
  const status = ASSET_STATUSES.includes(payload.status) ? payload.status : null;
  const condition = ASSET_CONDITIONS.includes(payload.condition) ? payload.condition : null;
  if (ids.length === 0) return sendError(res, 400, 'Selecione ao menos um patrimônio');
  if (!status && !condition) return sendError(res, 400, 'Informe o status ou a condição');

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rowCount } = await client.query(
      `update assets set status = coalesce($2, status), condition = coalesce($3, condition), updated_date = now()
       where id = any($1::uuid[])`,
      [ids, status, condition]
    );

    await client.query(
      `insert into audit_logs (action, entity_type, entity_id, entity_label, new_data, user_name)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        'asset_batch_update',
        'Asset',
        payload.batch_id || '',
        `${rowCount} patrimônio${rowCount === 1 ? '' : 's'} (status/condição)`,
        JSON.stringify({ ids, status, condition }),
        user.full_name || user.email,
      ]
    );

    await client.query('commit');
    sendJson(res, 200, { data: { count: rowCount } });
  } catch (err) {
    await client.query('rollback');
    sendError(res, 500, err.message);
  } finally {
    client.release();
  }
}

async function deleteAssetBatch(req, res, user) {
  if (user.role !== 'admin') {
    return sendError(res, 403, 'Apenas administradores podem excluir patrimônios');
  }

  const payload = req.body || {};
  const batch_id = payload.batch_id;
  if (!batch_id) return sendError(res, 400, 'Informe o lote');
  const ids = Array.isArray(payload.ids) ? payload.ids.filter(Boolean) : null;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows } = ids && ids.length > 0
      ? await client.query('delete from assets where batch_id = $1 and id = any($2::uuid[]) returning id, asset_number', [batch_id, ids])
      : await client.query('delete from assets where batch_id = $1 returning id, asset_number', [batch_id]);
    const count = rows.length;

    if (count > 0) {
      await client.query(
        `insert into audit_logs (action, entity_type, entity_id, entity_label, new_data, user_name)
         values ($1,$2,$3,$4,$5,$6)`,
        [
          'asset_batch_delete',
          'Asset',
          batch_id,
          `lote (${count} unidade${count === 1 ? '' : 's'} excluída${count === 1 ? '' : 's'})`,
          JSON.stringify({ batch_id, count, asset_numbers: rows.map((r) => r.asset_number) }),
          user.full_name || user.email,
        ]
      );
    }

    await client.query('commit');
    sendJson(res, 200, { data: { count } });
  } catch (err) {
    await client.query('rollback');
    sendError(res, 500, err.message);
  } finally {
    client.release();
  }
}

const FUNCTIONS = {
  'create-asset': createAsset,
  'create-asset-batch': createAssetBatch,
  'update-asset-batch': updateAssetBatch,
  'delete-asset-batch': deleteAssetBatch,
  'expand-asset': expandAsset,
  'move-assets': moveAssets,
  'update-assets-state': updateAssetsState,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  const fn = FUNCTIONS[req.query.name];
  if (!fn) return sendError(res, 404, `Função desconhecida: ${req.query.name}`);

  const user = await requireUser(req, res);
  if (!user) return;

  return fn(req, res, user);
}
