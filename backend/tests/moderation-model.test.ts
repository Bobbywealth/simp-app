// Runs the real MobileNetV2 classifier on a real photo. Slow (~3s) and loads
// ~500MB of tfjs, so it only runs when RUN_NSFW_MODEL_TEST=1.
import path from 'node:path';
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', () => ({ env: { NSFWJS_ENABLED: true } }));
const { moderateImage } = await import('../src/services/moderation.service.js');

describe.skipIf(!process.env.RUN_NSFW_MODEL_TEST)('moderateImage with the real model', () => {
  it('screens an ordinary profile photo as safe', async () => {
    const file = path.resolve(__dirname, '../../frontend/public/test-profiles/men-v2-01.jpg');
    const result = await moderateImage(fs.readFileSync(file));
    expect(result.screened).toBe(true);
    expect(result.flagged).toBe(false);
    expect(result.scores.Neutral).toBeGreaterThan(0.5);
  }, 60_000);

  it('treats undecodable bytes as unscreened (so a moderator reviews it)', async () => {
    const result = await moderateImage(Buffer.from('definitely not an image'));
    expect(result.screened).toBe(false);
    expect(result.flagged).toBe(false);
  }, 60_000);
});
