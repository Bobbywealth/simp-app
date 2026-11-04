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
  const state = { created: [], listQuery: null, matchesCreated: [], seeAgain: [], planMessages: [] };
  const host = {
    id: "host1",
    email: overrides.hostEmail,
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
      findUnique: async ({ where }) => ({
        ...(overrides.user ?? { status: "ACTIVE", emailVerified: true }),
        email: where?.id === "host1" ? overrides.hostEmail : overrides.viewerEmail,
      }),
      findMany: async () => overrides.planUsers ?? [],
    },
    profile: {
      findMany: async () => [],
    },
    match: {
      findMany: async () => overrides.planMatches ?? [],
      findUnique: async () => overrides.existingMatch ?? null,
      create: async ({ data }) => {
        state.matchesCreated.push(data);
        return { id: "m-new", ...data };
      },
      update: async ({ data }) => ({ id: "m1", ...data }),
      upsert: async () => ({ id: "m1" }),
    },
    planMessage: {
      create: async ({ data }) => {
        state.planMessages.push(data);
        return { id: "pm1", ...data };
      },
    },
    conversation: {
      findUnique: async () => ({ id: "c1" }),
      create: async () => ({ id: "c1" }),
    },
    experienceSeeAgain: {
      findMany: async () => overrides.mySeeAgain ?? [],
      findUnique: async () => (overrides.reciprocal ? { id: "sa1" } : null),
      upsert: async ({ create }) => {
        state.seeAgain.push(create);
        return create;
      },
      deleteMany: async () => ({ count: 1 }),
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
      findMany: async () => overrides.approvedRequests ?? [],
      findUnique: async () => overrides.myRequest ?? null,
      findFirst: async () => overrides.existingRequest ?? null,
      upsert: async () => ({
        id: "r1",
        status: "PENDING",
        note: null,
        createdAt: new Date(),
      }),
      update: async ({ data }) => ({ id: "r1", note: null, createdAt: new Date(), ...data }),
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
      "../utils/demo-accounts.js": source("backend/src/utils/demo-accounts.ts"),
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
  assert.deepEqual(f.state.listQuery.where.host.AND[0], { status: "ACTIVE" });
});
test("browse separates real members from sample plans", async () => {
  const real = experiencesFixture({ viewerEmail: "member@example.com" });
  await request(real.app).get("/experiences");
  assert.deepEqual(real.state.listQuery.where.host.AND[1].NOT.OR[0], { email: { endsWith: "@simp-seed.demo", mode: "insensitive" } });
  const tester = experiencesFixture({ viewerEmail: "review@sim-p.app" });
  await request(tester.app).get("/experiences");
  assert.ok(tester.state.listQuery.where.host.AND[1].OR);
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
const PAST_PLAN = { startsAt: new Date(Date.now() - 5 * 3600000) };
const guestUser = { id: "guest1", profile: { displayName: "Guest", birthDate: new Date("1994-01-01") }, photos: [] };
test("plan people and see-again state are hidden from non-participants", async () => {
  const f = experiencesFixture();
  const r = await request(f.app).get("/experiences/exp1");
  assert.equal(r.body.plan, null);
});
test("approved guest sees who is going and that see-again is closed before the plan", async () => {
  const f = experiencesFixture({ myRequest: { id: "r1", status: "APPROVED" }, planUsers: [{ id: "host1", profile: { displayName: "Host", birthDate: new Date("1990-01-01") }, photos: [] }] });
  const r = await request(f.app).get("/experiences/exp1");
  assert.equal(r.body.plan.seeAgain.open, false);
  assert.equal(r.body.plan.people[0].displayName, "Host");
  assert.equal(r.body.plan.people[0].isHost, true);
});
test("see again is not allowed before the plan has happened", async () => {
  const f = experiencesFixture({ userId: "host1", planUsers: [guestUser], approvedRequests: [{ requesterId: "guest1" }] });
  const r = await request(f.app).post("/experiences/exp1/see-again").send({ userId: "guest1", again: true });
  assert.equal(r.status, 400);
  assert.equal(f.state.seeAgain.length, 0);
});
test("see again only works for people who were on the plan", async () => {
  const f = experiencesFixture({ userId: "host1", experience: PAST_PLAN, planUsers: [guestUser], approvedRequests: [{ requesterId: "guest1" }] });
  const r = await request(f.app).post("/experiences/exp1/see-again").send({ userId: "stranger", again: true });
  assert.equal(r.status, 403);
});
test("one-sided see again stays private and creates no match", async () => {
  const f = experiencesFixture({ userId: "host1", experience: PAST_PLAN, planUsers: [guestUser], approvedRequests: [{ requesterId: "guest1" }] });
  const r = await request(f.app).post("/experiences/exp1/see-again").send({ userId: "guest1", again: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.matched, false);
  assert.equal(f.state.matchesCreated.length, 0);
});
test("mutual see again creates a real match tied to the plan", async () => {
  const f = experiencesFixture({ userId: "host1", experience: PAST_PLAN, planUsers: [guestUser], approvedRequests: [{ requesterId: "guest1" }], reciprocal: true });
  const r = await request(f.app).post("/experiences/exp1/see-again").send({ userId: "guest1", again: true });
  assert.equal(r.body.matched, true);
  assert.equal(f.state.matchesCreated[0].kind, "MUTUAL");
  assert.equal(f.state.matchesCreated[0].experienceId, "exp1");
});
test("see again cannot revive a match someone already ended", async () => {
  const f = experiencesFixture({ userId: "host1", experience: PAST_PLAN, planUsers: [guestUser], approvedRequests: [{ requesterId: "guest1" }], reciprocal: true, existingMatch: { id: "m1", isActive: false, kind: "PLAN" } });
  const r = await request(f.app).post("/experiences/exp1/see-again").send({ userId: "guest1", again: true });
  assert.equal(r.body.matched, false);
});
const SAMPLE_HOST = "testing-women-02@simp-seed.demo";
test("real members cannot open a sample plan", async () => {
  const f = experiencesFixture({ hostEmail: SAMPLE_HOST, viewerEmail: "member@example.com" });
  assert.equal((await request(f.app).get("/experiences/exp1")).status, 404);
});
test("real members cannot join a sample plan", async () => {
  const f = experiencesFixture({ hostEmail: SAMPLE_HOST, viewerEmail: "member@example.com" });
  assert.equal((await request(f.app).post("/experiences/exp1/requests").send({})).status, 404);
});
test("test accounts cannot open a real member's plan", async () => {
  const f = experiencesFixture({ hostEmail: "real-host@example.com", viewerEmail: "review@sim-p.app" });
  assert.equal((await request(f.app).get("/experiences/exp1")).status, 404);
});
test("a tester joining a sample plan is approved and greeted in the plan chat", async () => {
  const f = experiencesFixture({ hostEmail: SAMPLE_HOST, viewerEmail: "review@sim-p.app" });
  const r = await request(f.app).post("/experiences/exp1/requests").send({});
  assert.equal(r.status, 201);
  assert.equal(r.body.request.status, "APPROVED");
  assert.equal(f.state.planMessages.length, 1);
  assert.equal(f.state.planMessages[0].senderId, "host1");
});
test("sample plans let testers try see-again before the plan happens", async () => {
  const f = experiencesFixture({ hostEmail: SAMPLE_HOST, viewerEmail: "review@sim-p.app", myRequest: { id: "r1", status: "APPROVED" }, planUsers: [{ id: "host1", profile: { displayName: "Host", birthDate: new Date("1990-01-01") }, photos: [] }] });
  const r = await request(f.app).get("/experiences/exp1");
  assert.equal(r.body.isDemo, true);
  assert.equal(r.body.plan.seeAgain.open, true);
});
test("the sample host always sees a tester again, so a match forms", async () => {
  const f = experiencesFixture({ userId: "tester1", hostEmail: SAMPLE_HOST, viewerEmail: "review@sim-p.app", myRequest: { id: "r1", status: "APPROVED" }, existingRequest: { id: "r1", status: "APPROVED" }, planUsers: [{ id: "host1", profile: { displayName: "Host", birthDate: new Date("1990-01-01") }, photos: [] }] });
  const r = await request(f.app).post("/experiences/exp1/see-again").send({ userId: "host1", again: true });
  assert.equal(r.body.matched, true);
  assert.equal(f.state.matchesCreated[0].kind, "MUTUAL");
});
function chatFixture(overrides = {}) {
  const state = { messages: [], emitted: [] };
  const prisma = {
    experience: { findUnique: async () => overrides.missing ? null : { id: "exp1", hostId: "host1", title: "Dinner", isActive: true, status: overrides.status ?? "OPEN" } },
    experienceRequest: {
      findFirst: async () => (overrides.approved ? { id: "r1" } : null),
      findMany: async () => [{ requesterId: "guest1" }, { requesterId: "guest2" }],
    },
    block: { findMany: async () => overrides.blocks ?? [] },
    user: { findMany: async () => [{ id: "host1", profile: { displayName: "Host" }, photos: [] }, { id: "guest1", profile: { displayName: "Guest" }, photos: [] }] },
    planMessage: {
      findMany: async (query) => { state.query = query; return overrides.rows ?? []; },
      create: async ({ data }) => { const m = { id: "pm" + (state.messages.length + 1), createdAt: new Date(), ...data }; state.messages.push(m); return m; },
    },
  };
  const auth = { requireAuth: (req, _res, next) => { req.userId = overrides.userId ?? "guest1"; next(); } };
  const { planChatRouter } = source("backend/src/routes/plan-chat.routes.ts", {
    "../config/db.js": { prisma },
    "../middleware/auth.js": auth,
    "../utils/errors.js": errors,
    "../sockets/realtime.js": { getRealtimeServer: () => ({ to: (room) => ({ emit: (event) => state.emitted.push([room, event]) }) }) },
  });
  const app = express();
  app.use(express.json());
  app.use(planChatRouter);
  app.use((error, _req, res, _next) => res.status(error instanceof errors.AppError ? error.status : 400).json({ error: error.code ?? "validation_error" }));
  return { app, state };
}
test("plan chat is closed to people who are not on the plan", async () => {
  const f = chatFixture({ approved: false });
  assert.equal((await request(f.app).get("/experiences/exp1/chat")).status, 403);
  assert.equal((await request(f.app).post("/experiences/exp1/chat").send({ body: "hi" })).status, 403);
  assert.equal(f.state.messages.length, 0);
});
test("approved guests can post, and everyone else on the plan is notified in real time", async () => {
  const f = chatFixture({ approved: true });
  const r = await request(f.app).post("/experiences/exp1/chat").send({ body: "  hello all  " });
  assert.equal(r.status, 201);
  assert.equal(r.body.message.body, "hello all");
  assert.equal(r.body.message.mine, true);
  const rooms = f.state.emitted.map((e) => e[0]).sort();
  assert.deepEqual(rooms, ["user:guest2", "user:host1"]);
});
test("plan chat rejects empty and oversize messages", async () => {
  const f = chatFixture({ approved: true });
  assert.equal((await request(f.app).post("/experiences/exp1/chat").send({ body: "   " })).status, 400);
  assert.equal((await request(f.app).post("/experiences/exp1/chat").send({ body: "x".repeat(1001) })).status, 400);
});
test("plan chat hides messages from people the viewer has a block with", async () => {
  const f = chatFixture({ approved: true, blocks: [{ blockerId: "guest1", blockedId: "guest2" }] });
  await request(f.app).get("/experiences/exp1/chat");
  assert.deepEqual(f.state.query.where.senderId, { notIn: ["guest2"] });
});
test("host can read the plan chat and a cancelled plan has none", async () => {
  assert.equal((await request(chatFixture({ userId: "host1" }).app).get("/experiences/exp1/chat")).status, 200);
  assert.equal((await request(chatFixture({ userId: "host1", status: "CANCELLED" }).app).get("/experiences/exp1/chat")).status, 404);
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
  assert.ok(screen.getByRole("button", { name: "Browse experiences" }));
});

test("desktop message link keeps its name with unread badge", async () => {
  showShell(shell());
  assert.ok(await screen.findByRole("link", { name: "Messages, 2 unread" }));
});

test("mobile Profile icon contains complete head and body paths", async () => {
  showShell(shell());
  const link = await screen.findByRole("link", {
    name: "Profile",
    exact: true,
  });
  const d = link.querySelector("svg path").getAttribute("d");
  assert.ok(d.includes("a4 4 0 0 0 0 8Z"));
  assert.ok(d.includes("M5 21"));
});

// Admin suite: production route handlers, isolated in-memory databases/providers.
const realAuth = source("backend/src/middleware/auth.ts", {
  "../config/db.js": { prisma: {} },
  "../utils/jwt.js": { verifyAccessToken: () => ({}) },
});
function adminFixture(extra = {}, legacy = false) {
  const state = { writes: [], queries: [] };
  const target = {
    id: "member1",
    role: "USER",
    status: "ACTIVE",
    email: "member@example.invalid",
    profile: { displayName: "Member" },
    photos: [],
    refreshTokens: [],
  };
  const prisma = {
    user: {
      findUnique: async () => ({ ...target, ...extra.target }),
      findMany: async () => [{ ...target }],
      count: async () => extra.superCount ?? 2,
      update: async (args) => {
        state.writes.push(args);
        return { ...target, ...args.data };
      },
    },
    refreshToken: {
      updateMany: async (args) => {
        state.writes.push(args);
        return { count: 2 };
      },
    },
    moderationAction: {
      create: async (args) => {
        state.writes.push(args);
        return { id: "audit1" };
      },
      findMany: async () => [],
      count: async () => 0,
    },
    experience: {
      findMany: async (args) => {
        state.queries.push(args);
        return [
          {
            id: "exp1",
            title: "Dinner",
            isActive: true,
            status: "OPEN",
            hostId: "member1",
          },
        ];
      },
      findUnique: async () =>
        extra.experience ?? {
          id: "exp1",
          hostId: "member1",
          status: "OPEN",
          isActive: true,
        },
      update: async (args) => {
        state.writes.push(args);
        return args.data;
      },
    },
    waitlistEntry: {
      findMany: async (args) => {
        state.queries.push(args);
        return [{ id: "w1", name: "QA", email: "qa@example.invalid" }];
      },
    },
    emailEvent: {
      findMany: async (args) => {
        state.queries.push(args);
        return [];
      },
    },
    photo: {
      findUnique: async () => ({
        id: "photo1",
        userId: "member1",
        publicId: "image1",
        url: "https://example.invalid/photo.jpg",
      }),
      delete: async (args) => {
        state.writes.push({ photoDelete: args });
        return {};
      },
    },
    assetDeletionJob: {
      upsert: async (args) => {
        state.writes.push({ cleanupJob: args });
        return {};
      },
      update: async (args) => {
        state.writes.push({ cleanupDone: args });
        return {};
      },
    },
    liveStream: {
      findUnique: async () => ({
        id: "stream1",
        broadcasterId: "member1",
        status: "LIVE",
        recordingEgressId: null,
      }),
      update: async (args) => {
        state.writes.push(args);
        return {};
      },
      findMany: async () => [],
      count: async () => 0,
      updateMany: async () => ({ count: 0 }),
    },
    match: { count: async () => 0, updateMany: async () => ({ count: 0 }) },
    message: { count: async () => 0 },
    report: { count: async () => 0, findMany: async () => [] },
    profileVerificationRequest: {
      count: async () => 0,
      findMany: async (args) => {
        state.queries.push(args);
        return [];
      },
    },
    $queryRaw: async () => [],
  };
  prisma.$transaction = async (fn) =>
    typeof fn === "function" ? fn(prisma) : Promise.all(fn);
  const middleware = {
    requireAuth: (req, res, next) => {
      if (!req.headers["x-test-role"])
        return res.status(401).json({ error: "missing_token" });
      req.userId = "operator1";
      req.userRole = req.headers["x-test-role"];
      next();
    },
    requireRole: realAuth.requireRole,
    invalidateUserAuthCache: () => {},
  };
  const mocks = {
    "../config/db.js": { prisma },
    "../config/env.js": {
      env: {
        JWT_ACCESS_SECRET: "test-only-secret-not-production",
        LIVEKIT_URL: extra.liveConfigured
          ? "https://example.invalid"
          : undefined,
      },
    },
    "../middleware/auth.js": middleware,
    "../utils/errors.js": errors,
    "../services/photo.service.js": { deleteStoredPhoto: async () => {} },
    "../services/verification.service.js": {
      deleteVerificationSelfie: async () => {},
    },
    "../services/cloudinary.service.js": {
      cloudinaryDeliveryUrl: (x) => x,
      cloudinarySignedDeliveryUrl: (x) => x,
    },
    "../services/analytics.service.js": { getFunnelCounts: async () => ({}) },
    "../services/livekit.service.js": {
      listRecordings: async () => [],
      deleteRoomForModeration: async () => {
        if (extra.providerFailure)
          throw new errors.AppError(
            "live_termination_failed",
            502,
            "Provider failed",
          );
      },
      stopRecording: async () => null,
    },
    "../services/livekit-usage.service.js": {
      lastLivekitUsage: () => null,
      snapshotLivekitUsage: async () => null,
    },
    "../sockets/realtime.js": { getRealtimeServer: () => null },
    "../services/notification.service.js": {
      BROADCAST_AUDIENCES: ["all", "verified", "pushable"],
      broadcastToUsers: async () => ({}),
      notify: async () => ({}),
    },
    "../utils/logger.js": { logger: { info() {}, warn() {}, error() {} } },
  };
  const router = legacy
    ? source("backend/src/routes/admin.routes.ts", mocks).adminRouter
    : source("backend/src/routes/admin-operations.routes.ts", mocks)
        .adminOperationsRouter;
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((e, _req, res, _next) =>
    res
      .status(e instanceof errors.AppError ? e.status : 400)
      .json({ error: e.code ?? "validation_error", message: e.message }),
  );
  return { app, state };
}
for (const path of [
  "/admin/users/member1",
  "/admin/waitlist",
  "/admin/email-events",
  "/admin/experiences",
  "/admin/live/streams",
]) {
  test(`admin endpoint ${path} rejects signed-out callers`, async () => {
    const f = adminFixture();
    assert.equal((await request(f.app).get(path)).status, 401);
  });
  test(`admin endpoint ${path} rejects standard members`, async () => {
    const f = adminFixture();
    assert.equal(
      (await request(f.app).get(path).set("x-test-role", "USER")).status,
      403,
    );
  });
  test(`admin endpoint ${path} permits administrators`, async () => {
    const f = adminFixture();
    assert.equal(
      (await request(f.app).get(path).set("x-test-role", "ADMIN")).status,
      200,
    );
  });
}
test("moderator cannot use owner administration APIs", async () => {
  const f = adminFixture();
  assert.equal(
    (
      await request(f.app)
        .get("/admin/waitlist")
        .set("x-test-role", "MODERATOR")
    ).status,
    403,
  );
});
test("waitlist supports cursor and excludes IP/user-agent payloads", async () => {
  const f = adminFixture();
  const r = await request(f.app)
    .get("/admin/waitlist?cursor=old1&query=qa")
    .set("x-test-role", "ADMIN");
  assert.equal(r.status, 200);
  assert.equal(f.state.queries[0].cursor.id, "old1");
  assert.equal(f.state.queries[0].select.ipAddress, undefined);
});
test("user detail query excludes password hashes and refresh-token secrets", async () => {
  const f = adminFixture();
  const r = await request(f.app)
    .get("/admin/users/member1")
    .set("x-test-role", "ADMIN");
  assert.equal(r.status, 200);
  assert.equal(r.body.passwordHash, undefined);
  assert.equal(r.body.refreshTokens[0]?.tokenHash, undefined);
});
test("session revocation requires a moderation reason", async () => {
  const f = adminFixture();
  assert.equal(
    (
      await request(f.app)
        .post("/admin/users/member1/revoke-sessions")
        .set("x-test-role", "ADMIN")
        .send({ reason: "x" })
    ).status,
    400,
  );
  assert.equal(f.state.writes.length, 0);
});
test("session revocation persists an audit record", async () => {
  const f = adminFixture();
  const r = await request(f.app)
    .post("/admin/users/member1/revoke-sessions")
    .set("x-test-role", "ADMIN")
    .send({ reason: "Security investigation" });
  assert.equal(r.status, 200);
  assert.equal(r.body.revoked, 2);
  assert.equal(f.state.writes[1].data.metadata.operation, "REVOKE_SESSIONS");
});
test("admin cannot revoke a super-admin session", async () => {
  const f = adminFixture({ target: { role: "SUPER_ADMIN" } });
  assert.equal(
    (
      await request(f.app)
        .post("/admin/users/member1/revoke-sessions")
        .set("x-test-role", "ADMIN")
        .send({ reason: "Security review" })
    ).status,
    403,
  );
  assert.equal(f.state.writes.length, 0);
});
test("experience visibility mutation is persisted and audited", async () => {
  const f = adminFixture();
  const r = await request(f.app)
    .patch("/admin/experiences/exp1/visibility")
    .set("x-test-role", "ADMIN")
    .send({ reason: "Safety review", isActive: false });
  assert.equal(r.status, 200);
  assert.equal(f.state.writes[0].data.isActive, false);
  assert.equal(f.state.writes[1].data.metadata.experienceId, "exp1");
});
test("closed experience cannot be republished through visibility toggle", async () => {
  const f = adminFixture({
    experience: { id: "exp1", hostId: "member1", status: "CANCELLED" },
  });
  assert.equal(
    (
      await request(f.app)
        .patch("/admin/experiences/exp1/visibility")
        .set("x-test-role", "ADMIN")
        .send({ reason: "Restore", isActive: true })
    ).status,
    409,
  );
  assert.equal(f.state.writes.length, 0);
});
test("admin cannot change account roles", async () => {
  const f = adminFixture({}, true);
  assert.equal(
    (
      await request(f.app)
        .patch("/admin/users/member1/role")
        .set("x-test-role", "ADMIN")
        .send({ role: "ADMIN", reason: "Team access" })
    ).status,
    403,
  );
});
test("super admin cannot demote themselves", async () => {
  const f = adminFixture({}, true);
  assert.equal(
    (
      await request(f.app)
        .patch("/admin/users/operator1/role")
        .set("x-test-role", "SUPER_ADMIN")
        .send({ role: "USER", reason: "Test" })
    ).status,
    400,
  );
});
test("last super admin cannot be removed", async () => {
  const f = adminFixture(
    { target: { role: "SUPER_ADMIN" }, superCount: 1 },
    true,
  );
  assert.equal(
    (
      await request(f.app)
        .patch("/admin/users/member1/role")
        .set("x-test-role", "SUPER_ADMIN")
        .send({ role: "USER", reason: "Test change" })
    ).status,
    409,
  );
  assert.equal(f.state.writes.length, 0);
});
test("role changes are transactional and audited with prior role", async () => {
  const f = adminFixture({}, true);
  const r = await request(f.app)
    .patch("/admin/users/member1/role")
    .set("x-test-role", "SUPER_ADMIN")
    .send({ role: "ADMIN", reason: "Authorized team access" });
  assert.equal(r.status, 200);
  assert.equal(f.state.writes[1].data.metadata.previousRole, "USER");
});
test("suspension rejects absent end date", async () => {
  const f = adminFixture({}, true);
  assert.equal(
    (
      await request(f.app)
        .patch("/admin/users/member1/status")
        .set("x-test-role", "ADMIN")
        .send({ status: "SUSPENDED", reason: "Safety review" })
    ).status,
    400,
  );
});
test("suspension rejects expired end date", async () => {
  const f = adminFixture({}, true);
  assert.equal(
    (
      await request(f.app)
        .patch("/admin/users/member1/status")
        .set("x-test-role", "ADMIN")
        .send({
          status: "SUSPENDED",
          reason: "Safety review",
          suspendedUntil: "2020-01-01T00:00:00Z",
        })
    ).status,
    400,
  );
});
test("valid suspension saves expiry and revokes refresh sessions", async () => {
  const f = adminFixture({}, true);
  const r = await request(f.app)
    .patch("/admin/users/member1/status")
    .set("x-test-role", "ADMIN")
    .send({
      status: "SUSPENDED",
      reason: "Safety review",
      suspendedUntil: new Date(Date.now() + 86400000).toISOString(),
    });
  assert.equal(r.status, 200);
  assert.ok(f.state.writes[0].data.suspendedUntil instanceof Date);
  assert.ok(f.state.writes.some((w) => w.data.revokedAt));
});
test("deleted accounts cannot be restored by admin", async () => {
  const f = adminFixture({ target: { status: "DELETED" } }, true);
  assert.equal(
    (
      await request(f.app)
        .patch("/admin/users/member1/status")
        .set("x-test-role", "ADMIN")
        .send({ status: "ACTIVE", reason: "Restore" })
    ).status,
    409,
  );
});
test("verification queue excludes authentication fields from user include", async () => {
  const f = adminFixture({}, true);
  assert.equal(
    (
      await request(f.app)
        .get("/admin/verifications?cursor=old")
        .set("x-test-role", "ADMIN")
    ).status,
    200,
  );
  assert.equal(f.state.queries[0].include.user.select.email, true);
  assert.equal(f.state.queries[0].include.user.select.passwordHash, undefined);
  assert.equal(f.state.queries[0].cursor.id, "old");
});
test("broadcast rejects protocol-relative external route", async () => {
  const f = adminFixture({}, true);
  assert.equal(
    (
      await request(f.app)
        .post("/admin/notifications/broadcast")
        .set("x-test-role", "ADMIN")
        .send({
          title: "Test",
          body: "Body",
          audience: "all",
          route: "//evil.example",
        })
    ).status,
    400,
  );
});

function adminUiFixture(role = "SUPER_ADMIN", failure) {
  const requests = [];
  const row = {
    id: "qa-member",
    email: "member@example.invalid",
    emailVerified: true,
    role: "USER",
    status: "ACTIVE",
    statusReason: null,
    suspendedUntil: null,
    createdAt: "2026-11-01T12:00:00Z",
    profile: {
      displayName: "Test member",
      isVerified: false,
      verificationStatus: "NOT_REQUESTED",
    },
    _count: { photos: 0, reportsReceived: 0, moderationActionsReceived: 0 },
  };
  const apiFetch = async (url, init) => {
    requests.push({ url, init });
    if (failure && url.startsWith(failure))
      throw Error("Simulated service failure");
    if (url === "/admin/stats")
      return {
        users: 12,
        activeMatches: 4,
        messages: 23,
        liveStreams: 0,
        openReports: 1,
        pendingVerification: 2,
      };
    if (url === "/health/ready")
      return {
        status: "ready",
        database: true,
        integrations: {
          email: false,
          push: true,
          turn: true,
          livekit: true,
          persistentStorage: true,
          apple: false,
        },
        degradedFeatures: ["Email provider needs configuration"],
      };
    if (url.startsWith("/admin/users?"))
      return {
        users: [
          {
            ...row,
            id: url.includes("cursor=") ? "qa-older" : "qa-member",
            email: url.includes("cursor=")
              ? "older@example.invalid"
              : row.email,
          },
        ],
        nextCursor: url.includes("cursor=") ? null : "qa-member",
        hasMore: !url.includes("cursor="),
      };
    if (url.startsWith("/admin/users/")) return { actions: [] };
    if (url.startsWith("/admin/reports"))
      return { reports: [], nextCursor: null };
    if (url.startsWith("/admin/verifications"))
      return { requests: [], nextCursor: null };
    if (url.startsWith("/admin/live/streams")) return { streams: [] };
    if (url.startsWith("/admin/live/recordings")) return { recordings: [] };
    if (url.startsWith("/admin/notifications/broadcasts"))
      return { broadcasts: [], nextCursor: null };
    if (url.startsWith("/admin/analytics/funnel"))
      return {
        counts: {
          signup_started: 10,
          signup_completed: 8,
          onboarding_completed: 6,
          first_message: 2,
        },
        conversions: {},
      };
    if (url.startsWith("/admin/audit-log"))
      return {
        actions: [
          {
            id: "a1",
            actionType: "WARN",
            reason: "Test fixture entry",
            moderator: { displayName: "Test operator" },
            targetUser: { displayName: "Test member" },
            createdAt: "2026-11-01",
          },
        ],
        nextCursor: null,
      };
    return { items: [], nextCursor: null };
  };
  const api = source("frontend/src/api/admin.ts", { "./client": { apiFetch } });
  const ops = source("frontend/src/components/admin/AdminOperations.tsx", {
    "../../api/client": { apiFetch },
    "../../api/admin": api,
  });
  const adminTestUser = { ...profileUser, id: "operator1", role };
  const Admin = source("frontend/src/pages/Admin.tsx", {
    "../api/admin": api,
    "../api/client": { apiFetch: async () => ({}) },
    "../api/live-moderation": {
      listLiveRecordings: async () => ({ recordings: [] }),
    },
    "../components/admin/AdminOperations": ops,
    "../store/auth": { useAuth: () => ({ ready: true, user: adminTestUser }) },
  }).default;
  return { Admin, requests };
}
async function showAdmin(route = "/admin", role = "SUPER_ADMIN", failure) {
  const state = adminUiFixture(role, failure);
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [route] },
      React.createElement(state.Admin),
    ),
  );
  await waitFor(() =>
    assert.ok(screen.queryByRole("heading", { name: "Admin console" })),
  );
  return state;
}
for (const section of [
  "overview",
  "users",
  "reports",
  "verifications",
  "live",
  "broadcasts",
  "experiences",
  "waitlist",
  "analytics",
  "audit",
  "email",
  "health",
])
  test(`routed admin page ${section} loads its API-backed content`, async () => {
    const state = await showAdmin(
      section === "overview" ? "/admin" : `/admin/${section}`,
    );
    await waitFor(() => assert.ok(state.requests.length > 1));
    if (["experiences", "waitlist", "email"].includes(section))
      await waitFor(() =>
        assert.ok(
          state.requests.some((r) =>
            r.url.startsWith(
              "/admin/" + (section === "email" ? "email-events" : section),
            ),
          ),
        ),
      );
    if (
      process.env.SIMP_ADMIN_PREVIEW_DIR &&
      ["overview", "users", "audit"].includes(section)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      fs.mkdirSync(process.env.SIMP_ADMIN_PREVIEW_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(process.env.SIMP_ADMIN_PREVIEW_DIR, section + ".html"),
        document.body.innerHTML,
      );
    }
  });
