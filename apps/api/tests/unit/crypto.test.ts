import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, hashToken, randomToken, encryptSecret, decryptSecret } from '../../src/lib/crypto';

describe('password hashing', () => {
  it('produces a hash that verifies correctly against the original password', async () => {
    const hash = await hashPassword('CorrectHorseBattery9');
    expect(hash).not.toEqual('CorrectHorseBattery9');
    await expect(verifyPassword('CorrectHorseBattery9', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('CorrectHorseBattery9');
    await expect(verifyPassword('WrongPassword123', hash)).resolves.toBe(false);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const a = await hashPassword('SamePassword123');
    const b = await hashPassword('SamePassword123');
    expect(a).not.toEqual(b);
  });
});

describe('token hashing', () => {
  it('is deterministic (same input -> same hash) so refresh tokens can be looked up by hash', () => {
    const token = randomToken();
    expect(hashToken(token)).toEqual(hashToken(token));
  });

  it('generates unique random tokens', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toEqual(b);
  });
});

describe('envelope encryption (integration credentials at rest)', () => {
  it('round-trips arbitrary JSON payloads', () => {
    const payload = JSON.stringify({ baseUrl: 'https://example.gov.in/api', apiKey: 'super-secret-value' });
    const encrypted = encryptSecret(payload);
    expect(encrypted).not.toContain('super-secret-value');
    expect(decryptSecret(encrypted)).toEqual(payload);
  });

  it('produces different ciphertext for the same plaintext on each call (random IV)', () => {
    const a = encryptSecret('same-plaintext');
    const b = encryptSecret('same-plaintext');
    expect(a).not.toEqual(b);
    expect(decryptSecret(a)).toEqual('same-plaintext');
    expect(decryptSecret(b)).toEqual('same-plaintext');
  });

  it('throws when the ciphertext has been tampered with (auth tag mismatch)', () => {
    const encrypted = encryptSecret('sensitive-data');
    const tampered = encrypted.slice(0, -4) + 'abcd';
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
