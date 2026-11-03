/* Run: node scripts/audit-regressions.cjs
 * Native Node runner: exercises the actual TS source without native Vite bindings.
 * No production credentials, network traffic, or database writes.
 */
const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const frontendRequire = createRequire(path.resolve("frontend/package.json"));
const backendRequire = createRequire(path.resolve("backend/package.json"));
const ts = frontendRequire("typescript");
const { JSDOM } = frontendRequire("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://mysimp.com/",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "MutationObserver",
  "Event",
  "CustomEvent",
  "localStorage",
  "sessionStorage",
])
  global[key] = dom.window[key];
Object.defineProperty(global, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = frontendRequire("react");
const { render, cleanup, screen, act, fireEvent, waitFor } = frontendRequire(
  "@testing-library/react",
);
const { MemoryRouter } = frontendRequire("react-router-dom");
function source(file, mocks = {}, env = {}) {
  const absolute = path.resolve(file);
  const req = createRequire(absolute);
  const output = ts.transpileModule(
    fs
      .readFileSync(absolute, "utf8")
      .replaceAll("import.meta.env", JSON.stringify(env)),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const module = { exports: {} };
  const customRequire = (name) =>
    Object.hasOwn(mocks, name) ? mocks[name] : req(name);
  const fn = vm.runInThisContext(
    `(function(exports,require,module,__filename,__dirname){${output}\n})`,
    { filename: absolute },
  );
  fn(module.exports, customRequire, module, absolute, path.dirname(absolute));
  return module.exports;
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
const { loginDestination } = source("frontend/src/lib/login-destination.ts");
for (const route of [
  "/experiences/new",
  "/messages/c1",
  "/discover?minAge=25",
  "/settings#privacy",
])
  test(`login returns to ${route}`, () =>
    assert.equal(loginDestination(route, true, true), route));
for (const route of [
  "https://evil.example",
  "//evil.example",
  "/\\evil.example",
  "/login",
  "/nonexistent",
  null,
  {},
])
  test(`login rejects unsafe/unknown target ${JSON.stringify(route)}`, () =>
    assert.equal(loginDestination(route, true, true), "/experiences"));
test("unverified login cannot bypass verification", () =>
  assert.equal(
    loginDestination("/messages", true, false),
    "/verify-email-pending",
  ));
test("incomplete login cannot bypass onboarding", () =>
  assert.equal(loginDestination("/messages", false, true), "/profile-setup"));
const { installBodyParsers } = source("backend/src/middleware/body-parsers.ts");
const express = backendRequire("express");
const request = backendRequire("supertest");
test("signed webhook retains exact raw JSON bytes", async () => {
  const app = express();
  installBodyParsers(app);
  app.post("/webhooks/test", (req, res) =>
    res.json({ raw: Buffer.isBuffer(req.body), body: req.body.toString() }),
  );
  const body = '{ "type": "email.delivered", "data": {} }';
  const res = await request(app)
    .post("/webhooks/test")
    .set("Content-Type", "application/json")
    .send(body);
  assert.equal(res.status, 200);
  assert.equal(res.body.raw, true);
  assert.equal(res.body.body, body);
});
test("normal API requests still parse as JSON", async () => {
  const app = express();
  installBodyParsers(app);
  app.post("/auth/login", (req, res) => res.json({ email: req.body.email }));
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "test@example.invalid" });
  assert.equal(res.body.email, "test@example.invalid");
});
test("malformed ordinary JSON is rejected", async () => {
  const app = express();
  installBodyParsers(app);
  app.post("/test", (_req, res) => res.json({ ok: true }));
  app.use((err, _req, res, _next) =>
    res.status(err.status || 500).json({ error: "bad_json" }),
  );
  const r = await request(app)
    .post("/test")
    .set("Content-Type", "application/json")
    .send("{bad");
  assert.equal(r.status, 400);
});
const { createHmac } = require("node:crypto");
const { verifyResendSignature, parseEmailEvent } = source(
  "backend/src/services/email-webhook.ts",
);
const secret = Buffer.from("test-only-secret").toString("base64");
const body = '{"type":"email.delivered","data":{"to":"qa@example.invalid"}}';
function signed(
  timestamp = String(Math.floor(Date.now() / 1000)),
  payload = body,
) {
  return {
    "svix-id": "msg_test",
    "svix-timestamp": timestamp,
    "svix-signature":
      "v1," +
      createHmac("sha256", Buffer.from(secret, "base64"))
        .update(`msg_test.${timestamp}.${payload}`)
        .digest("base64"),
  };
}
test("valid signed webhook verifies", () =>
  assert.deepEqual(
    verifyResendSignature({
      body,
      headers: signed(),
      secret: "whsec_" + secret,
    }),
    { verified: true },
  ));
test("tampered webhook is rejected", () =>
  assert.equal(
    verifyResendSignature({ body: body + " ", headers: signed(), secret })
      .verified,
    false,
  ));
test("expired webhook cannot be replayed", () =>
  assert.equal(
    verifyResendSignature({
      body,
      headers: signed(String(Math.floor(Date.now() / 1000) - 600)),
      secret,
    }).reason,
    "expired_timestamp",
  ));
test("future webhook cannot be replayed", () =>
  assert.equal(
    verifyResendSignature({
      body,
      headers: signed(String(Math.floor(Date.now() / 1000) + 600)),
      secret,
    }).reason,
    "expired_timestamp",
  ));
test("webhook rejects missing signing secret", () =>
  assert.equal(
    verifyResendSignature({ body, headers: signed() }).verified,
    false,
  ));
test("webhook rejects missing signature", () =>
  assert.equal(
    verifyResendSignature({ body, headers: {}, secret }).verified,
    false,
  ));
test("webhook rejects array timestamp", () =>
  assert.equal(
    verifyResendSignature({
      body,
      headers: { ...signed(), "svix-timestamp": ["1"] },
      secret,
    }).verified,
    false,
  ));
test("malformed email payload is ignored", () =>
  assert.equal(parseEmailEvent("not-json"), null));
const profileUser = {
  id: "qa",
  emailVerified: true,
  onboardingCompletedAt: "2026-01-01",
  role: "USER",
  profile: { displayName: "QA" },
};
function socketMock() {
  const { EventEmitter } = require("node:events");
  return new EventEmitter();
}
const bottom = source("frontend/src/components/BottomTabBar.tsx").BottomTabBar;
function shell(user = profileUser) {
  const socket = socketMock();
  const api = { count: 2 };
  const mod = source("frontend/src/components/AppShell.tsx", {
    "../store/auth": { useAuth: (fn) => fn({ user }) },
    "../api/messages": { getUnreadMessageCount: async () => ({ ...api }) },
    "../lib/realtime": { getRealtimeSocket: () => socket },
    "./SimpLogo": {
      SimpLogo: () => React.createElement("img", { alt: "SIMP" }),
    },
    "./BottomTabBar": { BottomTabBar: bottom },
  });
  return { Component: mod.AppShell, socket, api };
}
function showShell(state, route = "/home") {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [route] },
      React.createElement(
        state.Component,
        null,
        React.createElement("main", null, "Test page"),
      ),
    ),
  );
}
test("desktop navigation exposes every core feature", async () => {
  const state = shell();
  showShell(state);
  await screen.findByRole("navigation", { name: "Desktop primary" });
  for (const item of [
    "Overview",
    "Experiences",
    "Discover",
    "Matches",
    "Messages",
    "Live",
  ])
    assert.ok(
      screen
        .getAllByRole("link")
        .find((link) => link.textContent.startsWith(item)),
    );
});
test("mobile retains five native tabs", async () => {
  const state = shell();
  showShell(state);
  const nav = await screen.findByRole("navigation", { name: "Primary" });
  assert.equal(nav.querySelectorAll("a").length, 5);
});
test("desktop navigation persists on conversation details", async () => {
  showShell(shell(), "/messages/c1");
  assert.ok(await screen.findByRole("navigation", { name: "Desktop primary" }));
  assert.equal(screen.queryByRole("navigation", { name: "Primary" }), null);
});
test("public login does not render app navigation", () => {
  showShell(shell(), "/login");
  assert.equal(screen.queryByRole("navigation"), null);
});
test("signed-out users do not render app navigation", () => {
  showShell(shell(null));
  assert.equal(screen.queryByRole("navigation"), null);
});
test("unverified users do not render protected navigation", () => {
  showShell(shell({ ...profileUser, emailVerified: false }));
  assert.equal(screen.queryByRole("navigation"), null);
});
test("super admin can reach moderation from desktop", async () => {
  showShell(shell({ ...profileUser, role: "SUPER_ADMIN" }));
  assert.ok(await screen.findByRole("link", { name: "Moderation" }));
});
test("badge reflects server count instead of incrementing socket events", async () => {
  const state = shell();
  showShell(state);
  await waitFor(() =>
    assert.ok(screen.getByRole("link", { name: "Chats, 2 unread" })),
  );
  state.api.count = 0;
  act(() => state.socket.emit("inbox:update"));
  await waitFor(() =>
    assert.ok(screen.getByRole("link", { name: "Chats", exact: true })),
  );
  assert.equal(screen.queryByRole("link", { name: "Chats, 3 unread" }), null);
});
test("read receipts reconcile the shared badge", async () => {
  const state = shell();
  showShell(state);
  await waitFor(() =>
    assert.ok(screen.getByRole("link", { name: "Chats, 2 unread" })),
  );
  state.api.count = 1;
  act(() => window.dispatchEvent(new Event("simp:inbox-read")));
  await waitFor(() =>
    assert.ok(screen.getByRole("link", { name: "Chats, 1 unread" })),
  );
});
function apiClient(fetcher) {
  global.fetch = fetcher;
  return source(
    "frontend/src/api/client.ts",
    {
      "../capacitor": {
        getDeviceContext: async () => ({ platform: "WEB" }),
        hydrateRefreshTokenNative: async () => null,
        isNative: () => false,
        persistRefreshTokenNative: async () => {},
      },
    },
    { PROD: true, VITE_API_BASE_URL: "https://api.mysimp.com" },
  );
}
test("API normalizes a proxy 502 into a useful error", async () => {
  const api = apiClient(
    async () => new Response("<html>502</html>", { status: 502 }),
  );
  await assert.rejects(api.apiFetch("/test"), /temporarily unavailable/);
});
test("API never renders an object error envelope as a message", async () => {
  const api = apiClient(
    async () =>
      new Response(JSON.stringify({ error: { message: "hidden" } }), {
        status: 500,
      }),
  );
  await assert.rejects(api.apiFetch("/test"), /temporarily unavailable/);
});
test("API handles 204 responses without JSON parsing", async () => {
  const api = apiClient(async () => new Response(null, { status: 204 }));
  assert.equal(await api.apiFetch("/test"), undefined);
});
test("API keeps refresh credentials in HttpOnly cookie path, not localStorage", async () => {
  let init;
  const api = apiClient(async (_url, options) => {
    init = options;
    return new Response(JSON.stringify({ accessToken: "test-access" }), {
      status: 200,
    });
  });
  assert.equal(await api.refreshAccessToken(), true);
  assert.equal(init.credentials, "include");
  assert.equal(localStorage.getItem("simp_access"), null);
  assert.equal(localStorage.getItem("simp_refresh"), null);
});
test("simultaneous 401s share one refresh request", async () => {
  let refreshes = 0;
  let calls = 0;
  const api = apiClient(async (url, init) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      await new Promise((r) => setTimeout(r, 15));
      return new Response(JSON.stringify({ accessToken: "fresh" }));
    }
    calls++;
    return init.headers.get("Authorization") === "Bearer fresh"
      ? new Response(JSON.stringify({ ok: true }))
      : new Response("{}", { status: 401 });
  });
  const values = await Promise.all([
    api.apiFetch("/one"),
    api.apiFetch("/two"),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(calls, 4);
  assert.equal(
    values.every((x) => x.ok),
    true,
  );
});
const { sanitizeMessage, sanitizeDisplayName } = source(
  "backend/src/utils/sanitize.ts",
);
test("chat strips executable markup", () =>
  assert.equal(
    sanitizeMessage("<script>alert(1)</script>Hello <b>there</b>"),
    "Hello there",
  ));
