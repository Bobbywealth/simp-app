import { z } from 'zod';

export const deviceSchema = z
  .object({
    deviceId: z.string().min(1).max(200).optional(),
    deviceName: z.string().min(1).max(120).optional(),
    platform: z.enum(['IOS', 'ANDROID', 'WEB']).default('WEB'),
  })
  .optional();

export const strongPasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number');

export const signupSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: strongPasswordSchema,
  displayName: z.string().trim().min(2).max(40),
  device: deviceSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
  device: deviceSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(4096).optional(),
  device: deviceSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(512),
  password: strongPasswordSchema,
});

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(512) });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string(),
    revokeOtherSessions: z.boolean().default(true),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DeviceInput = z.infer<typeof deviceSchema>;
