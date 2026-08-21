#!/usr/bin/env bash
# Minimal end-to-end smoke test for SIMP, exercised via curl + a single
# Prisma DB write for email force-verification. Bash avoids the memory-
# pressure "Operation aborted" failures that hit tsx/node on Bobby's
# 16 GB M4 when Comet + Aside + Electron are running.
#
# Usage:  bash scripts/smoke-test.sh
# Exits 0 on success, 1 on any failure.

set -euo pipefail

BASE_URL="${SMOKE_BASE_URL:-https://simp-backend-b8nz.onrender.com}"
DB_URL="${SMOKE_DATABASE_URL:-postgresql://simp_user:UgMMICMFI9Ta6WV6F2MKjUCowggzxr31@dpg-d9pnemr9ik0c73c9hg5g-a:5432/simp_app_33gb}"
RUN_ID="$(date +%s)_$$"
ALICE_EMAIL="alice+smoke+${RUN_ID}@simp.test"
BOB_EMAIL="bob+smoke+${RUN_ID}@simp.test"
PASSWORD='SmokeTest!2026'
NANO_PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

step() { printf '\n\033[1;33m→ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32mok\033[0m — %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m — %s\n' "$1"; CLEANUP_NEEDED=1; exit 1; }

CLEANUP_NEEDED=0
trap 'cleanup' EXIT

cleanup() {
  if [ "$CLEANUP_NEEDED" = "1" ]; then
    step "Cleanup test users"
    node -e "
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient({ datasources: { db: { url: process.env.SMOKE_DATABASE_URL } } });
      (async () => {
        for (const e of ['${ALICE_EMAIL}','${BOB_EMAIL}']) {
          const u = await p.user.findUnique({ where: { email: e } });
          if (!u) continue;
          await p.refreshToken.deleteMany({ where: { userId: u.id } });
          await p.pushToken.deleteMany({ where: { userId: u.id } });
          await p.notification.deleteMany({ where: { userId: u.id } });
          await p.swipe.deleteMany({ where: { OR: [{ swiperId: u.id }, { swipedId: u.id }] } });
          await p.match.deleteMany({ where: { OR: [{ userAId: u.id }, { userBId: u.id }] } });
          await p.block.deleteMany({ where: { OR: [{ blockerId: u.id }, { blockedId: u.id }] } });
          await p.photo.deleteMany({ where: { userId: u.id } });
          await p.prompt.deleteMany({ where: { userId: u.id } });
          await p.userInterest.deleteMany({ where: { userId: u.id } });
          await p.discoveryPreference.deleteMany({ where: { userId: u.id } });
          await p.profile.deleteMany({ where: { userId: u.id } });
          await p.user.delete({ where: { id: u.id } });
          console.log('  deleted ' + e);
        }
        await p.\$disconnect();
      })().catch((e) => { console.error('cleanup error', e); process.exit(1); });
    " 2>&1 || true
  fi
}

# JSON value extraction (works for simple flat strings/numbers).
jget() { node -e "let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(String(j$1??''))}catch{process.stdout.write('')}})" <<< "$2"; }

step "Health check"
HEALTH=$(curl -s "${BASE_URL}/health/ready")
echo "  $HEALTH" | head -c 200
echo

step "VAPID public key"
VAPID=$(curl -s "${BASE_URL}/push/vapid-public-key")
echo "  $VAPID"
echo "$VAPID" | grep -q "publicKey" || fail "VAPID key missing"
ok "VAPID public key returned"

step "Signup: $ALICE_EMAIL"
ALICE_RES=$(curl -s -X POST "${BASE_URL}/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${ALICE_EMAIL}\",\"password\":\"${PASSWORD}\",\"displayName\":\"Alice Smoke\",\"device\":{\"platform\":\"WEB\"}}")
ALICE_TOKEN=$(jget ".accessToken" "$ALICE_RES")
ALICE_ID=$(jget ".user.id" "$ALICE_RES")
[ -n "$ALICE_TOKEN" ] || fail "Alice signup returned no token: $ALICE_RES"
ok "Alice userId=$ALICE_ID"