test("admin users pagination calls next cursor", async () => {
  const state = await showAdmin("/admin/users");
  fireEvent.click(
    await screen.findByRole("button", { name: "Load more users" }),
  );
  await screen.findByText("older@example.invalid");
  assert.ok(state.requests.some((r) => r.url.includes("cursor=qa-member")));
});
test("admin suspension UI reveals required expiry control", async () => {
  await showAdmin("/admin/users");
  await screen.findByText("member@example.invalid");
  const status = screen
    .getAllByRole("combobox")
    .find((el) => el.value === "ACTIVE");
  fireEvent.change(status, { target: { value: "SUSPENDED" } });
  assert.ok(
    await screen.findByLabelText("Suspension end for member@example.invalid"),
  );
});
test("regular admin cannot save role changes in the UI", async () => {
  await showAdmin("/admin/users", "ADMIN");
  const button = await screen.findByRole("button", { name: "Save role" });
  assert.equal(button.disabled, true);
});
test("failed dashboard stats do not prevent user management loading", async () => {
  await showAdmin("/admin/users", "SUPER_ADMIN", "/admin/stats");
  assert.ok(await screen.findByText("member@example.invalid"));
  assert.ok(await screen.findByRole("alert"));
});
test("broadcast history is requested immediately on routed page load", async () => {
  const state = await showAdmin("/admin/broadcasts");
  await waitFor(() =>
    assert.ok(
      state.requests.some((r) =>
        r.url.startsWith("/admin/notifications/broadcasts"),
      ),
    ),
  );
});
test("admin section navigation changes the route-backed page", async () => {
  const state = await showAdmin();
  fireEvent.click(
    screen.getByRole("button", { name: "waitlist", exact: true }),
  );
  await waitFor(() =>
    assert.ok(state.requests.some((r) => r.url.startsWith("/admin/waitlist"))),
  );
});
test("admin photo removal persists a cleanup job before removing the record", async () => {
  const f = adminFixture({}, true);
  const r = await request(f.app)
    .delete("/admin/photos/photo1")
    .set("x-test-role", "ADMIN")
    .send({ reason: "Inappropriate content" });
  assert.equal(r.status, 200);
  assert.ok(f.state.writes[0].cleanupJob);
  assert.ok(f.state.writes[1].photoDelete);
  assert.equal(f.state.writes[2].data.action, "REMOVE_PHOTO");
});
test("provider refusing stream termination prevents a false success", async () => {
  const f = adminFixture({ liveConfigured: true, providerFailure: true }, true);
  const r = await request(f.app)
    .post("/admin/live/stream1/end")
    .set("x-test-role", "ADMIN")
    .send({ reason: "Safety moderation" });
  assert.equal(r.status, 502);
  assert.equal(f.state.writes.length, 0);
});
test("confirmed media termination is persisted and audited", async () => {
  const f = adminFixture({ liveConfigured: true }, true);
  const r = await request(f.app)
    .post("/admin/live/stream1/end")
    .set("x-test-role", "ADMIN")
    .send({ reason: "Safety moderation" });
  assert.equal(r.status, 200);
  assert.equal(f.state.writes[0].data.status, "ENDED");
  assert.equal(f.state.writes[1].data.action, "END_STREAM");
});
test("suspension UI submits an ISO expiry to the actual API adapter", async () => {
  const state = await showAdmin("/admin/users");
  await screen.findByText("member@example.invalid");
  fireEvent.change(
    screen.getAllByRole("combobox").find((el) => el.value === "ACTIVE"),
    { target: { value: "SUSPENDED" } },
  );
  fireEvent.change(
    screen.getByLabelText("Suspension end for member@example.invalid"),
    { target: { value: "2030-01-01T12:00" } },
  );
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "Safety review" },
  });
  window.confirm = () => true;
  fireEvent.click(screen.getByRole("button", { name: "Save status" }));
  await waitFor(() =>
    assert.ok(state.requests.some((r) => r.init?.method === "PATCH")),
  );
  const req = state.requests.find((r) => r.init?.method === "PATCH");
  assert.equal(req.url, "/admin/users/qa-member/status");
  const body = JSON.parse(req.init.body);
  assert.equal(body.status, "SUSPENDED");
  assert.ok(body.suspendedUntil.endsWith("Z"));
});
test("canceling account moderation makes no mutation request", async () => {
  const state = await showAdmin("/admin/users");
  await screen.findByText("member@example.invalid");
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "Safety review" },
  });
  window.confirm = () => false;
  fireEvent.click(screen.getByRole("button", { name: "Save status" }));
  assert.equal(
    state.requests.filter((r) => r.init?.method === "PATCH").length,
    0,
  );
});
test("canceling broadcast confirmation sends nothing", async () => {
  const state = await showAdmin("/admin/broadcasts");
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Test title" },
  });
  fireEvent.change(screen.getByLabelText("Body"), {
    target: { value: "Test message body" },
  });
  window.confirm = () => false;
  fireEvent.click(screen.getByRole("button", { name: "Send broadcast" }));
  assert.equal(
    state.requests.filter((r) => r.init?.method === "POST").length,
    0,
  );
});

