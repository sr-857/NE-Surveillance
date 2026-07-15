import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../../src/middleware/rbac';
import type { Request, Response } from 'express';

function mockReq(role?: 'ADMIN' | 'ANALYST' | 'VIEWER'): Request {
  return { user: role ? { sub: 'u1', role, email: 'x@example.com' } : undefined } as unknown as Request;
}

describe('requireRole', () => {
  it('allows a higher role to access a lower-role-gated route', () => {
    const next = vi.fn();
    requireRole('VIEWER')(mockReq('ADMIN'), {} as Response, next);
    expect(next).toHaveBeenCalledWith(); // called with no error argument
  });

  it('allows an exact role match', () => {
    const next = vi.fn();
    requireRole('ANALYST')(mockReq('ANALYST'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a lower role attempting a higher-role-gated route', () => {
    const next = vi.fn();
    requireRole('ADMIN')(mockReq('VIEWER'), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    const errArg = next.mock.calls[0][0];
    expect(errArg).toBeDefined();
    expect(errArg.statusCode).toBe(403);
  });

  it('rejects an unauthenticated request', () => {
    const next = vi.fn();
    requireRole('VIEWER')(mockReq(undefined), {} as Response, next);
    const errArg = next.mock.calls[0][0];
    expect(errArg.statusCode).toBe(401);
  });
});
