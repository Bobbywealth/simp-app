import { describe, expect, it, vi } from 'vitest';

const { envState } = vi.hoisted(() => ({ envState: { NSFWJS_ENABLED: false } }));
vi.mock('../src/config/env.js', () => ({ env: envState }));

const { evaluatePredictions, moderateImage, NSFW_THRESHOLDS } = await import('../src/services/moderation.service.js');

const preds = (scores: Record<string, number>) =>
  Object.entries(scores).map(([className, probability]) => ({ className, probability }));

describe('evaluatePredictions', () => {
  it('passes an ordinary photo', () => {
    const r = evaluatePredictions(preds({ Neutral: 0.97, Drawing: 0.02, Sexy: 0.01 }));
    expect(r.flagged).toBe(false);
    expect(r.categories).toEqual([]);
  });

  it('rejects explicit content above the Porn threshold', () => {
    const r = evaluatePredictions(preds({ Porn: NSFW_THRESHOLDS.Porn + 0.05, Neutral: 0.3 }));
    expect(r.flagged).toBe(true);
    expect(r.categories).toContain('Porn');
  });

  it('rejects Hentai at its lower threshold', () => {
    expect(evaluatePredictions(preds({ Hentai: 0.45 })).flagged).toBe(true);
    expect(evaluatePredictions(preds({ Hentai: 0.3 })).flagged).toBe(false);
  });

  it('only rejects "Sexy" (suggestive) at a high score, so beach/gym photos are not blocked', () => {
    expect(evaluatePredictions(preds({ Sexy: 0.7, Neutral: 0.3 })).flagged).toBe(false);
    expect(evaluatePredictions(preds({ Sexy: 0.9 })).flagged).toBe(true);
  });

  it('keeps the raw scores for the audit log', () => {
    const r = evaluatePredictions(preds({ Neutral: 0.9, Porn: 0.1 }));
    expect(r.scores).toEqual({ Neutral: 0.9, Porn: 0.1 });
  });
});

describe('moderateImage', () => {
  it('reports "not screened" (not "safe") when screening is disabled', async () => {
    envState.NSFWJS_ENABLED = false;
    const r = await moderateImage(Buffer.from('not-an-image'));
    expect(r).toEqual({ flagged: false, screened: false, categories: [], scores: {} });
  });
});
