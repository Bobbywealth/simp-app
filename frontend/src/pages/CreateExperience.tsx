import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createExperience, type ExperienceCategory } from '../api/experiences';
import { EXPERIENCE_CATEGORY_OPTIONS } from '../lib/experiences';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';

const MIN_CAPACITY = 2;
const MAX_CAPACITY = 20;

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CreateExperience() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExperienceCategory | null>(null);
  const [city, setCity] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageBroken, setImageBroken] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const minDateTime = toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000));

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (title.trim().length < 3) next.title = 'Give it a title of at least 3 characters.';
    if (!category) next.category = 'Pick a category.';
    if (city.trim().length < 2) next.city = 'Where is this happening?';
    if (!startsAt) {
      next.startsAt = 'Pick a date and time.';
    } else {
      const when = new Date(startsAt).getTime();
      if (Number.isNaN(when)) {
        next.startsAt = 'That date does not look right.';
      } else if (when <= Date.now() + 30 * 60 * 1000) {
        next.startsAt = 'Pick a time at least 30 minutes in the future.';
      }
    }
    if (price.trim() && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      next.price = 'Enter a valid price, or leave it blank for free.';
    }
    if (imageUrl.trim() && !/^https?:\/\/.+\..+/.test(imageUrl.trim())) {
      next.imageUrl = 'Enter a valid image URL starting with http(s)://.';
    }
    if (description.length > 1000) next.description = 'Keep it under 1000 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await createExperience({
        title: title.trim(),
        description: description.trim() || undefined,
        category: category as ExperienceCategory,
        city: city.trim(),
        startsAt: new Date(startsAt).toISOString(),
        priceCents: price.trim() ? Math.round(Number(price) * 100) : undefined,
        capacity,
        imageUrl: imageUrl.trim() || undefined,
      });
      navigate(`/experiences/${res.id}`, { replace: true });
    } catch {
      setSubmitError('Could not create your experience. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-safe pt-6">
        <button
          onClick={() => {
            if (window.history.length > 2) navigate(-1);
            else navigate('/experiences');
          }}
          className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          ‹ Back
        </button>
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">
          Host
        </h1>
        <div className="w-12" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-md px-6 pt-6 pb-28">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h2 className="display-heading text-2xl font-light">Plan something unforgettable</h2>
          <p className="mt-1 text-sm text-white/60">
            You set the plan. Guests request a spot. You approve who comes.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <Input
            label="Title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rooftop dinner in Manhattan"
            maxLength={80}
            error={errors.title}
          />

          <div>
            <span className="label-luxe">Category</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXPERIENCE_CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  className={`min-h-10 rounded-full border px-4 py-2 text-sm transition ${
                    category === opt.value
                      ? 'border-gold-400 bg-gold-400/15 text-gold-100'
                      : 'border-white/10 text-white/55 hover:border-white/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.category && (
              <p className="mt-2 text-xs text-red-300" role="alert">{errors.category}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="New York"
              maxLength={60}
              error={errors.city}
            />
            <Input
              label="Date & time"
              name="startsAt"
              type="datetime-local"
              value={startsAt}
              min={minDateTime}
              onChange={(e) => setStartsAt(e.target.value)}
              error={errors.startsAt}
            />
          </div>

          <div>
            <span className="label-luxe">Spots available</span>
            <div className="mt-2 flex items-center gap-4">
              <button
                type="button"
                aria-label="Decrease capacity"
                onClick={() => setCapacity((c) => Math.max(MIN_CAPACITY, c - 1))}
                disabled={capacity <= MIN_CAPACITY}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-xl text-white/70 transition hover:border-gold-300/50 hover:text-gold-200 disabled:opacity-30"
              >
                −
              </button>
              <span className="min-w-16 text-center text-2xl font-light text-white" aria-live="polite">
                {capacity}
              </span>
              <button
                type="button"
                aria-label="Increase capacity"
                onClick={() => setCapacity((c) => Math.min(MAX_CAPACITY, c + 1))}
                disabled={capacity >= MAX_CAPACITY}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-xl text-white/70 transition hover:border-gold-300/50 hover:text-gold-200 disabled:opacity-30"
              >
                +
              </button>
              <span className="text-xs text-white/40">{MIN_CAPACITY}–{MAX_CAPACITY} guests</span>
            </div>
          </div>

          <Input
            label="Price per person (optional)"
            name="price"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Leave blank for free"
            helperText="Guests see this before requesting a spot."
            error={errors.price}
          />

          <Textarea
            label="Description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
            placeholder="Set the scene. What's the vibe, the plan, the dress code?"
            rows={4}
            error={errors.description}
          />

          <Input
            label="Cover image URL (optional)"
            name="imageUrl"
            type="url"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              setImageBroken(false);
            }}
            placeholder="https://…"
            error={errors.imageUrl}
          />

          {imageUrl.trim() && !errors.imageUrl && (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {!imageBroken ? (
                <img
                  src={imageUrl.trim()}
                  alt="Cover preview"
                  className="aspect-video w-full object-cover"
                  onError={() => setImageBroken(true)}
                />
              ) : (
                <p className="px-4 py-6 text-center text-xs text-red-300/70">
                  Couldn't load that image. Check the URL and try another.
                </p>
              )}
            </div>
          )}

          {submitError && (
            <p className="rounded-xl border border-red-300/30 bg-red-300/10 px-4 py-3 text-xs text-red-200" role="alert">
              {submitError}
            </p>
          )}

          <Button type="submit" loading={submitting} className="py-4 text-xs font-bold uppercase tracking-[0.2em]">
            Publish experience
          </Button>
        </form>
      </main>
    </div>
  );
}
