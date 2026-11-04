import { describe, expect, it, vi } from 'vitest';

const { envState } = vi.hoisted(() => ({ envState: { PHOTO_REQUIRE_APPROVAL: false } }));
vi.mock('../src/config/env.js', () => ({ env: envState }));
const { publicPhotoWhere } = await import('../src/services/photo-visibility.js');

describe('publicPhotoWhere', () => {
  it('always hides rejected photos', () => {
    envState.PHOTO_REQUIRE_APPROVAL = false;
    expect(publicPhotoWhere()).toEqual({ status: { not: 'REJECTED' } });
  });

  it('shows only approved photos when approval is required', () => {
    envState.PHOTO_REQUIRE_APPROVAL = true;
    expect(publicPhotoWhere()).toEqual({ status: 'APPROVED' });
  });
});
