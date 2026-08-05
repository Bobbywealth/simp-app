import { Router } from 'express';
import { signupSchema, loginSchema, refreshSchema } from '../validation/auth.js';
import * as authService from '../services/auth.service.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/signup', async (req, res, next) => {
  try {
    const input = signupSchema.parse(req.body);
    const tokens = await authService.signup(input);
    res.status(201).json(tokens);
  } catch (e) {
    next(e);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const tokens = await authService.login(input);
    res.json(tokens);
  } catch (e) {
    next(e);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await authService.refresh(refreshToken);
    res.json(tokens);
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const { prisma } = await import('../config/db.js');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { interests: { include: { interest: true } } } } },
    });
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      profile: user.profile,
    });
  } catch (e) {
    next(e);
  }
});
