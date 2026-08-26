import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMyProfile } from '../api/users';
import { createPrompt, deletePrompt, listMyPrompts, patchMyProfile } from '../api/prompts';
import type { Prompt } from '../api/prompts';
import { deletePhoto, reorderPhotos, setPrimaryPhoto, uploadPhoto } from '../api/photos';
import type { Profile } from '../types';
import { useAuth } from '../store/auth';

const PROMPT_QUESTIONS = [
  'The way to win me over is',
  'I geek out over',
  'A perfect Sunday looks like',
  'My most controversial take',
  'My love language',
  'I will fall for you if',
  'The key to my heart is',
  'My most prized possession is',
  'You should know',
  'I am convinced',
  'Together we could',
  'My greenest flag',
  'Do not bother if',
  'My weakness is',
  'I am looking for',
];

const INTEREST_OPTIONS = [
  'Dinner', 'Travel', 'Live Music', 'Art', 'Wine', 'Wellness',
  'Fashion', 'Fitness', 'Cooking', 'Photography', 'Books', 'Outdoors',
  'Dancing', 'Volunteering', 'Tech', 'Sports',
];

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [occupation, setOccupation] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [gender, setGender] = useState<Profile['gender']>('WOMAN');
  const [lookingFor, setLookingFor] = useState<Profile['lookingFor']>('EVERYONE');
  const [interests, setInterests] = useState<string[]>([]);

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; position?: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replacePhotoId, setReplacePhotoId] = useState<string | null>(null);

  // Prompt editing
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState(PROMPT_QUESTIONS[0]);
  const [newAnswer, setNewAnswer] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [p, pr] = await Promise.all([getMyProfile(), listMyPrompts()]);
    setProfile(p);
    setPrompts(pr.prompts);
    if (p) {
      setDisplayName(p.displayName);
      setBio(p.bio ?? '');
      setCity(p.city ?? '');
      setOccupation(p.occupation ?? '');
      setHeightCm(p.heightCm ? String(p.heightCm) : '');
      setGender(p.gender);
      setLookingFor(p.lookingFor);
      setInterests(p.interests.map((i) => i.interest.slug));
      setPhotos(p.user?.photos ?? []);
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      await patchMyProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        city: city.trim() || null,
        occupation: occupation.trim() || null,
        heightCm: heightCm ? parseInt(heightCm, 10) : null,
        gender,
        lookingFor,
        interestSlugs: interests,
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(file: File) {
    setUploading(true);
    setError(null);
    const replacing = replacePhotoId;
    try {
      const uploaded = await uploadPhoto(file);
      if (replacing) {
        await deletePhoto(replacing);
        setPhotos((current) => current.map((photo) =>
          photo.id === replacing ? { id: uploaded.photoId, url: uploaded.url, position: photo.position } : photo
        ));
      } else {
        setPhotos((current) => [...current, { id: uploaded.photoId, url: uploaded.url, position: current.length }]);
      }
    } catch (e) {
      setError((e as Error).message || 'Upload failed');
    } finally {
      setReplacePhotoId(null);
      setUploading(false);
    }
  }

  async function handleDeletePhoto(id: string) {
    try {
      await deletePhoto(id);
      setPhotos((current) => current.filter((photo) => photo.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function makePrimary(id: string) {
    try {
      await setPrimaryPhoto(id);
      setPhotos((current) => {
        const selected = current.find((photo) => photo.id === id);
        return selected ? [selected, ...current.filter((photo) => photo.id !== id)] : current;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setPhotos(next);
    try {
      await reorderPhotos(next.map((photo) => photo.id));
    } catch (e) {
      setError((e as Error).message);
      await load();
    }
  }

  async function handleAddPrompt() {
    const answer = newAnswer.trim();
    if (!answer) return;
    setError(null);
    try {
      const created = await createPrompt({ question: newQuestion ?? PROMPT_QUESTIONS[0] ?? '', answer });
      setPrompts((prev) => [...prev, created]);
      setNewAnswer('');
      setShowPromptForm(false);
    } catch (e) {
      setError((e as Error).message || 'Could not add prompt');
    }
  }

  async function handleDeletePrompt(id: string) {
    try {
      await deletePrompt(id);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError((e as Error).message || 'Could not delete prompt');
    }
  }

  function toggleInterest(label: string) {
    const slug = label.toLowerCase().replace(/\s+/g, '-');
    setInterests((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug].slice(0, 8)
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 text-white/50">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-6 pb-24">
        <header className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            ‹ Back
          </button>
          <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">
            Edit profile
          </h1>
          <span className="w-12" />
        </header>

        <div className="mt-6 space-y-8">
          {/* Photos */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                Photos ({photos.length})
              </h2>
              <button
                onClick={() => { setReplacePhotoId(null); fileInputRef.current?.click(); }}
                disabled={uploading || photos.length >= 6}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300 hover:text-gold-200 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : photos.length >= 6 ? '6 photo maximum' : '+ Add photo'}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePhotoUpload(file);
                e.target.value = '';
              }}
            />
            <div className="mt-3 space-y-3">
              {photos.length === 0 && (
                <button
                  type="button"
                  onClick={() => { setReplacePhotoId(null); fileInputRef.current?.click(); }}
                  className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-gold-400/40 bg-gold-400/[0.04] py-10 text-center text-sm text-gold-200"
                >
                  <span className="text-2xl">+</span>
                  <span className="mt-2 text-xs font-semibold uppercase tracking-[0.18em]">Add your first photo</span>
                </button>
              )}
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/55 p-3"
                >
                  <img src={photo.url} alt={`Profile photo ${index + 1}`} className="h-20 w-16 flex-none rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                      Photo {index + 1}
                      {index === 0 && <span className="rounded-full bg-gold-400 px-2 py-0.5 text-[9px] font-bold uppercase text-black">Primary</span>}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Drag order changes what others see first.</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void makePrimary(photo.id)} disabled={index === 0} className="rounded-full border border-gold-400/35 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gold-200 disabled:opacity-40">Make primary</button>
                      <button type="button" onClick={() => void movePhoto(index, -1)} disabled={index === 0} className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55 disabled:opacity-30">Move left</button>
                      <button type="button" onClick={() => void movePhoto(index, 1)} disabled={index === photos.length - 1} className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55 disabled:opacity-30">Move right</button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button type="button" onClick={() => { setReplacePhotoId(photo.id); fileInputRef.current?.click(); }} className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70">Replace</button>
                    <button type="button" onClick={() => void handleDeletePhoto(photo.id)} className="rounded-full border border-red-400/30 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-red-300">Delete</button>
                  </div>
                </div>
              ))}
              {photos.length > 0 && photos.length < 6 && (
                <button type="button" onClick={() => { setReplacePhotoId(null); fileInputRef.current?.click(); }} className="flex w-full items-center justify-center rounded-2xl border border-dashed border-white/15 py-3 text-xs uppercase tracking-[0.18em] text-white/45">
                  + Add another photo
                </button>
              )}
            </div>
            <p className="mt-2 text-[10px] text-white/40">
              Drag order is saved with the arrow controls. Maximum 6 photos, 10 MB each.
            </p>
          </section>

          {/* Basics */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              Basics
            </h2>
            <div className="mt-3 space-y-3">
              <Field label="Display name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="City">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. New York"
                  className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Occupation">
                <input
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  maxLength={80}
                  placeholder="What you do"
                  className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Height (cm)">
                <input
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  type="number"
                  min={120}
                  max={230}
                  placeholder="e.g. 175"
                  className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Bio">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="What makes you memorable?"
                  className="input-luxe w-full resize-none rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </section>

          {/* Gender / LookingFor */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              Preferences
            </h2>
            <div className="mt-3">
              <p className="label-luxe mb-2">I am</p>
              <div className="grid grid-cols-2 gap-2">
                {(['WOMAN', 'MAN', 'NONBINARY', 'PREFER_NOT_TO_SAY'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      gender === g
                        ? 'border-gold-400 bg-gold-400/15 text-gold-200'
                        : 'border-white/10 bg-ink-800/60 text-white/80'
                    }`}
                  >
                    {g === 'WOMAN' ? 'Woman' : g === 'MAN' ? 'Man' : g === 'NONBINARY' ? 'Non-binary' : 'Prefer not to say'}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <p className="label-luxe mb-2">I am interested in</p>
              <div className="grid grid-cols-3 gap-2">
                {(['WOMEN', 'MEN', 'EVERYONE'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLookingFor(l)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      lookingFor === l
                        ? 'border-gold-400 bg-gold-400/15 text-gold-200'
                        : 'border-white/10 bg-ink-800/60 text-white/80'
                    }`}
                  >
                    {l === 'WOMEN' ? 'Women' : l === 'MEN' ? 'Men' : 'Everyone'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Prompts */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                Prompts ({prompts.length}/3)
              </h2>
              {prompts.length < 3 && (
                <button
                  onClick={() => setShowPromptForm((s) => !s)}
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300 hover:text-gold-200"
                >
                  {showPromptForm ? 'Cancel' : '+ Add'}
                </button>
              )}
            </div>

            {showPromptForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2 rounded-xl border border-gold-400/20 bg-ink-900/60 p-3"
              >
                <select
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
                >
                  {PROMPT_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
                <textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder="Your answer (max 280 chars)"
                  className="input-luxe w-full resize-none rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleAddPrompt}
                    disabled={!newAnswer.trim()}
                    className="btn-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] disabled:opacity-50"
                  >
                    Save prompt
                  </button>
                </div>
              </motion.div>
            )}

            <div className="mt-3 space-y-2">
              {prompts.map((p) => (
                <div key={p.id} className="rounded-xl border border-white/10 bg-ink-900/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gold-300">{p.question}</p>
                      <p className="mt-1 text-sm text-white/90">{p.answer}</p>
                    </div>
                    <button
                      onClick={() => handleDeletePrompt(p.id)}
                      className="shrink-0 text-xs text-white/40 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Interests */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              Interests ({interests.length}/8)
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((label) => {
                const slug = label.toLowerCase();
                const active = interests.includes(slug);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleInterest(label)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      active
                        ? 'border-gold-400 bg-gold-400/15 text-gold-200'
                        : 'border-white/10 bg-ink-800/60 text-white/80'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {error && (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-xs text-green-400" role="status">
              Saved.
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-gold w-full py-3 text-sm font-semibold uppercase tracking-[0.18em] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-luxe mb-1 block">{label}</label>
      {children}
    </div>
  );
}
