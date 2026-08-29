import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createPrompt,
  deletePrompt,
  listMyPrompts,
  reorderPrompts,
  updatePrompt,
} from '../api/prompts';
import type { Prompt } from '../api/prompts';
import {
  deletePhoto,
  reorderPhotos,
  setPrimaryPhoto,
  uploadPhoto,
  type UploadedPhoto,
} from '../api/photos';
import { getMyProfile, patchMyProfile } from '../api/users';
import type { Profile } from '../types';
import { useAuth } from '../store/auth';
import { Tag } from '../components/Tag';

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
  'Sushi', 'Coffee', 'Brunch', 'Hiking', 'Gaming', 'Movies', 'Yoga', 'Meditation',
  'Beach', 'Camping', 'Language Learning', 'Museums', 'Podcasts', 'Board Games',
  'Art Galleries', 'Wine Tasting', 'Road Trips', 'Gardening', 'DIY', 'Crafts',
];

const MAX_CUSTOM_INTERESTS = 3;
const MAX_INTERESTS = 8;
const PROMPT_ANSWER_MAX = 280;
const BIO_MAX = 500;
const CUSTOM_INTEREST_MAX = 24;

type SectionKey = 'photos' | 'basics' | 'about' | 'prompts' | 'interests';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'photos', label: 'Photos' },
  { key: 'basics', label: 'Basics' },
  { key: 'about', label: 'About' },
  { key: 'prompts', label: 'Prompts' },
  { key: 'interests', label: 'Interests' },
];

interface PhotoItem extends UploadedPhoto {
  /** local file preview url for items not yet uploaded. */
  localUrl?: string;
  uploading?: boolean;
}

