// Sign in with Apple — verify the identity token (JWT) that the client
// receives from Apple's AuthenticationServices framework or the web
// AppleID JS SDK. Apple publishes the signing keys at
// https://appleid.apple.com/auth/keys; we resolve them via jose's
// createRemoteJWKSet, which handles caching + key rotation.
//
// Reference: https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { AppError } from '../utils/errors.js';

const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'), {
  cooldownDuration: 60_000, // re-fetch at most once a minute
  cacheMaxAge: 24 * 60 * 60 * 1_000, // keys are valid for 24h
});

const APPLE_ISSUER = 'https://appleid.apple.com';

export type AppleIdentityClaims = {
  subject: string;            // stable Apple user id ("sub")
  email: string | null;       // only present on first authorization
  emailVerified: boolean;     // "email_verified" claim (Apple "true"/"false" string)
  isPrivateRelay: boolean;    // true if email is the @privaterelay.appleid.com address
  fullName: string | null;    // first+last joined; only populated on first auth
  firstName: string | null;
  lastName: string | null;
  audience: string;           // client_id we expect
  issuedAt: number;
  expiresAt: number;
  rawClaims: JWTPayload;
};

export type VerifyAppleTokenOptions = {
  identityToken: string;
  expectedAudience: string;   // APPLE_CLIENT_ID / Service ID / App ID
  nonce?: string;             // optional; checked only when caller provides it
};

/**
 * Verifies an Apple identity token and returns the canonical claims.
 *
 * @throws AppError('invalid_apple_token', 401) on signature, issuer,
 *         audience, or expiry failure.
 */
export async function verifyAppleIdentityToken(
  options: VerifyAppleTokenOptions,
): Promise<AppleIdentityClaims> {
  const { identityToken, expectedAudience, nonce } = options;
  if (!identityToken || typeof identityToken !== 'string') {
    throw new AppError('invalid_apple_token', 401, 'Apple identity token is required.');
  }
  if (!expectedAudience) {
    // Defensive guard — every deploy MUST set APPLE_CLIENT_ID.
    throw new AppError('apple_client_id_missing', 500, 'Server is missing APPLE_CLIENT_ID.');
  }

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience: expectedAudience,
      algorithms: ['RS256'],
    });
    payload = result.payload;
  } catch {
    throw new AppError(
      'invalid_apple_token',
      401,
      "We couldn't verify your Apple ID. Please try signing in again.",
    );
  }

  if (nonce && payload.nonce !== nonce) {
    throw new AppError('invalid_apple_token', 401, 'Apple nonce mismatch.');
  }

  const subject = typeof payload.sub === 'string' ? payload.sub : null;
  if (!subject) {
    throw new AppError('invalid_apple_token', 401, 'Apple token missing subject.');
  }

  const email = typeof payload.email === 'string' ? payload.email : null;
  // Apple emits the boolean as the string "true"/"false".
  const emailVerifiedClaim = payload.email_verified;
  const emailVerified = emailVerifiedClaim === true || emailVerifiedClaim === 'true';
  const isPrivateRelay = email ? email.endsWith('@privaterelay.appleid.com') : false;

  // Apple sends the name only on the FIRST authorization as a top-level
  // object in the user blob (not in the JWT). The web SDK passes it
  // through `user`; on iOS the developer must forward it. The backend
  // extracts names from the JWT payload itself only when the developer
  // has packed them into custom claims (e.g. via Apple ID's nonce flow).
  // For web/iOS the name comes from the request body, not the JWT.
  const firstName = null;
  const lastName = null;
  const fullName = null;

  const issuedAt = typeof payload.iat === 'number' ? payload.iat : Math.floor(Date.now() / 1000);
  const expiresAt = typeof payload.exp === 'number' ? payload.exp : issuedAt + 3600;

  return {
    subject,
    email,
    emailVerified,
    isPrivateRelay,
    fullName,
    firstName,
    lastName,
    audience: expectedAudience,
    issuedAt,
    expiresAt,
    rawClaims: payload,
  };
}
