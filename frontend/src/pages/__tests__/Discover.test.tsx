import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Discover from '../Discover';
import * as experiences from '../../api/experiences';

vi.mock('../../api/experiences');

const base = {
  description: null,
  city: 'Newark',
  startsAt: '2030-01-05T23:30:00.000Z',
  priceCents: 4500,
  currency: 'USD',
  capacity: 6,
  imageUrl: null,
  status: 'OPEN' as const,
  approvedCount: 2,
  venue: 'Ironbound',
  logistics: null,
};

describe('Discover (experience-first)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(experiences.listExperiences).mockResolvedValue({
      experiences: [
        { ...base, id: 'e1', title: 'Rooftop Dinner', category: 'DINNER', host: { id: 'h1', displayName: 'Maya', photoUrl: null } },
      ],
      nextCursor: null,
      hasMore: false,
    });
  });

  it('leads with the experience and shows the host as secondary', async () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Rooftop Dinner' })).toBeInTheDocument();
    expect(screen.getByText(/Hosted by/)).toBeInTheDocument();
    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.getByText('4 spots left')).toBeInTheDocument();
  });
});
