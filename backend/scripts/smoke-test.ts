// End-to-end smoke test for SIMP.
//
// Exercises the full discovery → match → chat loop against the configured
// backend. By default points at the live Render deploy. Override with:
//   SMOKE_BASE_URL=https://staging.mysimp.com npm run smoke
//
// Creates two temporary accounts (alicia+<random>@smoke.simp.test,
// bob+<random>@smoke.simp.test), force-verifies their emails via the DB,
// runs the loop, then deletes them so the production DB stays clean.
//
// Run with: npm run smoke
//
// Exits 0 on success, 1 on any failed assertion.

import { PrismaClient } from '@prisma/client';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'https://api.mysimp.com';
const PASSWORD = 'SmokeTest!2026';
const REAL_DB_URL = process.env.SMOKE_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
const NANO_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

if (!REAL_DB_URL) {
  console.error('SMOKE_DATABASE_URL or DATABASE_URL must be set to clean up test users.');
  process.exit(1);
}

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

async function api(path: string, init: RequestInit = {}): Promise<{ status: number; body: Json }> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let parsed: Json = null;
  try {
    parsed = text ? (JSON.parse(text) as Json) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

async function signup(email: string, displayName: string) {
  const res = await api('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD, displayName, device: { platform: 'WEB' } }),
  });
  if (res.status !== 201) throw new Error(`signup ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  const body = res.body as { accessToken: string; refreshToken: string; user: { id: string } };
  return body;
}

async function setProfile(accessToken: string, opts: {
  displayName: string;
  bio: string;
  gender: 'WOMAN' | 'MAN' | 'NONBINARY';
  lookingFor: 'WOMEN' | 'MEN' | 'EVERYONE';
  birthDate: string;
  city: string;
  occupation: string;
}) {
  const res = await api('/users/me/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(opts),
  });
  if (res.status !== 200) throw new Error(`setProfile failed: ${res.status} ${JSON.stringify(res.body)}`);
}

async function completeProfile(accessToken: string) {
  const res = await api('/users/me/profile/completion', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.body as { complete: boolean; percent: number; missing: string[] };
}

async function uploadPhoto(accessToken: string) {
  const buf = Buffer.from(NANO_PNG_BASE64, 'base64');
  const form = new FormData();
  form.set('photo', new Blob([buf], { type: 'image/png' }), 'smoke.png');
  const res = await fetch(`${BASE_URL}/photos/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const text = await res.text();
  if (res.status !== 201) throw new Error(`uploadPhoto failed: ${res.status} ${text}`);
  return JSON.parse(text) as { id: string; url: string };
}

async function setDiscoveryPreferences(accessToken: string, body: Record<string, unknown>) {
  const res = await api('/users/me/discovery-preferences', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  if (res.status !== 200) throw new Error(`setDiscoveryPreferences failed: ${res.status} ${JSON.stringify(res.body)}`);
}

async function getDiscovery(accessToken: string) {
  const res = await api('/discovery?limit=10', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status !== 200) throw new Error(`getDiscovery failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { profiles: Array<{ userId: string; displayName: string }> };
}

async function swipe(accessToken: string, swipedId: string, action: 'LIKE' | 'PASS' | 'SUPERLIKE', note?: string) {
  const res = await api('/swipes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ swipedId, action, note: note ?? null }),
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`swipe failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as { swipeId: string; matched: boolean; matchId?: string };
}

async function listMatches(accessToken: string) {
  const res = await api('/matches?limit=10', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status !== 200) throw new Error(`listMatches failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { matches: Array<{ id: string; otherUserId: string }> };
}

async function sendMessage(accessToken: string, matchId: string, body: string) {
  const res = await api(`/messages/${encodeURIComponent(matchId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ body, clientId: crypto.randomUUID() }),
  });
  if (res.status !== 201) throw new Error(`sendMessage failed: ${res.status} ${JSON.stringify(res.body)}`);
}

async function getVapidPublicKey() {
  const res = await api('/push/vapid-public-key');
  return res.body as { publicKey: string } | { error: string };
}

async function registerPushSubscription(accessToken: string) {
  const key = await getVapidPublicKey();
  if ('error' in key) return { skipped: true, reason: key.error };
  // Synthetic subscription payload — won't actually receive a push, but
  // exercises the upsert + storage round-trip.
  const fakeSubscription = {
    endpoint: `https://fake.push.service/simp/smoke/${crypto.randomUUID()}`,
    keys: {
      p256dh: 'BApSmokeTestP256dhKeyPaddingForLength1234567890',
      auth: 'SmokeAuthPadding',
    },
  };
  const res = await api('/users/me/push-subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(fakeSubscription),
  });
  if (res.status !== 201) throw new Error(`registerPushSubscription failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { skipped: false, id: (res.body as { id: string }).id };
}

const prisma = new PrismaClient({ datasources: { db: { url: REAL_DB_URL } } });

async function forceVerify(email: string) {
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true, emailVerifiedAt: new Date() },
  });
}

async function deleteUserByEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  // Cascade should clear profile/photos/swipes/matches/etc., but be explicit.
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.pushToken.deleteMany({ where: { userId: user.id } });
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  await prisma.swipe.deleteMany({ where: { OR: [{ swiperId: user.id }, { swipedId: user.id }] } });
  await prisma.match.deleteMany({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] } });
  await prisma.block.deleteMany({ where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] } });
  await prisma.photo.deleteMany({ where: { userId: user.id } });
  await prisma.prompt.deleteMany({ where: { userId: user.id } });
  await prisma.userInterest.deleteMany({ where: { userId: user.id } });
  await prisma.discoveryPreference.deleteMany({ where: { userId: user.id } });
  await prisma.profile.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

function step(label: string) {
  console.log(`\n→ ${label}`);
}

async function main() {
  const runId = Date.now().toString(36);
  const aliceEmail = `alice+smoke+${runId}@simp.test`;
  const bobEmail = `bob+smoke+${runId}@simp.test`;

  let failed = false;
  try {
    step('Health check');
    const health = await api('/health/ready');
    if (health.status !== 200) throw new Error(`health/ready returned ${health.status}`);
    console.log('  ok');

    step('VAPID public key available');
    const vapid = await getVapidPublicKey();
    if (!('publicKey' in vapid) || !vapid.publicKey) {
      throw new Error(`VAPID public key missing — web push is not configured`);
    }
    console.log(`  public key length: ${vapid.publicKey.length}`);

    step(`Signup: ${aliceEmail}`);
    const alice = await signup(aliceEmail, 'Alice Smoke');
    console.log(`  userId: ${alice.user.id}`);

    step(`Signup: ${bobEmail}`);
    const bob = await signup(bobEmail, 'Bob Smoke');
    console.log(`  userId: ${bob.user.id}`);

    step('Force-verify emails via DB');
    await forceVerify(aliceEmail);
    await forceVerify(bobEmail);
    console.log('  ok');

    step('Set profiles');
    await setProfile(alice.accessToken, {
      displayName: 'Alice',
      bio: 'Smoke-test profile for Alice.',
      gender: 'WOMAN',
      lookingFor: 'MEN',
      birthDate: '1995-04-12',
      city: 'Newark',
      occupation: 'Designer',
    });
    await setProfile(bob.accessToken, {
      displayName: 'Bob',
      bio: 'Smoke-test profile for Bob.',
      gender: 'MAN',
      lookingFor: 'WOMEN',
      birthDate: '1992-08-30',
      city: 'Newark',
      occupation: 'Engineer',
    });
    console.log('  ok');

    step('Upload a tiny photo for each user');
    const alicePhoto = await uploadPhoto(alice.accessToken);
    const bobPhoto = await uploadPhoto(bob.accessToken);
    console.log(`  alice: ${alicePhoto.url.slice(0, 80)}…`);
    console.log(`  bob:   ${bobPhoto.url.slice(0, 80)}…`);

    step('Set discovery preferences (broad)');
    await setDiscoveryPreferences(alice.accessToken, {
      minAge: 18,
      maxAge: 99,
      maxDistanceKm: null,
      verifiedOnly: false,
      interestSlugs: [],
    });
    await setDiscoveryPreferences(bob.accessToken, {
      minAge: 18,
      maxAge: 99,
      maxDistanceKm: null,
      verifiedOnly: false,
      interestSlugs: [],
    });

    step('Profile completion');
    const aliceComplete = await completeProfile(alice.accessToken);
    const bobComplete = await completeProfile(bob.accessToken);
    if (!aliceComplete.complete) throw new Error(`Alice profile incomplete: ${aliceComplete.missing.join(',')}`);
    if (!bobComplete.complete) throw new Error(`Bob profile incomplete: ${bobComplete.missing.join(',')}`);
    console.log('  both 100%');

    step('Alice fetches discovery — should see Bob');
    const aliceDeck = await getDiscovery(alice.accessToken);
    const bobInDeck = aliceDeck.profiles.some((p) => p.userId === bob.user.id);
    if (!bobInDeck) throw new Error(`Bob not in Alice's deck (got ${aliceDeck.profiles.length} profiles)`);
    console.log(`  ok (${aliceDeck.profiles.length} candidates)`);

    step('Alice likes Bob');
    const aliceSwipe = await swipe(alice.accessToken, bob.user.id, 'LIKE', 'Hi from smoke test');
    if (aliceSwipe.matched) throw new Error('Unexpected match on Alice first swipe');
    console.log(`  swipeId: ${aliceSwipe.swipeId}`);

    step('Bob likes Alice — should match');
    const bobSwipe = await swipe(bob.accessToken, alice.user.id, 'LIKE', 'Hi back');
    if (!bobSwipe.matched || !bobSwipe.matchId) {
      throw new Error(`Expected match on Bob swipe, got ${JSON.stringify(bobSwipe)}`);
    }
    console.log(`  matchId: ${bobSwipe.matchId}`);

    step('Both fetch matches');
    const aliceMatches = await listMatches(alice.accessToken);
    const bobMatches = await listMatches(bob.accessToken);
    if (!aliceMatches.matches.some((m) => m.id === bobSwipe.matchId)) {
      throw new Error(`Alice missing match ${bobSwipe.matchId}`);
    }
    if (!bobMatches.matches.some((m) => m.id === bobSwipe.matchId)) {
      throw new Error(`Bob missing match ${bobSwipe.matchId}`);
    }
    console.log('  both see the match');

    step('Alice sends a message');
    await sendMessage(alice.accessToken, bobSwipe.matchId, 'Hello from smoke test!');
    console.log('  sent');

    step('Push subscription round-trip');
    const alicePush = await registerPushSubscription(alice.accessToken);
    if (alicePush.skipped) throw new Error(`Push subscribe skipped: ${alicePush.reason}`);
    const bobPush = await registerPushSubscription(bob.accessToken);
    if (bobPush.skipped) throw new Error(`Push subscribe skipped: ${bobPush.reason}`);
    console.log(`  alice push token id: ${alicePush.id}`);
    console.log(`  bob push token id:   ${bobPush.id}`);

    // Allow the backend a beat to flush notifications + logs.
    await sleep(500);

    console.log('\n✅ Smoke test PASSED');
  } catch (error) {
    failed = true;
    console.error(`\n❌ Smoke test FAILED: ${(error as Error).message}`);
  } finally {
    step('Cleanup test users');
    try {
      await deleteUserByEmail(aliceEmail);
      await deleteUserByEmail(bobEmail);
      console.log('  ok');
    } catch (cleanupError) {
      console.error(`  cleanup failed: ${(cleanupError as Error).message}`);
    }
    await prisma.$disconnect();
  }

  process.exit(failed ? 1 : 0);
}

void main();