test("display names strip markup", () =>
  assert.equal(
    sanitizeDisplayName(" <img src=x onerror=alert(1)>Kenji "),
    "Kenji",
  ));
const errors = source("backend/src/utils/errors.ts");
function messagingFixture(overrides = {}) {
  const match = {
    id: "m1",
    userAId: "u1",
    userBId: "u2",
    isActive: true,
    userA: { id: "u1", status: "ACTIVE", profile: { displayName: "A" } },
    userB: { id: "u2", status: "ACTIVE", profile: { displayName: "B" } },
    ...overrides.match,
  };
  const conversation = { id: "c1", matchId: "m1", match };
  const state = {
    creates: 0,
    notifications: 0,
    events: [],
    ...overrides.state,
  };
  const tx = {
    conversation: {
      findUnique: async () => (overrides.missing ? null : conversation),
      update: async () => ({}),
    },
    block: { findFirst: async () => (overrides.blocked ? {} : null) },
    match: { update: async () => ({}) },
    message: {
      findUnique: async () => overrides.existing ?? null,
      create: async ({ data }) => {
        state.creates++;
        return { id: "message1", createdAt: new Date(), ...data };
      },
      findFirst: async () => overrides.through ?? null,
      updateMany: async (arg) => {
        state.receipt = arg;
        return { count: 1 };
      },
    },
  };
  const prisma = {
    $transaction: (fn) => fn(tx),
    message: { update: async ({ where, data }) => ({ id: where.id, ...data }) },
  };
  const io = {
    sockets: { adapter: { rooms: new Map() } },
    to: (room) => ({
      emit: (event, payload) => state.events.push({ room, event, payload }),
    }),
  };
  const service = source("backend/src/services/messaging.service.ts", {
    "../config/db.js": { prisma },
    "../sockets/realtime.js": { getRealtimeServer: () => io },
    "../utils/errors.js": errors,
    "../utils/sanitize.js": { sanitizeMessage },
    "./notification.service.js": {
      createNotification: async () => ({ id: "n1" }),
      dispatchNotification: async () => {
        state.notifications++;
      },
    },
  });
  return { service, tx, state };
}
test("conversation access rejects non-members", async () => {
  const f = messagingFixture();
  await assert.rejects(
    f.service.authorizeConversation(f.tx, "c1", "stranger"),
    (e) => e.status === 403,
  );
});
test("conversation access rejects inactive matches", async () => {
  const f = messagingFixture({ match: { isActive: false } });
  await assert.rejects(
    f.service.authorizeConversation(f.tx, "c1", "u1"),
    (e) => e.code === "match_inactive",
  );
});
test("conversation access rejects either-direction blocks", async () => {
  const f = messagingFixture({ blocked: true });
  await assert.rejects(
    f.service.authorizeConversation(f.tx, "c1", "u1"),
    (e) => e.code === "messaging_blocked",
  );
});
test("conversation access rejects deleted/banned recipients", async () => {
  const f = messagingFixture({
    match: { userB: { id: "u2", status: "BANNED" } },
  });
  await assert.rejects(
    f.service.authorizeConversation(f.tx, "c1", "u1"),
    (e) => e.code === "recipient_unavailable",
  );
});
test("message persists sanitized content and dispatches once", async () => {
  const f = messagingFixture();
  const message = await f.service.sendMessage({
    conversationId: "c1",
    senderId: "u1",
    body: "<script>x</script>Hello",
    clientId: "idempotency-1",
  });
  assert.equal(message.body, "Hello");
  assert.equal(f.state.creates, 1);
  assert.equal(f.state.notifications, 1);
  assert.ok(f.state.events.some((e) => e.event === "message:new"));
});
test("same clientId does not resend or renotify", async () => {
  const f = messagingFixture({ existing: { id: "old", senderId: "u1" } });
  await f.service.sendMessage({
    conversationId: "c1",
    senderId: "u1",
    body: "Hello",
    clientId: "idempotency-1",
  });
  assert.equal(f.state.creates, 0);
  assert.equal(f.state.notifications, 0);
  assert.equal(f.state.events.length, 0);
});
test("clientId cannot impersonate another sender", async () => {
  const f = messagingFixture({ existing: { id: "old", senderId: "u2" } });
  await assert.rejects(
    f.service.sendMessage({
      conversationId: "c1",
      senderId: "u1",
      body: "Hello",
      clientId: "same-id",
    }),
    (e) => e.code === "message_id_conflict",
  );
});
test("read receipt only updates incoming, nondeleted messages", async () => {
  const f = messagingFixture();
  await f.service.markMessagesRead("c1", "u1");
  assert.equal(f.state.receipt.where.senderId.not, "u1");
  assert.equal(f.state.receipt.where.deletedAt, null);
  assert.ok(f.state.receipt.data.readAt);
});
test("read receipt rejects an unrelated through-message", async () => {
  const f = messagingFixture();
  await assert.rejects(
    f.service.markMessagesRead("c1", "u1", "bad-id"),
    (e) => e.code === "message_not_found",
  );
});
const jwtUtils = source("backend/src/utils/jwt.ts", {
  "../config/env.js": {
    env: {
      JWT_ACCESS_SECRET: "test-access-secret-not-production",
      JWT_REFRESH_SECRET: "test-refresh-secret-not-production",
      JWT_ACCESS_TTL: "15m",
      JWT_REFRESH_TTL: "30d",
    },
  },
});
test("access token round trip preserves family and user", () => {
  const claims = jwtUtils.verifyAccessToken(
    jwtUtils.signAccessToken("u1", "family1"),
  );
  assert.equal(claims.sub, "u1");
  assert.equal(claims.sid, "family1");
  assert.equal(claims.typ, "access");
});
test("refresh token cannot be used as access token", () =>
  assert.throws(() =>
    jwtUtils.verifyAccessToken(
      jwtUtils.signRefreshToken("u1", "jti1", "family1"),
    ),
  ));
