import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type ModerationResult = {
  flagged: boolean;
  categories: string[];
  scores: Record<string, number>;
};

type NsfwJsModel = {
  classify(img: unknown): Promise<Array<{ className: string; probability: number }>>;
};

let nsfwModel: NsfwJsModel | null = null;
let modelLoading = false;
let modelReady = false;

async function loadModel() {
  if (modelReady || modelLoading) return;
  modelLoading = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nsfwjs = require('nsfwjs') as { load(): Promise<NsfwJsModel> };
    nsfwModel = await nsfwjs.load();
    modelReady = true;
    logger.info({ event: 'nsfw_model_loaded' });
  } catch (err) {
    logger.error({ event: 'nsfw_model_load_failed', error: err instanceof Error ? err.message : String(err) });
  } finally {
    modelLoading = false;
  }
}

export async function moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
  const categories: string[] = [];
  const scores: Record<string, number> = {};

  if (!env.NSFWJS_ENABLED) {
    return { flagged: false, categories, scores };
  }

  await loadModel();

  if (!modelReady || !nsfwModel) {
    logger.warn({ event: 'nsfw_model_not_available', returning: 'not_flagged' });
    return { flagged: false, categories: [], scores: {} };
  }

  try {
    const predictions = await nsfwModel.classify(imageBuffer);

    for (const pred of predictions) {
      scores[pred.className] = pred.probability;
      const threshold = 0.7;
      if (pred.className !== 'Neutral' && pred.className !== 'Picture' && pred.probability > threshold) {
        categories.push(pred.className);
      }
    }

    const flaggedCategories = ['Porn', 'Hentai', 'Sexy'];
    const isFlagged = categories.some((c) => flaggedCategories.includes(c)) ||
      (scores['Porn'] ?? 0) > 0.6 ||
      (scores['Hentai'] ?? 0) > 0.4 ||
      (scores['Sexy'] ?? 0) > 0.6;

    return { flagged: isFlagged, categories, scores };
  } catch (err) {
    logger.error({ event: 'nsfw_classification_failed', error: err instanceof Error ? err.message : String(err) });
    return { flagged: false, categories: [], scores: {} };
  }
}
