import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProfileEdit from '../ProfileEdit';
import * as users from '../../api/users';
import * as photos from '../../api/photos';
import * as prompts from '../../api/prompts';

vi.mock('../../api/users');
vi.mock('../../api/photos');
vi.mock('../../api/prompts');
vi.mock('../../store/auth', () => ({
  useAuth: () => ({ refresh: vi.fn() }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const catalog = [
  { id: 'i1', slug: 'cooking', label: 'Cooking' },
  { id: 'i2', slug: 'coding', label: 'Coding' },
  { id: 'i3', slug: 'jazz', label: 'Jazz' },
  { id: 'i4', slug: 'music', label: 'Music' },
  { id: 'i5', slug: 'farmers-markets', label: 'Farmers Markets' },
];

const mockPrompt = {
  id: 'pr1',
  userId: 'u1',
  question: 'My weakness is',
  answer: 'Anything handmade',
  position: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Photos carry no stored dimensions, which is what the demo seed produces.
const mockProfile = {
  id: 'p1',
  userId: 'u1',
  displayName: 'Kenji',
  bio: 'Software engineer.',
  birthDate: '1990-01-01',
  gender: 'MAN',
  lookingFor: 'EVERYONE',
  city: 'Brooklyn',
  occupation: 'Engineer',
  heightCm: 182,
  isVerified: true,
  verificationStatus: 'APPROVED',
  profileCompletedAt: null,
  interests: [
    { interest: { id: 'i2', slug: 'coding', label: 'Coding' } },
    { interest: { id: 'i3', slug: 'jazz', label: 'Jazz' } },
  ],
  customInterests: [],
  user: {
    id: 'u1',
    email: 'kenji@simp-seed.demo',
    photos: [
      {
        id: 'ph1',
        url: 'https://example.com/1.jpg',
        thumbnailUrl: 'https://example.com/1t.jpg',
        position: 0,
        isPrimary: true,
        width: null,
        height: null,
      },
      {
        id: 'ph2',
        url: 'https://example.com/2.jpg',
        thumbnailUrl: 'https://example.com/2t.jpg',
        position: 1,
        isPrimary: false,
        width: null,
        height: null,
      },
    ],
    prompts: [mockPrompt],
  },
};

let captureSpy: ReturnType<typeof vi.fn>;

beforeAll(() => {
  captureSpy = vi.fn();
  // jsdom has no pointer capture, so stub it and observe the calls. A drag
  // that captures the pointer retargets the following click to the row and
  // silently swallows every button click inside it.
  (Element.prototype as unknown as { setPointerCapture: unknown }).setPointerCapture = captureSpy;
  (Element.prototype as unknown as { releasePointerCapture: unknown }).releasePointerCapture = vi.fn();
  (Element.prototype as unknown as { hasPointerCapture: unknown }).hasPointerCapture = () => true;
});

function renderEditor() {
  return render(
    <BrowserRouter>
      <ProfileEdit />
    </BrowserRouter>,
  );
}

describe('ProfileEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captureSpy.mockClear();
    vi.mocked(users.getMyProfile).mockResolvedValue(mockProfile as never);
    vi.mocked(users.listInterests).mockResolvedValue(catalog as never);
    vi.mocked(users.patchMyProfile).mockResolvedValue(mockProfile as never);
    vi.mocked(prompts.listMyPrompts).mockResolvedValue({ prompts: [mockPrompt] } as never);
    vi.mocked(prompts.updatePrompt).mockResolvedValue(mockPrompt as never);
    vi.mocked(prompts.deletePrompt).mockResolvedValue({ ok: true } as never);
    vi.mocked(prompts.reorderPrompts).mockResolvedValue({ prompts: [] } as never);
    vi.mocked(photos.setPrimaryPhoto).mockResolvedValue({ ok: true } as never);
    vi.mocked(photos.deletePhoto).mockResolvedValue({ ok: true } as never);
    vi.mocked(photos.reorderPhotos).mockResolvedValue({ photos: [] } as never);
  });

  it('shows an already-uploaded photo as Uploaded, never as Uploading', async () => {
    renderEditor();
    await screen.findByText('Your photos');
    await waitFor(() => expect(screen.getAllByText('Uploaded')).toHaveLength(2));
    expect(screen.queryByText('Uploading…')).not.toBeInTheDocument();
  });

  it('does not start a drag from a photo control, so the control keeps its click', async () => {
    renderEditor();
    await screen.findByText('Your photos');
    const makePrimary = await screen.findByRole('button', { name: 'Make primary' });

    fireEvent.pointerDown(makePrimary, { pointerId: 1 });
    expect(captureSpy).not.toHaveBeenCalled();

    fireEvent.click(makePrimary);
    await waitFor(() => expect(photos.setPrimaryPhoto).toHaveBeenCalledWith('ph2'));
  });

  it('still starts a drag when the pointer goes down on the photo row itself', async () => {
    renderEditor();
    await screen.findByText('Your photos');
    const makePrimary = await screen.findByRole('button', { name: 'Make primary' });
    const row = makePrimary.closest('li');
    expect(row).not.toBeNull();

    fireEvent.pointerDown(row as HTMLElement, { pointerId: 2 });
    expect(captureSpy).toHaveBeenCalled();
  });

  it('opens the prompt editor when Edit is clicked', async () => {
    renderEditor();
    await screen.findByText('Your photos');
    fireEvent.click(screen.getByRole('button', { name: 'Prompts' }));

    const edit = await screen.findByRole('button', { name: 'Edit' });
    fireEvent.pointerDown(edit, { pointerId: 3 });
    expect(captureSpy).not.toHaveBeenCalled();

    fireEvent.click(edit);
    await waitFor(() => expect(screen.getByDisplayValue('Anything handmade')).toBeInTheDocument());
  });

  it('offers the server interest catalog, including interests already on the profile', async () => {
    renderEditor();
    await screen.findByText('Your photos');
    fireEvent.click(screen.getByRole('button', { name: 'Interests' }));

    await waitFor(() => expect(screen.getByText('Coding')).toBeInTheDocument());
    expect(screen.getByText('Jazz')).toBeInTheDocument();
    // Hardcoded choices that are not in the backend catalog are gone.
    expect(screen.queryByText('Live Music')).not.toBeInTheDocument();
    expect(screen.queryByText('Sports')).not.toBeInTheDocument();
  });

  it('saves the catalog slug, not a slug derived from the label', async () => {
    renderEditor();
    await screen.findByText('Your photos');
    fireEvent.click(screen.getByRole('button', { name: 'Interests' }));

    const farmers = await screen.findByText('Farmers Markets');
    fireEvent.click(farmers);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(users.patchMyProfile).toHaveBeenCalled());
    const payload = vi.mocked(users.patchMyProfile).mock.calls[0]![0] as {
      interestSlugs?: string[];
    };
    // The catalog slug wins over label.toLowerCase(), which would send
    // "farmers markets" and create a duplicate interest row.
    expect(payload.interestSlugs).toContain('farmers-markets');
    expect(payload.interestSlugs).not.toContain('farmers markets');
    // Interests already on the profile survive the save.
    expect(payload.interestSlugs).toContain('coding');
    expect(payload.interestSlugs).toContain('jazz');
  });
});
