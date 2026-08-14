const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'manager') {
      return Response.json({ error: 'Sem permissão para cadastrar patrimônio' }, { status: 403 });
    }

    const body = await req.json();
    const data = body || {};

    // Load settings (service role to always access the single settings record)
    const settingsList = await db.asServiceRole.entities.SystemSettings.list();
    const settings = settingsList[0] || null;
    const prefix = (settings && settings.asset_prefix) || 'PAT';
    const digits = (settings && settings.digit_count) || 6;
    const seq = (settings && settings.next_asset_sequence) || 1;

    const asset_number = `${prefix}-${String(seq).padStart(digits, '0')}`;

    // Create the asset
    const asset = await db.entities.Asset.create({
      asset_number,
      name: data.name,
      description: data.description || '',
      category_id: data.category_id || '',
      category_name: data.category_name || '',
      brand: data.brand || '',
      model: data.model || '',
      serial_number: data.serial_number || '',
      location_id: data.location_id || '',
      location_name: data.location_name || '',
      responsible_person: data.responsible_person || '',
      acquisition_date: data.acquisition_date || null,
      acquisition_value: data.acquisition_value || 0,
      supplier: data.supplier || '',
      invoice_number: data.invoice_number || '',
      status: data.status || 'active',
      condition: data.condition || 'good',
      notes: data.notes || '',
      photo_url: data.photo_url || ''
    });

    // Increment sequence (service role)
    if (settings) {
      await db.asServiceRole.entities.SystemSettings.update(settings.id, {
        next_asset_sequence: seq + 1
      });
    }

    // Audit log
    await db.entities.AuditLog.create({
      action: 'asset_create',
      entity_type: 'Asset',
      entity_id: asset.id,
      entity_label: asset_number,
      new_data: asset,
      user_name: user.full_name || user.email
    });

    return Response.json({ asset });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}