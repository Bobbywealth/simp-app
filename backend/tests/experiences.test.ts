import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/utils/errors.js';

// ---------------------------------------------------------------------------
// Mocks: no database is available in this environment, so prisma and auth
// are mocked. Route-level behavior (validation, status codes, business rules)
// is exercised through supertest.
// ---------------------------------------------------------------------------

const { prismaMock, authState } = vi.hoisted(() => ({
  prismaMock: {
    experience: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    experienceRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  authState: { userId: 'user-1' },
}));

vi.mock('../src/config/db.js', () => ({ prisma: prismaMock }));

vi.mock('../src/middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = authState.userId;
    req.userRole = 'USER';
    next();
  },
  requireRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: any) =>
      next(),
}));

const { experiencesRouter } = await import('../src/routes/experiences.routes.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(experiencesRouter);
  // Minimal mirror of the real errorHandler for the cases under test.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'validation_error' });
    }
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    return res.status(500).json({ error: 'internal' });
  });
  return app;
}

const app = buildApp();

const futureIso = (hoursFromNow: number) =>
  new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
const pastIso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();

const validCreateBody = () => ({
  title: 'Rooftop dinner in the city',
  description: 'Great food, great views.',
  category: 'DINNER',
  city: 'New York',
  startsAt: futureIso(48),
  capacity: 4,
});

const openExperience = (overrides: Record<string, any> = {}) => ({
  id: 'exp-1',
  title: 'Rooftop dinner',
  description: null,
  category: 'DINNER',
  city: 'New York',
  startsAt: new Date(Date.now() + 48 * 3_600_000),
  priceCents: null,
  currency: 'USD',
  provider: null,
  capacity: 4,
  bookingUrl: null,
  imageUrl: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  hostId: 'host-1',
  status: 'OPEN',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  authState.userId = 'user-1';
});

