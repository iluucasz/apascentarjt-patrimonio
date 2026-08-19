import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, 'hex');
  const candidateBuf = scryptSync(password, salt, 64);
  if (hashBuf.length !== candidateBuf.length) return false;
  return timingSafeEqual(hashBuf, candidateBuf);
}

export function genOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function genToken() {
  return randomUUID();
}
