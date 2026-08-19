import { getPool } from '../_lib/db.js';
import { methodNotAllowed, requireUser, sendError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  const user = await requireUser(req, res);
  if (!user) return;
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