test("access token cannot be used as refresh token", () =>
  assert.throws(() =>
    jwtUtils.verifyRefreshToken(jwtUtils.signAccessToken("u1")),
  ));
test("tampered token is rejected", () =>
  assert.throws(() =>
    jwtUtils.verifyAccessToken(jwtUtils.signAccessToken("u1") + "tampered"),
  ));
test("refresh cookie TTL matches 30 day setting", () =>
  assert.equal(jwtUtils.refreshTtlMs(), 30 * 86400000));
function experiencesFixture(overrides = {}) {
  const state = { created: [], listQuery: null };
  const host = {
    id: "host1",
    profile: { displayName: "Host", birthDate: new Date("1990-01-01") },
    photos: [],
  };
  const experience = {
    id: "exp1",
    hostId: "host1",
    host,
    title: "Test dinner",
    status: "OPEN",
    isActive: true,
    startsAt: new Date(Date.now() + 86400000),
    capacity: 4,
    venue: "Private exact venue",
    logistics: "Private instructions",
    ...overrides.experience,
  };
  const prisma = {
    user: {
      findUnique: async () =>
        overrides.user ?? { status: "ACTIVE", emailVerified: true },
    },
    block: {
      findMany: async () => overrides.blocks ?? [],
      findFirst: async () => (overrides.blocked ? { id: "block1" } : null),
    },
    experience: {
      findMany: async (query) => {
        state.listQuery = query;
        return [experience];
      },
      findUnique: async () => (overrides.missing ? null : experience),
      create: async ({ data }) => {
        state.created.push(data);
        return { id: "new1", ...data };
      },
      update: async ({ data }) => ({ ...experience, ...data }),
    },
    experienceRequest: {
      groupBy: async () => [],
      count: async () => 0,
      findUnique: async () => overrides.myRequest ?? null,
      findFirst: async () => overrides.existingRequest ?? null,
      upsert: async () => ({
        id: "r1",
        status: "PENDING",
        note: null,
        createdAt: new Date(),
      }),
    },
  };
  const auth = {
    requireAuth: (req, _res, next) => {
      req.userId = overrides.userId ?? "viewer1";
      next();
    },
    requireRole: () => (_req, _res, next) => next(),
  };
  const { experiencesRouter } = source(
    "backend/src/routes/experiences.routes.ts",
    {
      "../config/db.js": { prisma },
      "../middleware/auth.js": auth,
      "../utils/errors.js": errors,
      "../services/notification.service.js": { notify: async () => ({}) },
      "../sockets/realtime.js": { getRealtimeServer: () => null },
    },
  );
  const app = express();
  app.use(express.json());
  app.use(experiencesRouter);
  app.use((error, _req, res, _next) =>
    res
      .status(error instanceof errors.AppError ? error.status : 400)
      .json({ error: error.code ?? "validation_error" }),
  );
  return { app, state };
}
const validExperience = () => ({
  title: "Test dinner",
  category: "DINNER",
  city: "New York",
  capacity: 4,
  startsAt: new Date(Date.now() + 86400000).toISOString(),
});
test("host creates an experience with caller-owned hostId", async () => {
  const f = experiencesFixture();
  const r = await request(f.app)
    .post("/experiences")
    .send({ ...validExperience(), hostId: "attacker" });
  assert.equal(r.status, 201);
  assert.equal(f.state.created[0].hostId, "viewer1");
});
for (const [label, patch] of [
  ["past date", { startsAt: "2020-01-01T00:00:00Z" }],
  ["oversize capacity", { capacity: 100 }],
  ["undersize capacity", { capacity: 1 }],
  ["invalid category", { category: "FAKE" }],
  ["blank title", { title: " " }],
  ["negative price", { priceCents: -1 }],
])
  test(`experience creation rejects ${label}`, async () => {
    const f = experiencesFixture();
    const r = await request(f.app)
      .post("/experiences")
      .send({ ...validExperience(), ...patch });
    assert.equal(r.status, 400);
    assert.equal(f.state.created.length, 0);
  });
