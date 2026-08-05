import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { upsertMyProfile } from '../api/users';
import { useAuth } from '../store/auth';

const GENDERS = [
  { value: 'WOMAN', label: 'Woman' },
  { value: 'MAN', label: 'Man' },
  { value: 'NONBINARY', label: 'Non-binary' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
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

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<typeof GENDERS[number]['value']>('PREFER_NOT_TO_SAY');
  const [lookingFor, setLookingFor] = useState<typeof LOOKING_FOR[number]['value']>('EVERYONE');
  const [city, setCity] = useState('');
  const [occupation, setOccupation] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  const totalSteps = 3;

  const next = () => {
    setError(null);
    if (step === 0) {
      if (displayName.trim().length < 2) return setError('Display name is required');
      if (!birthDate) return setError('Birth date is required');
    }
    if (step < totalSteps - 1) setStep(step + 1);
    else finish();
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

  const finish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await upsertMyProfile({
        displayName: displayName.trim(),
        birthDate,
        gender,
        lookingFor,
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
  };

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
            Step {step + 1} / {totalSteps}
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
                />
                <div>
                  <span className="label-luxe">I am</span>
                  <div className="grid grid-cols-2 gap-2">
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
                  <span className="label-luxe">I am interested in</span>
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
        </motion.div>

        {error && (
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="pb-safe pt-6">
          <Button onClick={next} loading={submitting}>
            {step < totalSteps - 1 ? 'Continue' : 'Finish'}
          </Button>
        </div>
      </main>
    </div>
  );
}
