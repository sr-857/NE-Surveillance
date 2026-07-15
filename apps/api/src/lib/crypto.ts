import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { env } from '../config/env';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** SHA-256 hash used for refresh tokens — we never store the raw token. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

// ------------------------------------------------------------
// AES-256-GCM envelope encryption for integration credentials
// (API keys/endpoints for ASDMA, CWC, APDCL, etc. stored in
// IntegrationCredential.encryptedPayload).
// ------------------------------------------------------------

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const key = Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // pack iv + authTag + ciphertext into one base64 blob
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
