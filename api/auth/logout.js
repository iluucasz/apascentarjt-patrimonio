import { clearSessionCookie } from '../_lib/session.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);
  clearSessionCookie(res);
  sendJson(res, 200, { success: true });
}