step "Signup: $BOB_EMAIL"
BOB_RES=$(curl -s -X POST "${BASE_URL}/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${BOB_EMAIL}\",\"password\":\"${PASSWORD}\",\"displayName\":\"Bob Smoke\",\"device\":{\"platform\":\"WEB\"}}")
BOB_TOKEN=$(jget ".accessToken" "$BOB_RES")
BOB_ID=$(jget ".user.id" "$BOB_RES")
[ -n "$BOB_TOKEN" ] || fail "Bob signup returned no token: $BOB_RES"
ok "Bob userId=$BOB_ID"

step "Force-verify emails via DB"
node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient({ datasources: { db: { url: process.env.SMOKE_DATABASE_URL } } });
  (async () => {
    await p.user.update({ where: { email: '${ALICE_EMAIL}' }, data: { emailVerified: true, emailVerifiedAt: new Date() } });
    await p.user.update({ where: { email: '${BOB_EMAIL}' }, data: { emailVerified: true, emailVerifiedAt: new Date() } });
    await p.\$disconnect();
  })();
" 2>&1 || fail "force-verify DB write failed"
ok "both verified"

step "Set profiles"
curl -s -X PUT "${BASE_URL}/users/me/profile" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" -H 'Content-Type: application/json' \
  -d '{"displayName":"Alice","bio":"smoke","gender":"WOMAN","lookingFor":"MEN","birthDate":"1995-04-12","city":"Newark","occupation":"Designer"}' \
  | grep -q '"id"' || fail "Alice profile set failed"
curl -s -X PUT "${BASE_URL}/users/me/profile" \
  -H "Authorization: Bearer ${BOB_TOKEN}" -H 'Content-Type: application/json' \
  -d '{"displayName":"Bob","bio":"smoke","gender":"MAN","lookingFor":"WOMEN","birthDate":"1992-08-30","city":"Newark","occupation":"Engineer"}' \
  | grep -q '"id"' || fail "Bob profile set failed"
ok "both profiles saved"