describe('POST /experiences', () => {
  it('creates a hosted experience with status OPEN and the caller as host', async () => {
    authState.userId = 'host-9';
    prismaMock.experience.create.mockResolvedValue({ id: 'exp-new', hostId: 'host-9', status: 'OPEN' });

    const res = await request(app).post('/experiences').send(validCreateBody());

    expect(res.status).toBe(201);
    expect(prismaMock.experience.create).toHaveBeenCalledOnce();
    const data = prismaMock.experience.create.mock.calls[0][0].data;
    expect(data.hostId).toBe('host-9');
    expect(data.status).toBe('OPEN');
    expect(data.capacity).toBe(4);
  });

  it('rejects a start date in the past', async () => {
    const res = await request(app)
      .post('/experiences')
      .send({ ...validCreateBody(), startsAt: pastIso(2) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('starts_at_not_future');
    expect(prismaMock.experience.create).not.toHaveBeenCalled();
  });

  it('rejects capacity below 2', async () => {
    const res = await request(app).post('/experiences').send({ ...validCreateBody(), capacity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(prismaMock.experience.create).not.toHaveBeenCalled();
  });

  it('rejects capacity above 50', async () => {
    const res = await request(app).post('/experiences').send({ ...validCreateBody(), capacity: 51 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(prismaMock.experience.create).not.toHaveBeenCalled();
  });

  it('rejects a missing title', async () => {
    const body = validCreateBody() as Record<string, unknown>;
    delete body.title;
    const res = await request(app).post('/experiences').send(body);

    expect(res.status).toBe(400);
    expect(prismaMock.experience.create).not.toHaveBeenCalled();
  });
});

describe('POST /experiences/:id/requests', () => {
  it('creates a PENDING request for an open future experience', async () => {
    authState.userId = 'requester-1';
    prismaMock.experience.findUnique.mockResolvedValue(openExperience());
    prismaMock.experienceRequest.findFirst.mockResolvedValue(null);
    prismaMock.experienceRequest.create.mockResolvedValue({ id: 'req-1', status: 'PENDING' });

    const res = await request(app).post('/experiences/exp-1/requests').send({ note: 'Would love to join!' });

    expect(res.status).toBe(201);
    const data = prismaMock.experienceRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      experienceId: 'exp-1',
      requesterId: 'requester-1',
      status: 'PENDING',
      note: 'Would love to join!',
    });
  });

  it('404s when the experience does not exist', async () => {
    prismaMock.experience.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/experiences/nope/requests').send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('experience_not_found');
  });

  it('403s when the host requests their own experience', async () => {
    authState.userId = 'host-1';
    prismaMock.experience.findUnique.mockResolvedValue(openExperience({ hostId: 'host-1' }));

    const res = await request(app).post('/experiences/exp-1/requests').send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('cannot_request_own');
    expect(prismaMock.experienceRequest.create).not.toHaveBeenCalled();
  });

  it('400s when the experience is not OPEN', async () => {
    prismaMock.experience.findUnique.mockResolvedValue(openExperience({ status: 'FULL' }));

    const res = await request(app).post('/experiences/exp-1/requests').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('experience_not_open');
  });

  it('400s when the experience already started', async () => {
    prismaMock.experience.findUnique.mockResolvedValue(
      openExperience({ startsAt: new Date(Date.now() - 3_600_000) }),
    );

    const res = await request(app).post('/experiences/exp-1/requests').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('experience_started');
  });

  it('409s on a duplicate PENDING request', async () => {
    prismaMock.experience.findUnique.mockResolvedValue(openExperience());
    prismaMock.experienceRequest.findFirst.mockResolvedValue({ id: 'req-old', status: 'PENDING' });

    const res = await request(app).post('/experiences/exp-1/requests').send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('request_exists');
    expect(prismaMock.experienceRequest.create).not.toHaveBeenCalled();
  });

  it('409s when already APPROVED for the experience', async () => {
    prismaMock.experience.findUnique.mockResolvedValue(openExperience());
    prismaMock.experienceRequest.findFirst.mockResolvedValue({ id: 'req-old', status: 'APPROVED' });

    const res = await request(app).post('/experiences/exp-1/requests').send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('request_exists');
  });
});

describe('DELETE /experiences/:id/requests/mine', () => {
  it('cancels my pending request', async () => {
    prismaMock.experienceRequest.findFirst.mockResolvedValue({ id: 'req-1' });
    prismaMock.experienceRequest.update.mockResolvedValue({ id: 'req-1', status: 'CANCELLED' });

    const res = await request(app).delete('/experiences/exp-1/requests/mine');

    expect(res.status).toBe(200);
    expect(prismaMock.experienceRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { status: 'CANCELLED' },
    });
  });

  it('404s when there is no pending request', async () => {
    prismaMock.experienceRequest.findFirst.mockResolvedValue(null);

    const res = await request(app).delete('/experiences/exp-1/requests/mine');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('request_not_found');
  });
});

describe('POST /experiences/:id/requests/:requestId/approve', () => {
  const pendingRequest = (overrides: Record<string, any> = {}) => ({
    id: 'req-1',
    experienceId: 'exp-1',
    requesterId: 'requester-1',
    status: 'PENDING',
    experience: { id: 'exp-1', hostId: 'host-1', capacity: 2, status: 'OPEN' },
    ...overrides,
  });

  function mockTx(txImpl: Record<string, any>) {
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txImpl));
  }

  it('approves a pending request as the host', async () => {
    authState.userId = 'host-1';
    mockTx({
      experienceRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest()),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue({ id: 'req-1', status: 'APPROVED' }),
      },
      experience: { update: vi.fn().mockResolvedValue({}) },
    });

    const res = await request(app).post('/experiences/exp-1/requests/req-1/approve');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
  });

  it('marks the experience FULL when the last seat is taken', async () => {
    authState.userId = 'host-1';
    const txExperienceUpdate = vi.fn().mockResolvedValue({});
    mockTx({
      experienceRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest()),
        count: vi.fn().mockResolvedValue(1), // one already approved, capacity 2
        update: vi.fn().mockResolvedValue({ id: 'req-1', status: 'APPROVED' }),
      },
      experience: { update: txExperienceUpdate },
    });

    const res = await request(app).post('/experiences/exp-1/requests/req-1/approve');

    expect(res.status).toBe(200);
    expect(txExperienceUpdate).toHaveBeenCalledWith({
      where: { id: 'exp-1' },
      data: { status: 'FULL' },
    });
  });

  it('409s when the experience is already full', async () => {
    authState.userId = 'host-1';
    mockTx({
      experienceRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest()),
        count: vi.fn().mockResolvedValue(2), // capacity 2 already reached
        update: vi.fn(),
      },
      experience: { update: vi.fn() },
    });

    const res = await request(app).post('/experiences/exp-1/requests/req-1/approve');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('experience_full');
  });

  it('403s when a non-host tries to approve', async () => {
    authState.userId = 'stranger-1';
    mockTx({
      experienceRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest()),
        count: vi.fn(),
        update: vi.fn(),
      },
      experience: { update: vi.fn() },
    });

    const res = await request(app).post('/experiences/exp-1/requests/req-1/approve');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('not_host');
  });

  it('400s when the request is not PENDING', async () => {
    authState.userId = 'host-1';
    mockTx({
      experienceRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest({ status: 'DECLINED' })),
        count: vi.fn(),
        update: vi.fn(),
      },
      experience: { update: vi.fn() },
    });

    const res = await request(app).post('/experiences/exp-1/requests/req-1/approve');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('request_not_pending');
  });

  it('404s when the request belongs to a different experience', async () => {
    authState.userId = 'host-1';
    mockTx({
      experienceRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest({ experienceId: 'exp-other' })),
        count: vi.fn(),
        update: vi.fn(),
      },
      experience: { update: vi.fn() },
    });

    const res = await request(app).post('/experiences/exp-1/requests/req-1/approve');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('request_not_found');
  });
});

