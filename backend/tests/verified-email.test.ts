import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { user: { findUnique: vi.fn() } } }));
vi.mock('../src/config/db.js', () => ({ prisma: prismaMock }));
vi.mock('../src/utils/jwt.js', () => ({ verifyAccessToken: vi.fn() }));
const { requireVerifiedEmail } = await import('../src/middleware/auth.js');

function run() {
  const res: any = { locals: { requestId: 'r1' }, status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  return requireVerifiedEmail({ userId: 'u1' } as any, res, next).then(() => ({ res, next }));
}

describe('requireVerifiedEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks unverified accounts with email_verification_required', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ emailVerified: false });
    const { res, next } = await run();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'email_verification_required' }));
  });

  it('blocks when the user row is missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const { next } = await run();
    expect(next).not.toHaveBeenCalled();
  });

  it('lets verified accounts through', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ emailVerified: true });
    const { res, next } = await run();
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