test("unverified host cannot create experiences", async () => {
  const f = experiencesFixture({
    user: { status: "ACTIVE", emailVerified: false },
  });
  assert.equal(
    (await request(f.app).post("/experiences").send(validExperience())).status,
    403,
  );
});
test("banned host cannot create experiences", async () => {
  const f = experiencesFixture({
    user: { status: "BANNED", emailVerified: true },
  });
  assert.equal(
    (await request(f.app).post("/experiences").send(validExperience())).status,
    403,
  );
});
test("browse does not expose private venue or logistics", async () => {
  const f = experiencesFixture();
  const r = await request(f.app).get("/experiences");
  assert.equal(r.status, 200);
  assert.equal(r.body.experiences[0].venue, null);
  assert.equal(r.body.experiences[0].logistics, null);
  assert.equal(f.state.listQuery.where.host.status, "ACTIVE");
});
test("unapproved viewer cannot read exact venue via detail API", async () => {
  const f = experiencesFixture();
  const r = await request(f.app).get("/experiences/exp1");
  assert.equal(r.body.venue, null);
  assert.equal(r.body.logistics, null);
});
test("approved guest can read venue and logistics", async () => {
  const f = experiencesFixture({ myRequest: { id: "r1", status: "APPROVED" } });
  const r = await request(f.app).get("/experiences/exp1");
  assert.equal(r.body.venue, "Private exact venue");
});
test("host can read their own venue", async () => {
  const f = experiencesFixture({ userId: "host1" });
  const r = await request(f.app).get("/experiences/exp1");
  assert.equal(r.body.venue, "Private exact venue");
});
test("blocked viewer cannot bypass browse exclusion with direct detail URL", async () => {
  const f = experiencesFixture({ blocked: true });
  assert.equal((await request(f.app).get("/experiences/exp1")).status, 404);
});
test("host cannot request their own experience", async () => {
  const f = experiencesFixture({ userId: "host1" });
  assert.equal(
    (await request(f.app).post("/experiences/exp1/requests").send({})).status,
    403,
  );
});
test("join request respects blocks in either direction", async () => {
  const f = experiencesFixture({ blocked: true });
  assert.equal(
    (await request(f.app).post("/experiences/exp1/requests").send({})).status,
    403,
  );
});
test("full experience rejects new join requests", async () => {
  const f = experiencesFixture({ experience: { status: "FULL" } });
  assert.equal(
    (await request(f.app).post("/experiences/exp1/requests").send({})).status,
    400,
  );
});
test("duplicate join request is rejected", async () => {
  const f = experiencesFixture({
    existingRequest: { id: "old", status: "PENDING" },
  });
  assert.equal(
    (await request(f.app).post("/experiences/exp1/requests").send({})).status,
    409,
  );
});
test("valid join request stays pending for host approval", async () => {
  const f = experiencesFixture();
  const r = await request(f.app)
    .post("/experiences/exp1/requests")
    .send({ note: "Hello" });
  assert.equal(r.status, 201);
  assert.equal(r.body.request.status, "PENDING");
});
const motionMock = {
  motion: { li: ({ children }) => React.createElement("li", null, children) },
};
const matchesPage = (responses) =>
  source("frontend/src/pages/Matches.tsx", {
    "framer-motion": motionMock,
    "../api/matches": {
      getMatches: async (cursor) => (cursor ? responses[1] : responses[0]),
    },
    "../components/SimpLogo": { SimpLogo: () => null },
  }).default;