describe('POST /experiences/:id/requests/:requestId/decline', () => {
  it('declines a pending request as the host', async () => {
    authState.userId = 'host-1';
    prismaMock.experience.findUnique.mockResolvedValue(openExperience({ hostId: 'host-1' }));
    prismaMock.experienceRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      experienceId: 'exp-1',
      status: 'PENDING',
    });
    prismaMock.experienceRequest.update.mockResolvedValue({ id: 'req-1', status: 'DECLINED' });

    const res = await request(app).post('/experiences/exp-1/requests/req-1/decline');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DECLINED');
  });

  it('403s when a non-host tries to decline', async () => {
    authState.userId = 'stranger-1';
    prismaMock.experience.findUnique.mockResolvedValue(openExperience({ hostId: 'host-1' }));

    const res = await request(app).post('/experiences/exp-1/requests/req-1/decline');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('not_host');
  });

  it('400s when the request is not PENDING', async () => {
    authState.userId = 'host-1';
    prismaMock.experience.findUnique.mockResolvedValue(openExperience({ hostId: 'host-1' }));
    prismaMock.experienceRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      experienceId: 'exp-1',
      status: 'APPROVED',
    });

    const res = await request(app).post('/experiences/exp-1/requests/req-1/decline');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('request_not_pending');
  });
});

describe('PATCH /experiences/:id', () => {
  it('403s when a non-host tries to update', async () => {
    authState.userId = 'stranger-1';
    prismaMock.experience.findUnique.mockResolvedValue(openExperience({ hostId: 'host-1' }));

    const res = await request(app).patch('/experiences/exp-1').send({ title: 'New title' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('not_host');
  });

  it('400s when lowering capacity below the approved count', async () => {
    authState.userId = 'host-1';
    prismaMock.experience.findUnique.mockResolvedValue(openExperience({ hostId: 'host-1', capacity: 4 }));
    prismaMock.experienceRequest.count.mockResolvedValue(3);

    const res = await request(app).patch('/experiences/exp-1').send({ capacity: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('capacity_too_small');
    expect(prismaMock.experience.update).not.toHaveBeenCalled();
  });

  it('400s when moving startsAt into the past', async () => {
    authState.userId = 'host-1';
    prismaMock.experience.findUnique.mockResolvedValue(openExperience({ hostId: 'host-1' }));

    const res = await request(app).patch('/experiences/exp-1').send({ startsAt: pastIso(1) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('starts_at_not_future');
  });
});

describe('POST /experiences/:id/cancel', () => {
  it('cancels as the host', async () => {
    authState.userId = 'host-1';
    prismaMock.experience.findUnique.mockResolvedValue(openExperience({ hostId: 'host-1' }));
    prismaMock.experience.update.mockResolvedValue({ id: 'exp-1', status: 'CANCELLED' });

    const res = await request(app).post('/experiences/exp-1/cancel');

    expect(res.status).toBe(200);
    expect(prismaMock.experience.update).toHaveBeenCalledWith({
      where: { id: 'exp-1' },
      data: { status: 'CANCELLED' },
    });
  });

  it('403s for a non-host', async () => {
    authState.userId = 'stranger-1';
    prismaMock.experience.findUnique.mockResolvedValue(openExperience({ hostId: 'host-1' }));

    const res = await request(app).post('/experiences/exp-1/cancel');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('not_host');
  });
});

describe('GET /experiences/:id', () => {
  it('returns detail with host, counts, myRequest and isHost', async () => {
    authState.userId = 'requester-1';
    prismaMock.experience.findUnique.mockResolvedValue({
      ...openExperience(),
      host: { id: 'host-1', profile: { displayName: 'Alex', birthDate: new Date('1995-06-15') }, photos: [{ url: 'https://img/photo.jpg' }] },
    });
    prismaMock.experienceRequest.count.mockResolvedValue(2);
    prismaMock.experienceRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: 'PENDING',
      note: 'Hi!',
      createdAt: new Date(),
    });

    const res = await request(app).get('/experiences/exp-1');

    expect(res.status).toBe(200);
    expect(res.body.approvedCount).toBe(2);
    expect(res.body.isHost).toBe(false);
    expect(res.body.myRequest.status).toBe('PENDING');
    expect(res.body.host.displayName).toBe('Alex');
    expect(res.body.host.photoUrl).toBe('https://img/photo.jpg');
    expect(typeof res.body.host.age).toBe('number');
  });

  it('404s a DRAFT experience for non-hosts', async () => {
    authState.userId = 'stranger-1';
    prismaMock.experience.findUnique.mockResolvedValue(
      openExperience({ hostId: 'host-1', status: 'DRAFT' }),
    );

    const res = await request(app).get('/experiences/exp-1');

    expect(res.status).toBe(404);
  });
});
