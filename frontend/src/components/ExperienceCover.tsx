import { useState } from 'react';
import type { ExperienceCategory } from '../api/experiences';
import { categoryGradient } from '../lib/experiences';

const CATEGORY_GLYPH: Record<ExperienceCategory, string> = {
  DINNER: '🍽️',
  DRINKS: '🍸',
  EVENT: '🎟️',
  CONCERT: '🎤',
  TRAVEL: '✈️',
  SHOPPING: '🛍️',
  ADVENTURE: '⛰️',
  VIP: '👑',
  OTHER: '✨',
};

/**
 * Cover art for an experience. Uses the host's photo when there is one;
 * otherwise draws a themed cover from the category so no plan ever looks empty.
 */
export function ExperienceCover({
  imageUrl,
  category,
  title,
  className = '',
}: {
  imageUrl: string | null;
  category: ExperienceCategory;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!imageUrl && !failed;

  return (
    <div className={`relative overflow-hidden bg-ink-900 ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${categoryGradient(category)}`} aria-hidden />
      {!showImage && (
        <>
          <div
            className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-gold-300/15 blur-3xl"
            aria-hidden
          />
          <div
            className="absolute inset-0 flex items-center justify-center text-[8rem] leading-none opacity-30 saturate-50"
            aria-hidden
          >
            {CATEGORY_GLYPH[category]}
          </div>
        </>
      )}
      {showImage && (
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
