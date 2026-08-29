import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Discover from '../Discover';
import * as discovery from '../../api/discovery';
import * as users from '../../api/users';
import * as auth from '../../store/auth';

vi.mock('../../api/discovery');
vi.mock('../../api/swipes');
vi.mock('../../api/moderation');
vi.mock('../../api/users');
vi.mock('../../api/analytics', () => ({
  track: vi.fn(),
  trackMilestone: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockProfiles = [
  {
    profileId: '1',
    userId: 'user-1',
    displayName: 'Alice',
    bio: 'Test bio',
    age: 28,
    gender: 'WOMAN' as const,
    city: 'New York',
    occupation: 'Designer',
    heightCm: 170,
    isVerified: true,
    verificationStatus: 'APPROVED' as const,
    isPremium: false,
    distanceKm: 5,
    photos: [{ id: 'p1', url: 'https://example.com/photo1.jpg', thumbnailUrl: 'https://example.com/photo1_thumb.jpg', position: 0 }],
    prompts: [],
    interests: [{ slug: 'music', label: 'Music' }],
  },
];

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  photos: [],
  entitlement: { tier: 'FREE' as const, status: 'ACTIVE' as const },
};

const mockFilters = {
  minAge: 18,
  maxAge: 99,
  maxDistanceKm: null,
  verifiedOnly: false,
  interestSlugs: [],
};

describe('Discover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(discovery.getDiscovery).mockResolvedValue({
      profiles: mockProfiles,
      nextCursor: 'cursor-1',
      hasMore: true,
    });
    vi.mocked(users.getDiscoveryPreferences).mockResolvedValue(mockFilters);
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      user: mockUser,
      setUser: vi.fn(),
      initialize: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
      loading: false,
      ready: true,
      initialized: true,
    });
  });

  it('renders Discover page', () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>
    );
    expect(screen.queryByRole('main')).toBeInTheDocument();
  });
});