import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { LegalGateModal } from '../components/LegalGateModal';
import {
  completeOnboarding,
  getMyProfile,
  getOnboardingState,
  saveOnboardingState,
  upsertMyProfile,
} from '../api/users';
import { createPrompt, deletePrompt, type Prompt } from '../api/prompts';
import { uploadPhoto } from '../api/photos';
import { getLegalStatus } from '../api/legal';
import { track } from '../api/analytics';
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
type GenderValue = (typeof GENDERS)[number]['value'];
type LookingForValue = (typeof LOOKING_FOR)[number]['value'];
const INTEREST_OPTIONS = [
  'Dinner', 'Travel', 'Live Music', 'Art', 'Wine', 'Wellness', 'Fashion', 'Fitness',
  'Cooking', 'Photography', 'Books', 'Outdoors', 'Dancing', 'Volunteering', 'Tech', 'Sports',
  'Sushi', 'Coffee', 'Brunch', 'Hiking', 'Gaming', 'Movies', 'Yoga', 'Meditation',
  'Beach', 'Camping', 'Language Learning', 'Museums', 'Podcasts', 'Board Games',
  'Art Galleries', 'Wine Tasting', 'Road Trips', 'Gardening', 'DIY', 'Crafts',
];
const FOR_WOMEN = [
  'The way to win me over is', 'I geek out over', 'A perfect Sunday looks like',
  'My most controversial take', 'My love language', 'I will fall for you if',
  'The key to my heart is', 'My most prized possession is',
] as const;
const FOR_MEN = [
  'The way I show I care', 'I geek out over', 'A perfect Sunday looks like',
  'My most controversial take', 'My love language', 'I will fall for you if',
  'Where I see this going', 'My vision for us',
] as const;
const FOR_EVERYONE = [
  'The way to win me over is', 'I geek out over', 'A perfect Sunday looks like',
  'My most controversial take', 'My love language', 'I will fall for you if',
  'What I\'m looking for', 'My ideal first date',
] as const;
const LOOKING_FOR_PROMPTS = {
  WOMEN: FOR_WOMEN,
  MEN: FOR_MEN,
  EVERYONE: FOR_EVERYONE,
} as const satisfies Record<LookingForValue, readonly string[]>;
function getPromptQuestions(lookingFor: LookingForValue | ''): readonly string[] {
  return LOOKING_FOR_PROMPTS[lookingFor as LookingForValue] ?? FOR_EVERYONE;
}
const TOTAL_STEPS = 6;

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<GenderValue | ''>('');
  const [lookingFor, setLookingFor] = useState<LookingForValue | ''>('');
  const [city, setCity] = useState('');
  const [occupation, setOccupation] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [newPromptQuestion, setNewPromptQuestion] = useState(getPromptQuestions(lookingFor)[0]!);
  const [newPromptAnswer, setNewPromptAnswer] = useState('');

  useEffect(() => {
    if (lookingFor) {
      const opts = getPromptQuestions(lookingFor);
      setNewPromptQuestion(opts[0]!);
    }
  }, [lookingFor]);
  const [photos, setPhotos] = useState<Array<{ id: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [legalMissing, setLegalMissing] = useState<Array<'age' | 'tos' | 'privacy'> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOnboardingState(), getMyProfile()])
      .then(([saved, profile]) => {
        if (cancelled) return;
        const state = saved.onboardingState ?? {};
        setDisplayName(profile?.displayName ?? String(state.displayName ?? user?.onboardingState?.displayName ?? ''));
        setBirthDate(profile?.birthDate?.slice(0, 10) ?? String(state.birthDate ?? ''));
        setGender((profile?.gender ?? state.gender ?? '') as GenderValue | '');
        setLookingFor((profile?.lookingFor ?? state.lookingFor ?? '') as LookingForValue | '');
        setCity(profile?.city ?? String(state.city ?? ''));
        setOccupation(profile?.occupation ?? String(state.occupation ?? ''));
        setHeightCm(profile?.heightCm ? String(profile.heightCm) : String(state.heightCm ?? ''));
        setBio(profile?.bio ?? String(state.bio ?? ''));
        setInterests(profile?.interests.map((item) => item.interest.slug) ?? (state.interestSlugs as string[] | undefined) ?? []);
        setPrompts(profile?.user?.prompts as Prompt[] ?? []);
        setPhotos(profile?.user?.photos.map((photo) => ({ id: photo.id, url: photo.url })) ?? []);
        setStep(Math.max(0, Math.min(TOTAL_STEPS - 1, (saved.onboardingStep ?? 1) - 1)));
      })
      .catch((value) => setError((value as Error).message))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user?.onboardingState]);

  const draft = () => ({
    displayName: displayName.trim(), birthDate, gender: gender || undefined,
    lookingFor: lookingFor || undefined, city: city.trim(), occupation: occupation.trim(),
    heightCm: heightCm ? Number(heightCm) : undefined, bio: bio.trim(), interestSlugs: interests,
  });

  async function next() {
    setError(null);
    const validation = validateStep();
    if (validation) return setError(validation);
    if (step < TOTAL_STEPS - 1) {
      try {
        await saveOnboardingState(step + 2, draft());
        setStep((current) => current + 1);
      } catch (value) {
        // Auto-retry transient failures (network drops, 5xx). The most
        // common in-the-wild failure is the user closing the app or losing
        // connectivity mid-step; we try once more before showing the error.
        const message = (value as Error).message ?? '';
        const isTransient =
          /network|fetch|timeout|5\d\d|aborted|failed to fetch/i.test(message) ||
          !navigator.onLine;
        if (isTransient) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 600));
            await saveOnboardingState(step + 2, draft());
            setStep((current) => current + 1);
            return;
          } catch {
            // Fall through to error display below.
          }
        }
        setError(message);
      }
    } else {
      await finish();
    }
  }

  function validateStep() {
    if (step === 0) {
      if (displayName.trim().length < 2) return 'Enter the name you want people to see.';
      if (!birthDate) return 'Enter your birth date.';
      const birth = new Date(`${birthDate}T00:00:00Z`);
      const cutoff = new Date();
      cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
      if (Number.isNaN(birth.getTime()) || birth > cutoff) return 'You must be at least 18 to join SIMP.';
      if (!gender || !lookingFor) return 'Complete both dating preference fields.';
    }
    if (step === 1) {
      if (!city.trim()) return 'Add your city so matches know your general area.';
      if (bio.trim().length < 20) return 'Write at least 20 characters about yourself.';
    }
    if (step === 2 && interests.length < 3) return 'Choose at least 3 interests.';
    if (step === 3 && prompts.length < 1) return 'Add at least one profile prompt.';
    if (step === 4 && photos.length < 1) return 'Add at least one profile photo.';
    return null;
  }

  function back() {
    if (step > 0) setStep((current) => current - 1);
    else navigate('/verify-email-pending');
  }

  function toggleInterest(label: string) {
    const slug = label.toLowerCase().replace(/\s+/g, '-');
    setInterests((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : current.length < 8
          ? [...current, slug]
          : current,
    );
  }

  async function addPrompt() {
    const answer = newPromptAnswer.trim();
    if (!answer || prompts.length >= 3) return;
    try {
      const prompt = await createPrompt({ question: newPromptQuestion, answer, position: prompts.length });
      setPrompts((current) => [...current, prompt]);
      setNewPromptAnswer('');
    } catch (value) {
      setError((value as Error).message);
    }
  }

  async function removePrompt(id: string) {
    await deletePrompt(id);
    setPrompts((current) => current.filter((prompt) => prompt.id !== id));
  }

  async function addPhoto(file: File) {
    if (photos.length >= 6) return setError('You can add up to 6 photos.');
    setUploading(true);
    setError(null);
    try {
      const photo = await uploadPhoto(file);
      setPhotos((current) => [...current, { id: photo.photoId, url: photo.url }]);
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      await upsertMyProfile({
        displayName: displayName.trim(), birthDate, gender: gender as GenderValue,
        lookingFor: lookingFor as LookingForValue, city: city.trim(), occupation: occupation.trim() || null,
        heightCm: heightCm ? Number(heightCm) : null, bio: bio.trim(), interestSlugs: interests,
      });
      const legal = await getLegalStatus();
      const missing: Array<'age' | 'tos' | 'privacy'> = [];
      if (!legal.ageConfirmed) missing.push('age');
      if (!legal.tosAccepted || legal.tosVersion !== legal.tosCurrentVersion) missing.push('tos');
      if (!legal.privacyAccepted || legal.privacyVersion !== legal.privacyCurrentVersion) missing.push('privacy');
      if (missing.length) {
        setLegalMissing(missing);
        return;
      }
      await completeOnboarding();
      await refresh();
      void track('onboarding_completed');
      void track('profile_completed');
      navigate('/discover', { replace: true });
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-ink-950"><div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" /></div>;
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-safe">
        <header className="flex items-center justify-between pt-5">
          <button type="button" onClick={back} className="min-h-11 text-xs font-medium uppercase tracking-[0.18em] text-white/55 hover:text-white">Back</button>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-300">{step + 1} of {TOTAL_STEPS}</span>
        </header>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><motion.div animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} className="h-full bg-gradient-to-r from-gold-600 to-gold-200" /></div>

        <motion.section key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }} className="mt-8 flex-1 pb-5">
          {step === 0 && <Basics displayName={displayName} setDisplayName={setDisplayName} birthDate={birthDate} setBirthDate={setBirthDate} gender={gender} setGender={setGender} lookingFor={lookingFor} setLookingFor={setLookingFor} />}
          {step === 1 && (
            <Step title="Your story" subtitle="Enough detail to start a real conversation.">
              <div className="space-y-5"><Input label="City" value={city} onChange={(event) => setCity(event.target.value)} placeholder="New York" /><Input label="Occupation" value={occupation} onChange={(event) => setOccupation(event.target.value)} placeholder="What you do" /><Input label="Height in cm" type="number" inputMode="numeric" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} placeholder="175" /><Textarea label="Bio" value={bio} onChange={(event) => setBio(event.target.value)} placeholder="What makes you memorable?" maxLength={500} helperText={`${bio.trim().length}/500, minimum 20`} /></div>
            </Step>
          )}
          {step === 2 && (
            <Step title="Your interests" subtitle="Choose at least 3 and up to 8."><div className="flex flex-wrap gap-2">{INTEREST_OPTIONS.map((label) => { const slug = label.toLowerCase().replace(/\s+/g, '-'); const active = interests.includes(slug); return <button key={label} type="button" onClick={() => toggleInterest(label)} className={`min-h-11 rounded-full border px-4 py-2 text-sm ${active ? 'border-gold-400 bg-gold-400/15 text-gold-100' : 'border-white/10 bg-white/[0.03] text-white/70'}`}>{label}</button>; })}</div></Step>
          )}
          {step === 3 && (
            <Step title="Profile prompts" subtitle="Add 1 to 3 conversation starters."><div className="space-y-3">{prompts.map((prompt) => <div key={prompt.id} className="relative rounded-2xl border border-gold-400/15 bg-white/[0.035] p-4 pr-11"><p className="text-xs font-semibold text-gold-300">{prompt.question}</p><p className="mt-1 text-sm text-white/85">{prompt.answer}</p><button type="button" onClick={() => void removePrompt(prompt.id)} className="absolute right-3 top-3 h-8 w-8 rounded-full text-white/35 hover:bg-white/5" aria-label="Remove prompt">×</button></div>)}{prompts.length < 3 && <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><select value={newPromptQuestion} onChange={(event) => setNewPromptQuestion(event.target.value)} className="input-luxe w-full rounded-xl px-3 py-3 text-sm">{getPromptQuestions(lookingFor).map((question) => <option key={question}>{question}</option>)}</select><textarea value={newPromptAnswer} onChange={(event) => setNewPromptAnswer(event.target.value)} maxLength={280} rows={3} className="input-luxe w-full resize-none rounded-xl px-3 py-3 text-sm" placeholder="Your answer" /><button type="button" onClick={() => void addPrompt()} disabled={!newPromptAnswer.trim()} className="btn-gold-outline w-full py-2.5 text-xs uppercase tracking-[0.16em] disabled:opacity-30">Add prompt</button></div>}</div></Step>
          )}
          {step === 4 && (
            <Step title="Your photos" subtitle="Your first photo is your discovery photo. Add up to 6."><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addPhoto(file); event.target.value = ''; }} /><div className="grid grid-cols-3 gap-2">{photos.map((photo, index) => <div key={photo.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10"><img src={photo.url} alt={`Profile ${index + 1}`} className="h-full w-full object-cover" />{index === 0 && <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/70 py-1 text-center text-[9px] uppercase tracking-[0.12em] text-gold-200">Primary</span>}</div>)}{photos.length < 6 && <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="flex aspect-[3/4] items-center justify-center rounded-2xl border-2 border-dashed border-white/15 text-3xl font-light text-white/35 hover:border-gold-400/40 hover:text-gold-300">{uploading ? '…' : '+'}</button>}</div></Step>
          )}
          {step === 5 && (
            <Step title="Ready to be discovered" subtitle="Review your profile, then accept the current safety and privacy terms."><div className="overflow-hidden rounded-3xl border border-gold-400/20 bg-black/30">{photos[0] && <img src={photos[0].url} alt="Profile preview" className="aspect-[4/5] w-full object-cover" />}<div className="p-5"><h2 className="display-heading text-3xl font-light">{displayName || 'Your name'}</h2><p className="mt-1 text-sm text-white/55">{occupation}{occupation && city ? ' · ' : ''}{city}</p><p className="mt-4 text-sm leading-relaxed text-white/75">{bio}</p><div className="mt-4 flex flex-wrap gap-1.5">{interests.slice(0, 5).map((interest) => <span key={interest} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/55">{interest.replace(/-/g, ' ')}</span>)}</div></div></div><p className="mt-4 text-[11px] leading-relaxed text-white/40">Finish opens the current Terms and Privacy Policy if you have not accepted them yet.</p></Step>
          )}
        </motion.section>

        {error && <p className="mb-3 text-xs text-red-300" role="alert">{error}</p>}
        <div className="pb-safe pb-4"><Button onClick={() => void next()} loading={submitting}>{step < TOTAL_STEPS - 1 ? 'Continue' : 'Finish and discover'}</Button></div>
      </main>
      {legalMissing && <LegalGateModal missing={legalMissing} onClose={() => setLegalMissing(null)} onComplete={() => { setLegalMissing(null); void finish(); }} />}
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <><h1 className="display-heading text-3xl font-light">{title}</h1><div className="gold-divider mt-4 !mx-0" /><p className="mb-7 mt-4 text-sm leading-relaxed text-white/60">{subtitle}</p>{children}</>;
}

function Basics(props: {
  displayName: string; setDisplayName: (value: string) => void; birthDate: string; setBirthDate: (value: string) => void;
  gender: GenderValue | ''; setGender: (value: GenderValue) => void; lookingFor: LookingForValue | ''; setLookingFor: (value: LookingForValue) => void;
}) {
  return <Step title="The basics" subtitle="Your exact birth date is private. Other people only see your age."><div className="space-y-5"><Input label="Display name" value={props.displayName} onChange={(event) => props.setDisplayName(event.target.value)} maxLength={40} /><Input label="Birth date" type="date" value={props.birthDate} onChange={(event) => props.setBirthDate(event.target.value)} /><div><span className="label-luxe">I am</span><div className="grid grid-cols-2 gap-2">{GENDERS.map((item) => <button key={item.value} type="button" onClick={() => props.setGender(item.value)} className={`min-h-11 rounded-xl border px-3 text-sm ${props.gender === item.value ? 'border-gold-400 bg-gold-400/15 text-gold-100' : 'border-white/10 bg-white/[0.03] text-white/70'}`}>{item.label}</button>)}</div></div><div><span className="label-luxe">I want to meet</span><div className="grid grid-cols-3 gap-2">{LOOKING_FOR.map((item) => <button key={item.value} type="button" onClick={() => props.setLookingFor(item.value)} className={`min-h-11 rounded-xl border px-2 text-sm ${props.lookingFor === item.value ? 'border-gold-400 bg-gold-400/15 text-gold-100' : 'border-white/10 bg-white/[0.03] text-white/70'}`}>{item.label}</button>)}</div></div></div></Step>;
}
