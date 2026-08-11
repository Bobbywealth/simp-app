export type Gender = 'WOMAN' | 'MAN' | 'NONBINARY' | 'PREFER_NOT_TO_SAY';
export type LookingFor = 'WOMEN' | 'MEN' | 'EVERYONE';
export type SwipeAction = 'PASS' | 'LIKE' | 'SUPERLIKE';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  profile: Profile | null;
}

export interface Profile {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  birthDate: string;
  gender: Gender;
  lookingFor: LookingFor;
  city: string | null;
  occupation: string | null;
  heightCm: number | null;
  isVerified: boolean;
  isPremium: boolean;
  interests: { interest: { id: string; slug: string; label: string } }[];
}

export interface Interest {
  id: string;
  slug: string;
  label: string;
}

// Discovery / Swipe / Match types

export interface DiscoveryPhoto {
  id: string;
  url: string;
  position: number;
}

export interface DiscoveryPrompt {
  id: string;
  question: string;
  answer: string;
}

export interface DiscoveryProfile {
  profileId: string;
  userId: string;
  displayName: string;
  bio: string | null;
  age: number;
  gender: Gender;
  city: string | null;
  occupation: string | null;
  heightCm: number | null;
  isVerified: boolean;
  isPremium: boolean;
  photos: DiscoveryPhoto[];
  prompts: DiscoveryPrompt[];
  interests: { slug: string; label: string }[];
}

export interface SwipeResult {
  swipeId: string;
  matched: boolean;
  matchId?: string;
}

export interface MatchSummary {
  matchId: string;
  matchedAt: string;
  otherUser: {
    userId: string;
    profileId: string;
    displayName: string;
    age: number;
    city: string | null;
    occupation: string | null;
    isVerified: boolean;
    isPremium: boolean;
    photoUrl: string | null;
  };
  noteFromOther: string | null;
}

export interface MatchDetail {
  matchId: string;
  matchedAt: string;
  lastMessageAt: string | null;
  otherUser: DiscoveryProfile;
  myNote: string | null;
  theirNote: string | null;
}

export interface ReceivedNote {
  swipeId: string;
  fromUserId: string;
  fromName: string;
  fromPhotoUrl: string | null;
  note: string;
  createdAt: string;
}