const demoPolicy=source('backend/src/utils/demo-accounts.ts');
test('reserved test accounts are recognized as demo',()=>assert.equal(demoPolicy.isDemoAccount('testing-women-01@simp-seed.demo'),true));
test('ordinary users cannot masquerade as demo by suffix lookalike',()=>assert.equal(demoPolicy.isDemoAccount('user@simp-seed.demo.evil.example'),false));
test('demo classification is case insensitive',()=>assert.equal(demoPolicy.isDemoAccount('KENJI@SIMP-SEED.DEMO'),true));
test('App Store review account uses demo pool',()=>assert.equal(demoPolicy.isDemoAccount('review@sim-p.app'),true));
test('real users exclude the demo audience',()=>assert.ok(demoPolicy.discoveryAudience('real@example.invalid').NOT.OR));
test('demo users see only the demo audience',()=>assert.ok(demoPolicy.discoveryAudience('kenji@simp-seed.demo').OR));
test('testing fixtures contain 30 adult-side profiles per gender with unique identities',()=>{const rows=JSON.parse(fs.readFileSync('backend/prisma/fixtures/testing-profiles.json'));assert.equal(rows.length,60);assert.equal(rows.filter(p=>p.gender==='WOMAN').length,30);assert.equal(rows.filter(p=>p.gender==='MAN').length,30);assert.equal(new Set(rows.map(p=>p.email)).size,60);assert.equal(new Set(rows.map(p=>p.photoSource)).size,60);assert.ok(rows.every(p=>p.displayName.includes('Demo')&&demoPolicy.isDemoAccount(p.email)&&fs.existsSync('frontend/public'+p.photo)));});

