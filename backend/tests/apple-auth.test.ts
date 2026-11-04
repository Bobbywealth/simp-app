import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair, type JWK } from 'jose';

// Replace Apple's remote key set with a local one so we can mint our own tokens.
const { keys } = vi.hoisted(() => ({ keys: { jwks: null as any } }));
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  return { ...actual, createRemoteJWKSet: () => (header: any, token: any) => actual.createLocalJWKSet(keys.jwks)(header, token) };
});

const { verifyAppleIdentityToken } = await import('../src/services/apple-auth.service.js');

const AUD = 'app.simp.client';
let privateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey as CryptoKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  keys.jwks = { keys: [jwk] };
});

async function mint(opts: { aud?: string; iss?: string; exp?: string | number; sub?: string | null; extra?: Record<string, unknown> } = {}) {
  const jwt = new SignJWT({ email: 'a@privaterelay.appleid.com', email_verified: 'true', ...(opts.extra ?? {}) })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? 'https://appleid.apple.com')
    .setAudience(opts.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '10m');
  if (opts.sub !== null) jwt.setSubject(opts.sub ?? 'apple-user-1');
  return jwt.sign(privateKey);
}

describe('verifyAppleIdentityToken', () => {
  it('accepts a valid token and exposes the claims', async () => {
    const claims = await verifyAppleIdentityToken({ identityToken: await mint(), expectedAudience: AUD });
    expect(claims.subject).toBe('apple-user-1');
    expect(claims.emailVerified).toBe(true);
    expect(claims.isPrivateRelay).toBe(true);
  });

  it('rejects the wrong audience', async () => {
    await expect(verifyAppleIdentityToken({ identityToken: await mint({ aud: 'someone.else' }), expectedAudience: AUD })).rejects.toMatchObject({ code: 'invalid_apple_token' });
  });

  it('rejects the wrong issuer', async () => {
    await expect(verifyAppleIdentityToken({ identityToken: await mint({ iss: 'https://evil.example' }), expectedAudience: AUD })).rejects.toMatchObject({ code: 'invalid_apple_token' });
  });

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    await expect(verifyAppleIdentityToken({ identityToken: await mint({ exp: past }), expectedAudience: AUD })).rejects.toMatchObject({ code: 'invalid_apple_token' });
  });

  it('rejects a token signed by an unknown key', async () => {
    const other = await generateKeyPair('RS256');
    const forged = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer('https://appleid.apple.com').setAudience(AUD).setSubject('x').setExpirationTime('10m').sign(other.privateKey);
    await expect(verifyAppleIdentityToken({ identityToken: forged, expectedAudience: AUD })).rejects.toMatchObject({ code: 'invalid_apple_token' });
  });

  it('rejects a nonce mismatch and accepts a match', async () => {
    const token = await mint({ extra: { nonce: 'n-1' } });
    await expect(verifyAppleIdentityToken({ identityToken: token, expectedAudience: AUD, nonce: 'n-2' })).rejects.toMatchObject({ code: 'invalid_apple_token' });
    await expect(verifyAppleIdentityToken({ identityToken: token, expectedAudience: AUD, nonce: 'n-1' })).resolves.toMatchObject({ subject: 'apple-user-1' });
  });

  it('rejects a token with no subject', async () => {
    await expect(verifyAppleIdentityToken({ identityToken: await mint({ sub: null }), expectedAudience: AUD })).rejects.toMatchObject({ code: 'invalid_apple_token' });
  });

  it('refuses to run without a configured audience', async () => {
    await expect(verifyAppleIdentityToken({ identityToken: await mint(), expectedAudience: '' })).rejects.toMatchObject({ code: 'apple_client_id_missing' });
  });
});
