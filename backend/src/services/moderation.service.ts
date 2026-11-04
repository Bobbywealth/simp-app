import sharp from 'sharp';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type ModerationResult = {
  /** True when the image should be rejected outright. */
  flagged: boolean;
  /** True when a classifier actually ran. False means "nobody looked at this photo". */
  screened: boolean;
  categories: string[];
  scores: Record<string, number>;
};

type Prediction = { className: string; probability: number };

type NsfwModel = { classify(img: unknown): Promise<Prediction[]> };
type TfModule = {
  setBackend(name: string): Promise<boolean>;
  ready(): Promise<void>;
  tensor3d(values: Int32Array, shape: [number, number, number], dtype: 'int32'): { dispose(): void };
};

// Thresholds are deliberately strict for a dating app: explicit content is
// rejected, "Sexy" (suggestive) is only rejected at a high score.
export const NSFW_THRESHOLDS = { Porn: 0.6, Hentai: 0.4, Sexy: 0.85 } as const;

/** Pure decision function so the policy is unit-testable without a model. */
export function evaluatePredictions(predictions: Prediction[]): Omit<ModerationResult, 'screened'> {
  const scores: Record<string, number> = {};
  for (const p of predictions) scores[p.className] = p.probability;
  const categories = (Object.keys(NSFW_THRESHOLDS) as Array<keyof typeof NSFW_THRESHOLDS>).filter(
    (name) => (scores[name] ?? 0) > NSFW_THRESHOLDS[name],
  );
  return { flagged: categories.length > 0, categories, scores };
}

let loading: Promise<{ tf: TfModule; model: NsfwModel } | null> | null = null;

async function loadClassifier() {
  if (!loading) {
    loading = (async () => {
      try {
        // Pure-JS CPU backend: no native bindings, works on Render's build image.
        const tf = require('@tensorflow/tfjs') as TfModule;
        await tf.setBackend('cpu');
        await tf.ready();
        const nsfwjs = require('nsfwjs') as { load(name: string): Promise<NsfwModel> };
        const model = await nsfwjs.load('MobileNetV2');
        logger.info({ event: 'nsfw_model_loaded' });
        return { tf, model };
      } catch (err) {
        loading = null; // allow a retry on the next upload
        logger.error({ event: 'nsfw_model_load_failed', error: err instanceof Error ? err.message : String(err) });
        return null;
      }
    })();
  }
  return loading;
}

const unscreened = (): ModerationResult => ({ flagged: false, screened: false, categories: [], scores: {} });

export async function moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
  if (!env.NSFWJS_ENABLED) return unscreened();

  const classifier = await loadClassifier();
  if (!classifier) {
    logger.warn({ event: 'nsfw_model_not_available', action: 'left_pending_for_manual_review' });
    return unscreened();
  }

  try {
    const { data, info } = await sharp(imageBuffer)
      .rotate()
      .resize(224, 224, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const tensor = classifier.tf.tensor3d(new Int32Array(data), [info.height, info.width, 3], 'int32');
    try {
      const predictions = await classifier.model.classify(tensor);
      return { ...evaluatePredictions(predictions), screened: true };
    } finally {
      tensor.dispose();
    }
  } catch (err) {
    logger.error({ event: 'nsfw_classification_failed', error: err instanceof Error ? err.message : String(err) });
    return unscreened();
  }
}
