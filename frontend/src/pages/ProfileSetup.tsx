import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { upsertMyProfile } from '../api/users';
import { createPrompt } from '../api/prompts';
import type { Prompt } from '../api/prompts';
import { uploadPhoto } from '../api/photos';
import { useAuth } from '../store/auth';

const GENDERS = [
  { value: 'WOMAN', label: 'Woman' },
  { value: 'MAN', label: 'Man' },
  { value: 'NONBINARY', label: 'Non-binary' },
] as const;

const LOOKING_FOR = [
  { value: 'WOMEN', label: 'Women' },
  { value: 'MEN', label: 'Men' },
  { value: 'EVERYONE', label: 'Everyone' },
] as const;

const INTEREST_OPTIONS = [
  'Dinner', 'Travel', 'Live Music', 'Art', 'Wine', 'Wellness',
  'Fashion', 'Fitness', 'Cooking', 'Photography', 'Books', 'Outdoors',
  'Dancing', 'Volunteering', 'Tech', 'Sports',
];

const PROMPT_QUESTIONS = [
  'The way to win me over is',
  'I geek out over',
  'A perfect Sunday looks like',
  'My most controversial take',
  'My love language',
  'I will fall for you if',
  'The key to my heart is',
  'My most prized possession is',
];

const TOTAL_STEPS = 5;

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<typeof GENDERS[number]['value'] | ''>('');
  const [lookingFor, setLookingFor] = useState<typeof LOOKING_FOR[number]['value'] | ''>('');

  const [city, setCity] = useState('');
  const [occupation, setOccupation] = useState('');
  const [bio, setBio] = useState('');

  const [interests, setInterests] = useState<string[]>([]);

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [newPromptQuestion, setNewPromptQuestion] = useState(PROMPT_QUESTIONS[0]);
  const [newPromptAnswer, setNewPromptAnswer] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const next = async () => {
    setError(null);
    if (step === 0) {
      if (displayName.trim().length < 2) return setError('Display name is required');
      if (!birthDate) return setError('Birth date is required');
      if (!gender) return setError('Please select your gender');
      if (!lookingFor) return setError('Please select who you are interested in');
    }
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      await finish();
    }
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
    else navigate(-1);
  };

  const toggleInterest = (label: string) => {
    const slug = label.toLowerCase();
    setInterests((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug].slice(0, 8)
    );
  };

  async function handleAddPrompt() {
    const answer = newPromptAnswer.trim();
    if (!answer || prompts.length >= 3) return;
    try {
      const created = await createPrompt({ question: newPromptQuestion ?? PROMPT_QUESTIONS[0] ?? '', answer });
      setPrompts((prev) => [...prev, created]);
      setNewPromptAnswer('');
    } catch (e) {
      setError((e as Error).message || 'Could not add prompt');
    }
  }

  async function handlePhotoUpload(file: File) {
    setUploading(true);
    try {
      const res = await uploadPhoto(file);
      setPhotos((prev) => [...prev, { id: res.photoId, url: res.url }]);
    } catch (e) {
      setError((e as Error).message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      await upsertMyProfile({
        displayName: displayName.trim(),
        birthDate,
        gender: gender as 'WOMAN' | 'MAN' | 'NONBINARY',
        lookingFor: lookingFor as 'WOMEN' | 'MEN' | 'EVERYONE',
        city: city.trim() || null,
        occupation: occupation.trim() || null,
        bio: bio.trim() || null,
        interestSlugs: interests,
      });
      await refresh();
      navigate('/home', { replace: true });
    } catch (e) {
      setError((e as Error).message || 'Could not save profile');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-safe">
        <header className="flex items-center justify-between pt-6">
          <button
            type="button"
            onClick={back}
            className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            ← Back
          </button>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
            Step {step + 1} / {TOTAL_STEPS}
          </span>
        </header>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-10 flex-1"
        >
          {step === 0 && (
            <>
              <h1 className="display-heading text-3xl font-light">The basics</h1>
              <div className="gold-divider mt-4 !mx-0" />
              <p className="mt-4 text-sm text-white/70">Tell us who you are.</p>
              <div className="mt-8 space-y-5">
                <Input
                  label="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  maxLength={40}
                />
                <Input
                  label="Birth date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  helperText="YYYY-MM-DD"
                />
                <div>
                  <span className="label-luxe">I am *</span>
                  <div className="grid grid-cols-3 gap-2">
                    {GENDERS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setGender(g.value)}
                        className={`rounded-xl border px-3 py-3 text-sm transition ${
                          gender === g.value
                            ? 'border-gold-400 bg-gold-400/15 text-gold-200'
                            : 'border-white/10 bg-ink-800/60 text-white/80 hover:border-white/30'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="label-luxe">I am interested in *</span>
                  <div className="grid grid-cols-3 gap-2">
                    {LOOKING_FOR.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => setLookingFor(l.value)}
                        className={`rounded-xl border px-3 py-3 text-sm transition ${
                          lookingFor === l.value
                            ? 'border-gold-400 bg-gold-400/15 text-gold-200'
                            : 'border-white/10 bg-ink-800/60 text-white/80 hover:border-white/30'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="display-heading text-3xl font-light">Your story</h1>
              <div className="gold-divider mt-4 !mx-0" />
              <p className="mt-4 text-sm text-white/70">A little about you makes connections easier.</p>
              <div className="mt-8 space-y-5">
                <Input
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. New York"
                />
                <Input
                  label="Occupation"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="What you do"
                />
                <Textarea
                  label="Bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What makes you memorable?"
                  maxLength={500}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="display-heading text-3xl font-light">Your interests</h1>
              <div className="gold-divider mt-4 !mx-0" />
              <p className="mt-4 text-sm text-white/70">Pick up to 8. This helps us curate matches.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((label) => {
                  const slug = label.toLowerCase();
                  const active = interests.includes(slug);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleInterest(label)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        active
                          ? 'border-gold-400 bg-gold-400/15 text-gold-200'
                          : 'border-white/10 bg-ink-800/60 text-white/80 hover:border-white/30'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="display-heading text-3xl font-light">Your prompts</h1>
              <div className="gold-divider mt-4 !mx-0" />
              <p className="mt-4 text-sm text-white/70">
                Add up to 3 prompts. These help others see your personality.
              </p>

              <div className="mt-6 space-y-3">
                {prompts.map((p) => (
                  <div key={p.id} className="rounded-xl border border-gold-400/20 bg-ink-900/60 p-3">
                    <p className="text-xs font-medium text-gold-300">{p.question}</p>
                    <p className="mt-1 text-sm text-white/90">{p.answer}</p>
                  </div>
                ))}
              </div>

              {prompts.length < 3 && (
                <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-ink-900/60 p-3">
                  <select
                    value={newPromptQuestion}
                    onChange={(e) => setNewPromptQuestion(e.target.value)}
                    className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
                  >
                    {PROMPT_QUESTIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={newPromptAnswer}
                    onChange={(e) => setNewPromptAnswer(e.target.value)}
                    maxLength={280}
                    rows={2}
                    placeholder="Your answer (max 280 chars)"
                    className="input-luxe w-full resize-none rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleAddPrompt}
                      disabled={!newPromptAnswer.trim()}
                      className="btn-gold-outline px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] disabled:opacity-50"
                    >
                      Add prompt
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="display-heading text-3xl font-light">Your photos</h1>
              <div className="gold-divider mt-4 !mx-0" />
              <p className="mt-4 text-sm text-white/70">
                Add at least one photo to appear in others&apos; Discover deck.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                  e.target.value = '';
                }}
              />

              <div className="mt-6 grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-white/10">
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-white/20 text-2xl text-white/40 hover:border-gold-400/40 hover:text-gold-300 disabled:opacity-50"
                >
                  {uploading ? '…' : '+'}
                </button>
              </div>
              <p className="mt-3 text-[10px] text-white/40">
                {photos.length === 0 ? 'Required to be seen in Discover.' : 'Add up to 6 photos.'}
              </p>
            </>
          )}
        </motion.div>

        {error && (
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="pb-safe pt-6">
          <Button onClick={next} loading={submitting}>
            {step < TOTAL_STEPS - 1 ? 'Continue' : 'Finish'}
          </Button>
        </div>
      </main>
    </div>
  );
}