interface Draft {
  displayName: string;
  bio: string;
  city: string;
  occupation: string;
  heightCm: string;
  gender: Profile['gender'];
  lookingFor: Profile['lookingFor'];
  birthDate?: string | null;
  curatedInterests: string[];
  customInterests: string[];
  photos: PhotoItem[];
  prompts: Prompt[];
}

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [savedSection, setSavedSection] = useState<SectionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('photos');
  const [previewMode, setPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!draft) return;
    const handler = window.setTimeout(() => {
      try {
        localStorage.setItem('simp.profile.draft', JSON.stringify({
          ...draft,
          photos: draft.photos.map((p) => ({ id: p.id, photoId: p.photoId, url: p.url, position: p.position })),
        }));
      } catch {
        // localStorage may be unavailable (private mode); ignore.
      }
    }, 400);
    return () => window.clearTimeout(handler);
  }, [draft]);

  async function load() {
    try {
      const [p, pr] = await Promise.all([getMyProfile(), listMyPrompts()]);
      setProfile(p);
      if (p) {
        setDraft({
          displayName: p.displayName,
          bio: p.bio ?? '',
          city: p.city ?? '',
          occupation: p.occupation ?? '',
          heightCm: p.heightCm ? String(p.heightCm) : '',
          gender: p.gender,
          lookingFor: p.lookingFor,
          birthDate: p.birthDate,
          curatedInterests: p.interests.map((i) => i.interest.slug),
          customInterests: p.customInterests ?? [],
          photos: (p.user?.photos ?? []).map((photo) => ({
            id: photo.id,
            photoId: photo.id,
            url: photo.url,
            thumbnailUrl: photo.thumbnailUrl ?? null,
            position: photo.position,
            width: photo.width ?? null,
            height: photo.height ?? null,
            aspectRatio: photo.aspectRatio ?? null,
            isPrimary: photo.position === 0,
          })),
          prompts: pr.prompts,
        });
      }
    } catch (e) {
      setError((e as Error).message || 'Could not load profile.');
    }
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  async function saveBasics() {
    if (!draft) return;
    setSavingSection('basics');
    setError(null);
    try {
      await patchMyProfile({
        displayName: draft.displayName.trim(),
        gender: draft.gender,
        lookingFor: draft.lookingFor,
        city: draft.city.trim() || null,
        occupation: draft.occupation.trim() || null,
        heightCm: draft.heightCm ? Number(draft.heightCm) : null,
      });
      await refresh();
      flashSaved('basics');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingSection(null);
    }
  }

  async function saveAbout() {
    if (!draft) return;
    setSavingSection('about');
    setError(null);
    try {
      await patchMyProfile({
        bio: draft.bio.trim() || null,
      });
      await refresh();
      flashSaved('about');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingSection(null);
    }
  }

  async function saveInterests() {
    if (!draft) return;
    setSavingSection('interests');
    setError(null);
    try {
      const sanitized = draft.customInterests
        .map((c) => c.trim())
        .filter((c) => c.length >= 2 && c.length <= CUSTOM_INTEREST_MAX)
        .slice(0, MAX_CUSTOM_INTERESTS);
      await patchMyProfile({
        interestSlugs: draft.curatedInterests.slice(0, MAX_INTERESTS),
        customInterests: sanitized,
      });
      await refresh();
      flashSaved('interests');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingSection(null);
    }
  }

  function flashSaved(section: SectionKey) {
    setSavedSection(section);
    window.setTimeout(() => setSavedSection((current) => (current === section ? null : current)), 1800);
  }

  function toggleCuratedInterest(slug: string) {
    if (!draft) return;
    updateDraft({
      curatedInterests: draft.curatedInterests.includes(slug)
        ? draft.curatedInterests.filter((s) => s !== slug)
        : [...draft.curatedInterests, slug].slice(0, MAX_INTERESTS),
    });
  }

  function addCustomInterest(label: string) {
    if (!draft) return;
    const cleaned = label.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2 || cleaned.length > CUSTOM_INTEREST_MAX) return;
    if (draft.customInterests.length >= MAX_CUSTOM_INTERESTS) return;
    if (draft.customInterests.some((c) => c.toLowerCase() === cleaned.toLowerCase())) return;
    updateDraft({ customInterests: [...draft.customInterests, cleaned] });
  }

  function removeCustomInterest(label: string) {
    if (!draft) return;
    updateDraft({
      customInterests: draft.customInterests.filter((c) => c !== label),
    });
  }

  // Photo management --------------------------------------------------------

  async function handlePhotoUpload(file: File, replacingId?: string) {
    setError(null);
    try {
      const uploaded = await uploadPhoto(file);
      if (replacingId) {
        await deletePhoto(replacingId);
        updateDraft({
          photos: draft!.photos.map((p) =>
            p.id === replacingId ? { ...uploaded, id: uploaded.photoId } : p,
          ),
        });
      } else {
        updateDraft({
          photos: [...draft!.photos, uploaded],
        });
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message || 'Upload failed.');
    }
  }

  async function handleDeletePhoto(id: string) {
    try {
      await deletePhoto(id);
      updateDraft({
        photos: draft!.photos.filter((p) => p.id !== id),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleMakePrimary(id: string) {
    try {
      await setPrimaryPhoto(id);
      const sorted = [...draft!.photos];
      const target = sorted.find((p) => p.id === id);
      if (!target) return;
      sorted.sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : a.position - b.position));
      updateDraft({ photos: sorted });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleReorder(orderedIds: string[]) {
    try {
      await reorderPhotos(orderedIds);
      const map = new Map(draft!.photos.map((p) => [p.id, p]));
      const next = orderedIds.map((id, index) => {
        const photo = map.get(id)!;
        return { ...photo, position: index, isPrimary: index === 0 };
      });
      updateDraft({ photos: next });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Prompt management -------------------------------------------------------

  async function handleAddPrompt(question: string, answer: string) {
    if (!draft) return;
    setError(null);
    try {
      const created = await createPrompt({ question, answer, position: draft.prompts.length });
      const next = [...draft.prompts, created];
      updateDraft({ prompts: next });
      await refresh();
      flashSaved('prompts');
    } catch (e) {
      setError((e as Error).message || 'Could not add prompt.');
    }
  }

  async function handleUpdatePrompt(id: string, patch: { question?: string; answer?: string }) {
    if (!draft) return;
    setError(null);
    try {
      const updated = await updatePrompt(id, patch);
      updateDraft({
        prompts: draft.prompts.map((p) => (p.id === id ? updated : p)),
      });
    } catch (e) {
      setError((e as Error).message || 'Could not update prompt.');
    }
  }

  async function handleDeletePrompt(id: string) {
    if (!draft) return;
    try {
      await deletePrompt(id);
      const remaining = draft.prompts.filter((p) => p.id !== id);
      updateDraft({ prompts: remaining });
      await reorderPrompts(remaining.map((p) => p.id));
      await refresh();
    } catch (e) {
      setError((e as Error).message || 'Could not delete prompt.');
    }
  }

  async function handleReorderPrompts(orderedIds: string[]) {
    if (!draft) return;
    setError(null);
    try {
      const updated = await reorderPrompts(orderedIds);
      updateDraft({ prompts: updated.prompts });
    } catch (e) {
      setError((e as Error).message || 'Could not reorder prompts.');
    }
  }

  // Drag-to-reorder helpers -------------------------------------------------

  const dragPhoto = useRef<{ id: string; startY: number; offset: number } | null>(null);
  const dragPrompt = useRef<{ id: string; startY: number; offset: number } | null>(null);

  function onPhotoDragStart(id: string, event: React.PointerEvent<HTMLLIElement>) {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    dragPhoto.current = { id, startY: event.clientY, offset: 0 };
  }
  function onPhotoDragMove(event: React.PointerEvent<HTMLLIElement>) {
    if (!dragPhoto.current) return;
    dragPhoto.current.offset = event.clientY - dragPhoto.current.startY;
  }
  function onPhotoDragEnd(event: React.PointerEvent<HTMLLIElement>) {
    const target = event.currentTarget;
    target.releasePointerCapture(event.pointerId);
    if (!dragPhoto.current || !draft) return;
    const dy = dragPhoto.current.offset;
    dragPhoto.current = null;
    if (Math.abs(dy) < 32) return;
    const ids = draft.photos.map((p) => p.id);
    const fromIdx = ids.indexOf(dragPhoto.current!.id);
    const toIdx = Math.max(0, Math.min(ids.length - 1, fromIdx + Math.round(dy / 80)));
    if (fromIdx === toIdx || fromIdx < 0) return;
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved!);
    void handleReorder(next);
  }

  function onPromptDragStart(id: string, event: React.PointerEvent<HTMLLIElement>) {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    dragPrompt.current = { id, startY: event.clientY, offset: 0 };
  }
  function onPromptDragMove(event: React.PointerEvent<HTMLLIElement>) {
    if (!dragPrompt.current) return;
    dragPrompt.current.offset = event.clientY - dragPrompt.current.startY;
  }
  function onPromptDragEnd(event: React.PointerEvent<HTMLLIElement>) {
    const target = event.currentTarget;
    target.releasePointerCapture(event.pointerId);
    if (!dragPrompt.current || !draft) return;
    const dy = dragPrompt.current.offset;
    dragPrompt.current = null;
    if (Math.abs(dy) < 32) return;
    const ids = draft.prompts.map((p) => p.id);
    const fromIdx = ids.indexOf(dragPrompt.current!.id);
    const toIdx = Math.max(0, Math.min(ids.length - 1, fromIdx + Math.round(dy / 80)));
    if (fromIdx === toIdx || fromIdx < 0) return;
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved!);
    void handleReorderPrompts(next);
  }

  // Section progress --------------------------------------------------------

  const sectionStatus = useMemo<Record<SectionKey, 'complete' | 'incomplete'>>(() => {
    if (!draft) {
      return { photos: 'incomplete', basics: 'incomplete', about: 'incomplete', prompts: 'incomplete', interests: 'incomplete' };
    }
    return {
      photos: draft.photos.length >= 2 ? 'complete' : 'incomplete',
      basics: draft.displayName.trim().length >= 2 ? 'complete' : 'incomplete',
      about: draft.bio.trim().length >= 20 ? 'complete' : 'incomplete',
      prompts: draft.prompts.length >= 1 ? 'complete' : 'incomplete',
      interests: draft.curatedInterests.length + draft.customInterests.length >= 3 ? 'complete' : 'incomplete',
    };
  }, [draft]);

  if (!profile || !draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 text-white/50">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />

      <header className="sticky top-0 z-30 mx-auto flex w-full max-w-md items-center justify-between bg-black/55 px-5 pt-safe pb-3 backdrop-blur-xl border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-white/80 transition hover:bg-white/[0.1]"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-gold-300/85">
            Edit profile
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/45">
            {previewMode ? 'Preview' : 'Draft saved'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewMode((m) => !m)}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
            previewMode ? 'bg-gold-400 text-ink-950' : 'bg-white/[0.05] text-white/80 hover:bg-white/[0.1]'
          }`}
          aria-label={previewMode ? 'Switch to edit' : 'Preview profile'}
        >
          {previewMode ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </header>

      {error && (
        <p className="mx-auto mt-4 max-w-md rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-200" role="alert">
          {error}
        </p>
      )}

      {previewMode ? (
        <PreviewFrame draft={draft} onExit={() => setPreviewMode(false)} />
      ) : (
        <>
          <nav
            className="sticky top-[68px] z-20 mx-auto flex w-full max-w-md gap-2 overflow-x-auto border-b border-white/[0.06] bg-black/35 px-5 py-2 backdrop-blur"
            aria-label="Profile sections"
          >
            {SECTIONS.map((s) => {
              const status = sectionStatus[s.key];
              const active = activeSection === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveSection(s.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition ${
                    active
                      ? 'bg-gold-400 text-ink-950'
                      : status === 'complete'
                        ? 'border border-gold-400/35 bg-gold-400/[0.06] text-gold-200'
                        : 'border border-white/10 bg-white/[0.04] text-white/65 hover:text-white'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full ${
                      active ? 'bg-ink-950 text-gold-400' : status === 'complete' ? 'bg-gold-400 text-ink-950' : 'bg-white/15 text-white/55'
                    }`}
                  >
                    {status === 'complete' ? (
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-current" />
                    )}
                  </span>
                  {s.label}
                </button>
              );
            })}
          </nav>

          <main className="relative z-10 mx-auto w-full max-w-md flex-1 space-y-6 px-5 py-6 pb-32">
            <AnimatePresence mode="wait">
              <motion.section
                key={activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {activeSection === 'photos' && (
                  <PhotosSection
                    draft={draft}
                    onUpload={handlePhotoUpload}
                    onDelete={handleDeletePhoto}
                    onMakePrimary={handleMakePrimary}
                    onDragStart={onPhotoDragStart}
                    onDragMove={onPhotoDragMove}
                    onDragEnd={onPhotoDragEnd}
                    fileInputRef={fileInputRef}
                    onSaved={() => flashSaved('photos')}
                    saved={savedSection === 'photos'}
                  />
                )}
                {activeSection === 'basics' && (
                  <BasicsSection
                    draft={draft}
                    onChange={(patch) => updateDraft(patch)}
                    onSave={saveBasics}
                    saving={savingSection === 'basics'}
                    saved={savedSection === 'basics'}
                  />
                )}
                {activeSection === 'about' && (
                  <AboutSection
                    draft={draft}
                    onChange={(patch) => updateDraft(patch)}
                    onSave={saveAbout}
                    saving={savingSection === 'about'}
                    saved={savedSection === 'about'}
                  />
                )}
                {activeSection === 'prompts' && (
                  <PromptsSection
                    draft={draft}
                    onAdd={handleAddPrompt}
                    onUpdate={handleUpdatePrompt}
                    onDelete={handleDeletePrompt}
                    onDragStart={onPromptDragStart}
                    onDragMove={onPromptDragMove}
                    onDragEnd={onPromptDragEnd}
                    saved={savedSection === 'prompts'}
                  />
                )}
                {activeSection === 'interests' && (
                  <InterestsSection
                    draft={draft}
                    onToggleCurated={toggleCuratedInterest}
                    onAddCustom={addCustomInterest}
                    onRemoveCustom={removeCustomInterest}
                    onSave={saveInterests}
                    saving={savingSection === 'interests'}
                    saved={savedSection === 'interests'}
                  />
                )}
              </motion.section>
            </AnimatePresence>
          </main>
        </>
      )}
    </div>
  );
}

