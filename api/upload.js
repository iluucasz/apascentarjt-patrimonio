import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import { methodNotAllowed, requireUser, sendError, sendJson } from './_lib/http.js';

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  const user = await requireUser(req, res);
  if (!user) return;

  const { filename, contentType, dataBase64 } = req.body || {};
  if (!filename || !dataBase64) return sendError(res, 400, 'Arquivo inválido');

  const buffer = Buffer.from(dataBase64, 'base64');
  if (buffer.length > MAX_BYTES) return sendError(res, 413, 'Arquivo muito grande (máx. 15MB)');

  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const key = `${randomUUID()}-${safeName}`;

  const blob = await put(key, buffer, {
    access: 'public',
    contentType: contentType || 'application/octet-stream',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  sendJson(res, 200, { file_url: blob.url });
}