function landingComponent(){return source('frontend/src/pages/Landing.tsx',{'../content/landing.html?raw':{__esModule:true,default:fs.readFileSync('frontend/src/content/landing.html','utf8')}}).default;}
test('public landing renders approved copy without the preview banner',()=>{const Landing=landingComponent();render(React.createElement(MemoryRouter,null,React.createElement(Landing)));assert.ok(screen.getByRole('heading',{level:1}).textContent.includes('Your kind of people.'));assert.ok(screen.getByText('Meet someone who matches your energy, start a conversation, and make a plan worth showing up for.'));assert.equal(screen.queryByText(/DESIGN CONCEPT/),null);});
test('public landing signup action routes into the existing app',()=>{const {Routes,Route}=frontendRequire('react-router-dom');const Landing=landingComponent();render(React.createElement(MemoryRouter,null,React.createElement(Routes,null,React.createElement(Route,{path:'/',element:React.createElement(Landing)}),React.createElement(Route,{path:'/signup',element:React.createElement('h1',null,'Existing signup flow')}))));fireEvent.click(screen.getAllByRole('link',{name:/Find your connection/})[0]);assert.ok(screen.getByRole('heading',{name:'Existing signup flow'}));});
test('public landing assets exist and are no longer embedded in the JavaScript payload',()=>{const html=fs.readFileSync('frontend/src/content/landing.html','utf8');assert.equal(html.includes('data:image'),false);for(const match of html.matchAll(/src="(\/landing\/[^"]+)"/g))assert.ok(fs.existsSync("frontend/public"+match[1]));assert.ok(html.includes('Real people. Real connections.'));});

const adminOpsSrc=fs.readFileSync('backend/src/routes/admin-operations.routes.ts','utf8');
test('admin experience cancel, photo review and report evidence routes exist behind admin guard',()=>{for(const r of ['/admin/experiences/:id/cancel','/admin/experiences/:id/requests','/admin/photos','/admin/photos/:id/approve','/admin/reports/:id/messages'])assert.ok(adminOpsSrc.includes(r),r);assert.ok(/adminOperationsRouter\.use\(\s*"\/admin",\s*requireAuth,\s*requireRole\("ADMIN", "SUPER_ADMIN"\)/.test(adminOpsSrc));});
test('admin cancel requires a reason, audits, and notifies guests',()=>{const seg=adminOpsSrc.slice(adminOpsSrc.indexOf('/admin/experiences/:id/cancel'),adminOpsSrc.indexOf('/admin/photos"'));assert.ok(seg.includes('reasonSchema.parse'));assert.ok(seg.includes('moderationAction.create'));assert.ok(seg.includes('notify('));});
test('report evidence access is logged and never exposes deleted-account messages',()=>{assert.ok(adminOpsSrc.includes('admin_report_evidence_viewed'));assert.ok(adminOpsSrc.includes('deletedAt: null'));});
test('admin UI exposes photo review, cancel and conversation evidence',()=>{const ui=fs.readFileSync('frontend/src/components/admin/AdminOperations.tsx','utf8')+fs.readFileSync('frontend/src/pages/Admin.tsx','utf8');for(const t of ['Photo review','Cancel &amp; notify guests','View conversation (logged)','/approve'])assert.ok(ui.includes(t),t);});

test('Cloudinary signed private URLs use the url-safe base64 signature, not hex',()=>{const cs=fs.readFileSync('backend/src/services/cloudinary.service.ts','utf8');const seg=cs.slice(cs.indexOf('export function cloudinarySignedDeliveryUrl'),cs.indexOf('export function cloudinaryThumbnailUrl'));assert.ok(seg.includes("digest('base64')"));assert.equal(seg.includes("digest('hex')"),false);});
test('admin verification selfies only use signed URLs for private assets; legacy uploads keep the plain URL',()=>{const a=fs.readFileSync('backend/src/routes/admin.routes.ts','utf8');assert.ok(a.includes('(private|authenticated)'));});
test('admin dropdown options have an opaque background so choices are visible without hover',()=>{const css=fs.readFileSync('frontend/src/styles/globals.css','utf8');assert.ok(/select\.input-luxe option/.test(css));});
