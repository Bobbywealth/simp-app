import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRealtimeSocket, disconnectRealtime, isTokenExpired } from '../realtime';
import * as client from '../../api/client';

vi.mock('../../api/client', () => ({
  API_BASE_URL: 'http://localhost:3000',
  getAccessToken: vi.fn(),
}));

describe('realtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    disconnectRealtime();
  });

  afterEach(() => {
    disconnectRealtime();
  });

  describe('isTokenExpired', () => {
    it('returns true for null/undefined token', () => {
      expect(isTokenExpired('')).toBe(true);
    });

    it('returns true for invalid JWT format', () => {
      expect(isTokenExpired('not-a-jwt')).toBe(true);
      expect(isTokenExpired('a.b')).toBe(true);
    });

    it('returns true for expired token', () => {
      const expiredPayload = { exp: Math.floor(Date.now() / 1000) - 3600 };
      const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;
      expect(isTokenExpired(expiredToken)).toBe(true);
    });

    it('returns false for valid non-expired token', () => {
      const validPayload = { exp: Math.floor(Date.now() / 1000) + 3600 };
      const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
      expect(isTokenExpired(validToken)).toBe(false);
    });
  });

  describe('getRealtimeSocket', () => {
    it('returns a socket instance', () => {
      vi.mocked(client.getAccessToken).mockReturnValue('mock-token');
      const socket = getRealtimeSocket();
      expect(socket).toBeDefined();
      disconnectRealtime();
    });

    it('uses provided access token in auth', () => {
      vi.mocked(client.getAccessToken).mockReturnValue('test-token-123');
      const socket = getRealtimeSocket();
      expect(socket.auth).toHaveProperty('token', 'test-token-123');
      disconnectRealtime();
    });
  });
});