const match = (id, name) => ({
  matchId: id,
  otherUser: {
    userId: id,
    displayName: name,
    age: 28,
    city: "New York",
    occupation: null,
    isVerified: false,
    photoUrl: null,
    thumbnailUrl: null,
  },
  noteFromOther: null,
});
test("matches load-more exposes older matches without dropping first page", async () => {
  const C = matchesPage([
    { matches: [match("a", "Alex")], hasMore: true, nextCursor: "a" },
    { matches: [match("b", "Blair")], hasMore: false, nextCursor: null },
  ]);
  render(React.createElement(MemoryRouter, null, React.createElement(C)));
  await screen.findByRole("button", { name: "Load more matches" });
  fireEvent.click(screen.getByRole("button", { name: "Load more matches" }));
  await screen.findByRole("heading", { name: "Blair 28" });
  assert.ok(screen.getByRole("heading", { name: "Alex 28" }));
});
test("a match without a photo never impersonates a stock-photo person", async () => {
  const C = matchesPage([
    { matches: [match("a", "Alex")], hasMore: false, nextCursor: null },
  ]);
  render(React.createElement(MemoryRouter, null, React.createElement(C)));
  await screen.findByLabelText("No profile photo");
  assert.equal(document.querySelector('img[alt="Alex"]'), null);
});
function homePage(failMessages = false) {
  return source("frontend/src/pages/Home.tsx", {
    "../api/matches": {
      getMatches: async () => ({ matches: [], hasMore: false }),
    },
    "../api/messages": {
      getUnreadMessageCount: async () => {
        if (failMessages) throw Error("offline");
        return { count: 0 };
      },
    },
    "../api/notifications": {
      getNotificationUnreadCount: async () => ({ count: 0 }),
    },
    "../api/users": {
      getMyProfile: async () => null,
      getProfileCompletion: async () => ({ percent: 0 }),
    },
    "../store/auth": { useAuth: (fn) => fn({ user: profileUser }) },
    "../components/SimpLogo": { SimpLogo: () => null },
    "../components/SafetyMenu": { SafetyMenu: () => null },
    "../lib/realtime": { getRealtimeSocket: () => socketMock() },
  }).default;
}
test("home shows real zero completion, not invented 100 percent", async () => {
  const C = homePage();
  render(React.createElement(MemoryRouter, null, React.createElement(C)));
  assert.ok(await screen.findByText("0% complete"));
  assert.equal(
    screen.queryByText(/3 days|Live right now|Jazz \+ cooking|8–10 PM/),
    null,
  );
});
test("one failed home API does not discard other account data", async () => {
  const C = homePage(true);
  render(React.createElement(MemoryRouter, null, React.createElement(C)));
  assert.ok(await screen.findByRole("status"));
  assert.ok(screen.getByText("0% complete"));
  assert.ok(screen.getByRole("button", { name: "Discover people" }));
});