// Sub-sections -------------------------------------------------------------

function SectionHeader({
  title,
  description,
  saved,
  saving,
  onSave,
  showSave,
}: {
  title: string;
  description: string;
  saved: boolean;
  saving: boolean;
  onSave?: () => void;
  showSave?: boolean;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="mt-1 text-xs text-white/55">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {saved && (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Saved
          </span>
        )}
        {showSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full border border-gold-400/40 bg-gold-400/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-200 transition hover:bg-gold-400/25 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}

function PhotosSection({
  draft,
  onUpload,
  onDelete,
  onMakePrimary,
  onDragStart,
  onDragMove,
  onDragEnd,
  fileInputRef,
  onSaved,
  saved,
}: {
  draft: Draft;
  onUpload: (file: File, replacingId?: string) => Promise<void> | void;
  onDelete: (id: string) => void;
  onMakePrimary: (id: string) => void;
  onDragStart: (id: string, event: React.PointerEvent<HTMLLIElement>) => void;
  onDragMove: (event: React.PointerEvent<HTMLLIElement>) => void;
  onDragEnd: (event: React.PointerEvent<HTMLLIElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onSaved: () => void;
  saved: boolean;
}) {
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const photoGuidance = useMemo(() => {
    if (draft.photos.length === 0) {
      return 'Add at least 3 photos — portrait orientation works best.';
    }
    return `${draft.photos.length} photo${draft.photos.length === 1 ? '' : 's'}. Drag to reorder. Tap a photo to set it as your primary.`;
  }, [draft.photos.length]);

  return (
    <div>
      <SectionHeader
        title="Your photos"
        description={photoGuidance}
        saved={saved}
        saving={false}
        showSave={false}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            Promise.resolve(onUpload(file, replacingId ?? undefined)).then(() => {
              setReplacingId(null);
              onSaved();
            });
          }
          event.target.value = '';
        }}
      />
      <ul className="space-y-3">
        {draft.photos.map((photo) => (
          <li
            key={photo.id}
            onPointerDown={(event) => onDragStart(photo.id, event)}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="touch-none rounded-2xl border border-white/10 bg-ink-900/55 p-3"
          >
            <div className="flex items-center gap-3">
              <img
                src={photo.thumbnailUrl ?? photo.url}
                alt=""
                className="h-20 w-16 flex-none rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">
                    Photo {photo.position + 1}
                    {photo.isPrimary && (
                      <span className="ml-2 rounded-full bg-gold-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-950">
                        Primary
                      </span>
                    )}
                  </p>
                </div>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/35">
                  {photo.aspectRatio ? `${photo.aspectRatio.toFixed(2)}:1 · ` : ''}
                  {photo.width && photo.height ? `${photo.width}×${photo.height}` : 'Uploading…'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!photo.isPrimary && (
                    <button
                      type="button"
                      onClick={() => onMakePrimary(photo.id)}
                      className="rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gold-200 hover:bg-gold-400/20"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReplacingId(photo.id);
                      fileInputRef.current?.click();
                    }}
                    className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65 hover:border-gold-400/40 hover:text-gold-200"
                  >
                    Replace
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(photo.id)}
                aria-label="Delete photo"
                className="rounded-full border border-red-400/30 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-red-300 hover:bg-red-500/10"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {draft.photos.length < 6 && (
        <button
          type="button"
          onClick={() => {
            setReplacingId(null);
            fileInputRef.current?.click();
          }}
          className="mt-4 flex w-full items-center justify-center rounded-2xl border border-dashed border-gold-400/40 bg-gold-400/[0.04] py-4 text-xs uppercase tracking-[0.18em] text-gold-200 transition hover:bg-gold-400/10"
        >
          + {draft.photos.length === 0 ? 'Add your first photo' : 'Add another photo'}
        </button>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-white/45">
        Portrait orientation reads best on mobile. We resize anything over 1600×2000 so it loads fast.
      </p>
    </div>
  );
}

function BasicsSection({
  draft,
  onChange,
  onSave,
  saving,
  saved,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <div>
      <SectionHeader
        title="Basics"
        description="Your name and how you identify."
        saved={saved}
        saving={saving}
        onSave={onSave}
        showSave
      />
      <div className="space-y-4 rounded-2xl border border-white/10 bg-ink-900/45 p-4">
        <Field label="Display name" hint="Shown on your profile.">
          <input
            value={draft.displayName}
            onChange={(event) => onChange({ displayName: event.target.value })}
            onBlur={onSave}
            maxLength={40}
            placeholder="How you'll appear"
            className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="City">
          <input
            value={draft.city}
            onChange={(event) => onChange({ city: event.target.value })}
            onBlur={onSave}
            maxLength={80}
            placeholder="e.g. New York"
            className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Occupation">
          <input
            value={draft.occupation}
            onChange={(event) => onChange({ occupation: event.target.value })}
            onBlur={onSave}
            maxLength={80}
            placeholder="What you do"
            className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Height (cm)">
          <input
            value={draft.heightCm}
            onChange={(event) => onChange({ heightCm: event.target.value })}
            onBlur={onSave}
            type="number"
            min={120}
            max={230}
            placeholder="e.g. 175"
            className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="I am">
          <div className="grid grid-cols-2 gap-2">
            {(['WOMAN', 'MAN', 'NONBINARY', 'PREFER_NOT_TO_SAY'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  onChange({ gender: g });
                  window.setTimeout(onSave, 0);
                }}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  draft.gender === g
                    ? 'border-gold-400 bg-gold-400/15 text-gold-100'
                    : 'border-white/10 bg-ink-800/60 text-white/80'
                }`}
              >
                {g === 'WOMAN' ? 'Woman' : g === 'MAN' ? 'Man' : g === 'NONBINARY' ? 'Non-binary' : 'Prefer not to say'}
              </button>
            ))}
          </div>
        </Field>
        <Field label="I want to meet">
          <div className="grid grid-cols-3 gap-2">
            {(['WOMEN', 'MEN', 'EVERYONE'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  onChange({ lookingFor: l });
                  window.setTimeout(onSave, 0);
                }}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  draft.lookingFor === l
                    ? 'border-gold-400 bg-gold-400/15 text-gold-100'
                    : 'border-white/10 bg-ink-800/60 text-white/80'
                }`}
              >
                {l === 'WOMEN' ? 'Women' : l === 'MEN' ? 'Men' : 'Everyone'}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

function AboutSection({
  draft,
  onChange,
  onSave,
  saving,
  saved,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const remaining = BIO_MAX - draft.bio.length;
  return (
    <div>
      <SectionHeader
        title="About you"
        description="Two or three sentences is the sweet spot."
        saved={saved}
        saving={saving}
        onSave={onSave}
        showSave
      />
      <textarea
        value={draft.bio}
        onChange={(event) => onChange({ bio: event.target.value.slice(0, BIO_MAX) })}
        onBlur={onSave}
        maxLength={BIO_MAX}
        rows={5}
        placeholder="What makes you memorable?"
        className="input-luxe w-full resize-none rounded-2xl border border-white/10 bg-ink-900/55 px-4 py-3 text-sm leading-relaxed"
      />
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-white/45">Saved automatically when you leave the field.</span>
        <span className={remaining < 50 ? 'text-amber-300' : 'text-white/40'}>{remaining} left</span>
      </div>
    </div>
  );
}

function PromptsSection({
  draft,
  onAdd,
  onUpdate,
  onDelete,
  onDragStart,
  onDragMove,
  onDragEnd,
  saved,
}: {
  draft: Draft;
  onAdd: (question: string, answer: string) => Promise<void> | void;
  onUpdate: (id: string, patch: { question?: string; answer?: string }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onDragStart: (id: string, event: React.PointerEvent<HTMLLIElement>) => void;
  onDragMove: (event: React.PointerEvent<HTMLLIElement>) => void;
  onDragEnd: (event: React.PointerEvent<HTMLLIElement>) => void;
  saved: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState(PROMPT_QUESTIONS[0]!);
  const [newAnswer, setNewAnswer] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState('');

  function startEdit(prompt: Prompt) {
    setEditingId(prompt.id);
    setDraftAnswer(prompt.answer);
  }
  function cancelEdit() {
    setEditingId(null);
    setDraftAnswer('');
  }
  async function commitEdit(id: string) {
    if (draftAnswer.trim().length === 0) return;
    await onUpdate(id, { answer: draftAnswer.trim().slice(0, PROMPT_ANSWER_MAX) });
    cancelEdit();
  }

  return (
    <div>
      <SectionHeader
        title="Prompts"
        description={`Add up to 3 conversation starters. ${draft.prompts.length}/3 added.`}
        saved={saved}
        saving={false}
        showSave={false}
      />

      <ul className="space-y-3">
        {draft.prompts.map((p) => (
          <li
            key={p.id}
            onPointerDown={(event) => onDragStart(p.id, event)}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="touch-none rounded-2xl border border-white/10 bg-ink-900/55 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-300">{p.question}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="text-[10px] uppercase tracking-[0.18em] text-white/55 hover:text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Delete this prompt?')) void onDelete(p.id);
                  }}
                  className="text-[10px] uppercase tracking-[0.18em] text-red-300 hover:text-red-200"
                >
                  Remove
                </button>
              </div>
            </div>
            {editingId === p.id ? (
              <div className="mt-2">
                <textarea
                  value={draftAnswer}
                  onChange={(event) => setDraftAnswer(event.target.value.slice(0, PROMPT_ANSWER_MAX))}
                  rows={3}
                  className="input-luxe w-full resize-none rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={cancelEdit} className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void commitEdit(p.id)}
                    className="rounded-full bg-gold-400 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-950"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm leading-snug text-white/90">{p.answer}</p>
            )}
          </li>
        ))}
      </ul>

      {draft.prompts.length < 3 && (
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="mt-4 flex w-full items-center justify-center rounded-2xl border border-dashed border-gold-400/40 bg-gold-400/[0.04] py-3 text-xs uppercase tracking-[0.18em] text-gold-200 hover:bg-gold-400/10"
        >
          {showForm ? 'Cancel' : '+ Add prompt'}
        </button>
      )}

      {showForm && (
        <div className="mt-3 space-y-2 rounded-2xl border border-gold-400/25 bg-ink-900/55 p-4">
          <select
            value={newQuestion}
            onChange={(event) => setNewQuestion(event.target.value)}
            className="input-luxe w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
          >
            {PROMPT_QUESTIONS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
          <textarea
            value={newAnswer}
            onChange={(event) => setNewAnswer(event.target.value.slice(0, PROMPT_ANSWER_MAX))}
            rows={3}
            maxLength={PROMPT_ANSWER_MAX}
            placeholder={`Your answer (${PROMPT_ANSWER_MAX} chars max)`}
            className="input-luxe w-full resize-none rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setNewAnswer('');
                setShowForm(false);
              }}
              className="text-[10px] uppercase tracking-[0.18em] text-white/55"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!newAnswer.trim()) return;
                Promise.resolve(onAdd(newQuestion, newAnswer.trim())).then(() => {
                  setNewAnswer('');
                  setShowForm(false);
                });
              }}
              className="rounded-full bg-gold-400 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-950 disabled:opacity-40"
              disabled={!newAnswer.trim()}
            >
              Add prompt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InterestsSection({
  draft,
  onToggleCurated,
  onAddCustom,
  onRemoveCustom,
  onSave,
  saving,
  saved,
}: {
  draft: Draft;
  onToggleCurated: (slug: string) => void;
  onAddCustom: (label: string) => void;
  onRemoveCustom: (label: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const [customInput, setCustomInput] = useState('');
  return (
    <div>
      <SectionHeader
        title="Interests"
        description="Pick 3-8 curated tags. Add up to 3 of your own."
        saved={saved}
        saving={saving}
        onSave={onSave}
        showSave
      />
      <div className="rounded-2xl border border-white/10 bg-ink-900/45 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-300">Curated</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((label) => {
            const slug = label.toLowerCase();
            const active = draft.curatedInterests.includes(slug);
            return (
              <Tag
                key={slug}
                label={label}
                active={active}
                size="sm"
                onClick={() => onToggleCurated(slug)}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-ink-900/45 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-300">
            Your own
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            {draft.customInterests.length}/{MAX_CUSTOM_INTERESTS}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {draft.customInterests.map((label) => (
            <Tag
              key={label}
              label={label}
              size="sm"
              className="border-gold-400/40 bg-gold-400/10 text-gold-100"
              onRemove={() => onRemoveCustom(label)}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={customInput}
            onChange={(event) => setCustomInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && customInput.trim()) {
                event.preventDefault();
                onAddCustom(customInput);
                setCustomInput('');
              }
            }}
            maxLength={CUSTOM_INTEREST_MAX}
            placeholder="Add your own (e.g. jazz piano, ramen)"
            className="input-luxe flex-1 rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!customInput.trim()) return;
              onAddCustom(customInput);
              setCustomInput('');
            }}
            disabled={!customInput.trim() || draft.customInterests.length >= MAX_CUSTOM_INTERESTS}
            className="rounded-full border border-gold-400/40 bg-gold-400/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-200 transition hover:bg-gold-400/25 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-luxe mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-white/40">{hint}</span>}
    </label>
  );
}

// Preview frame ------------------------------------------------------------

function PreviewFrame({ draft, onExit }: { draft: Draft; onExit: () => void }) {
  const navigate = useNavigate();
  return (
    <main className="relative z-10 mx-auto w-full max-w-md flex-1 space-y-6 px-5 py-6 pb-32">
      <div className="rounded-3xl border border-gold-400/35 bg-gold-400/[0.06] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-300">Preview mode</p>
        <p className="mt-1 text-xs text-white/65">
          This is how your profile looks right now. Changes aren’t visible to others until you save.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onExit}
            className="flex-1 rounded-full border border-gold-400/40 bg-gold-400/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-200 hover:bg-gold-400/25"
          >
            Back to edit
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex-1 rounded-full bg-gold-400 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-950"
          >
            View saved
          </button>
        </div>
      </div>
      <section className="aspect-[3/4] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black/45">
        {draft.photos[0] ? (
          <img src={draft.photos[0].url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/55">
            Add a photo to preview your hero.
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <p className="display-heading text-3xl font-light text-white drop-shadow">
            {draft.displayName || 'Your name'}{' '}
            {draft.birthDate ? (
              <span className="text-xl text-white/75">
                {new Date().getFullYear() - new Date(draft.birthDate).getUTCFullYear()}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-white/80 drop-shadow">
            {[draft.occupation, draft.city].filter(Boolean).join(' · ') || 'Add your basics'}
          </p>
        </div>
      </section>
      {draft.bio && (
        <section className="rounded-3xl border border-white/10 bg-ink-900/55 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-300">About</p>
          <p className="mt-2 text-[15px] leading-relaxed text-white/90">{draft.bio}</p>
        </section>
      )}
      {draft.prompts[0] && (
        <section className="rounded-3xl border border-gold-400/30 bg-ink-900/55 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-300">
            {draft.prompts[0].question}
          </p>
          <p className="mt-2 font-display text-[17px] leading-snug text-white">
            {draft.prompts[0].answer}
          </p>
        </section>
      )}
    </main>
  );
}