step "Upload a tiny photo for each user"
ALICE_PHOTO=$(curl -s -X POST "${BASE_URL}/photos/upload" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" \
  -F "photo=@-;filename=smoke.png;type=image/png" \
  <<< "$(echo -n "${NANO_PNG}" | base64 -d)")
echo "$ALICE_PHOTO" | grep -q '"id"' || fail "Alice photo upload failed: $ALICE_PHOTO"
BOB_PHOTO=$(curl -s -X POST "${BASE_URL}/photos/upload" \
  -H "Authorization: Bearer ${BOB_TOKEN}" \
  -F "photo=@-;filename=smoke.png;type=image/png" \
  <<< "$(echo -n "${NANO_PNG}" | base64 -d)")
echo "$BOB_PHOTO" | grep -q '"id"' || fail "Bob photo upload failed: $BOB_PHOTO"
ok "both photos uploaded"

step "Set discovery preferences"
curl -s -X PATCH "${BASE_URL}/users/me/discovery-preferences" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" -H 'Content-Type: application/json' \
  -d '{"minAge":18,"maxAge":99,"maxDistanceKm":null,"verifiedOnly":false,"interestSlugs":[]}' \
  | grep -q '"id"' || fail "Alice prefs failed"
curl -s -X PATCH "${BASE_URL}/users/me/discovery-preferences" \
  -H "Authorization: Bearer ${BOB_TOKEN}" -H 'Content-Type: application/json' \
  -d '{"minAge":18,"maxAge":99,"maxDistanceKm":null,"verifiedOnly":false,"interestSlugs":[]}' \
  | grep -q '"id"' || fail "Bob prefs failed"
ok "preferences set"

step "Profile completion"
COMP_A=$(curl -s "${BASE_URL}/users/me/profile/completion" -H "Authorization: Bearer ${ALICE_TOKEN}")
COMP_B=$(curl -s "${BASE_URL}/users/me/profile/completion" -H "Authorization: Bearer ${BOB_TOKEN}")
echo "  Alice: $COMP_A"
echo "  Bob:   $COMP_B"
echo "$COMP_A" | grep -q '"complete":true' || fail "Alice profile incomplete"
echo "$COMP_B" | grep -q '"complete":true' || fail "Bob profile incomplete"
ok "both 100% complete"

step "Alice fetches discovery — should see Bob"
DECK=$(curl -s "${BASE_URL}/discovery?limit=10" -H "Authorization: Bearer ${ALICE_TOKEN}")
echo "$DECK" | grep -q "\"userId\":\"${BOB_ID}\"" || fail "Bob not in Alice's deck: $DECK"
ok "discovery returned Bob"

step "Alice likes Bob"
SWIPE_A=$(curl -s -X POST "${BASE_URL}/swipes" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" -H 'Content-Type: application/json' \
  -d "{\"swipedId\":\"${BOB_ID}\",\"action\":\"LIKE\",\"note\":\"hi\"}")
echo "$SWIPE_A" | grep -q '"matched":false' || fail "Alice swipe unexpected: $SWIPE_A"
ok "Alice LIKE recorded, no match yet"

step "Bob likes Alice — should match"
SWIPE_B=$(curl -s -X POST "${BASE_URL}/swipes" \
  -H "Authorization: Bearer ${BOB_TOKEN}" -H 'Content-Type: application/json' \
  -d "{\"swipedId\":\"${ALICE_ID}\",\"action\":\"LIKE\",\"note\":\"hi back\"}")
echo "$SWIPE_B" | grep -q '"matched":true' || fail "Bob swipe did not match: $SWIPE_B"
MATCH_ID=$(jget ".matchId" "$SWIPE_B")
ok "match created: $MATCH_ID"

step "Both fetch matches"
MATCHES_A=$(curl -s "${BASE_URL}/matches?limit=10" -H "Authorization: Bearer ${ALICE_TOKEN}")
MATCHES_B=$(curl -s "${BASE_URL}/matches?limit=10" -H "Authorization: Bearer ${BOB_TOKEN}")
echo "$MATCHES_A" | grep -q "\"id\":\"${MATCH_ID}\"" || fail "Alice missing match"
echo "$MATCHES_B" | grep -q "\"id\":\"${MATCH_ID}\"" || fail "Bob missing match"
ok "both see the match"

step "Alice sends a message"
SEND=$(curl -s -X POST "${BASE_URL}/messages/${MATCH_ID}" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" -H 'Content-Type: application/json' \
  -d "{\"body\":\"hello\",\"clientId\":\"smoke-${RUN_ID}\"}")
echo "$SEND" | grep -q '"id"' || fail "message send failed: $SEND"
ok "message sent"

step "Push subscription round-trip"
SUB_A=$(curl -s -X POST "${BASE_URL}/users/me/push-subscriptions" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" -H 'Content-Type: application/json' \
  -d '{"endpoint":"https://fake.push/simp/alice/'"${RUN_ID}"'","keys":{"p256dh":"BApSmokeP256dhPadding12345678901234567890","auth":"SmokeAuthPadding"}}')
echo "  Alice: $SUB_A"
SUB_B=$(curl -s -X POST "${BASE_URL}/users/me/push-subscriptions" \
  -H "Authorization: Bearer ${BOB_TOKEN}" -H 'Content-Type: application/json' \
  -d '{"endpoint":"https://fake.push/simp/bob/'"${RUN_ID}"'","keys":{"p256dh":"BApSmokeP256dhPadding12345678901234567890","auth":"SmokeAuthPadding"}}')
echo "  Bob:   $SUB_B"
echo "$SUB_A" | grep -q '"id"' || fail "Alice push subscribe failed"
echo "$SUB_B" | grep -q '"id"' || fail "Bob push subscribe failed"
ok "both subscribed"

CLEANUP_NEEDED=1
printf '\n\033[1;32m✅ SMOKE TEST PASSED\033[0m\n'
exit 0
