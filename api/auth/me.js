import { requireUser, sanitizeUser, sendJson, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);
  const user = await requireUser(req, res);
  if (!user) return;
  sendJson(res, 200, sanitizeUser(user));
}
