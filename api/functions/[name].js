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

const FUNCTIONS = {
  'create-asset': createAsset,
  'create-asset-batch': createAssetBatch,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  const fn = FUNCTIONS[req.query.name];
  if (!fn) return sendError(res, 404, `Função desconhecida: ${req.query.name}`);

  const user = await requireUser(req, res);
  if (!user) return;

  return fn(req, res, user);
}
