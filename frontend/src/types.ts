export type Gender = 'WOMAN' | 'MAN' | 'NONBINARY' | 'PREFER_NOT_TO_SAY';
export type LookingFor = 'WOMEN' | 'MEN' | 'EVERYONE';
export type SwipeAction = 'PASS' | 'LIKE' | 'SUPERLIKE';
export type VerificationStatus = 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type EntitlementTier = 'FREE' | 'SIMP_PLUS' | 'SIMP_ELITE';

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
  onboardingStep: number;
  onboardingState: Record<string, unknown> | null;
  onboardingCompletedAt: string | null;
  entitlement: {
    tier: EntitlementTier;
    status: 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'REVOKED';
    expiresAt: string | null;
  };
  profile: Profile | null;
}

export interface ProfileCompletion {
  complete: boolean;
  percent: number;
  missing: string[];
  photoCount: number;
  interestCount: number;
  promptCount: number;
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
  verificationStatus: VerificationStatus;
  profileCompletedAt: string | null;
  isPremium: boolean;
  interests: { interest: Interest }[];
  completion?: ProfileCompletion;
  user?: {
    id: string;
    email: string;
    photos: DiscoveryPhoto[];
    prompts: DiscoveryPrompt[];
  };
}

export interface Interest {
  id: string;
  slug: string;
  label: string;
}

export interface DiscoveryPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  position: number;
  isPrimary?: boolean;
  width?: number | null;
  height?: number | null;
}

export interface DiscoveryPrompt {
  id: string;
  question: string;
  answer: string;
  position?: number;
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
  verificationStatus?: VerificationStatus;
  isPremium: boolean;
  distanceKm?: number | null;
  photos: DiscoveryPhoto[];
  prompts: DiscoveryPrompt[];
  interests: { slug: string; label: string }[];
}

export interface SwipeResult {
  swipeId: string;
  matched: boolean;
  matchId?: string;
  alreadySwiped?: boolean;
  matchedUser?: {
    displayName: string;
    photoUrl: string | null;
    myPhotoUrl: string | null;
  } | null;
}

export interface DiscoveryResponse {
  profiles: DiscoveryProfile[];
  nextCursor: string | null;
  hasMore: boolean;
  filters?: DiscoveryPreferences;
}

export interface DiscoveryPreferences {
  minAge: number;
  maxAge: number;
  maxDistanceKm: number | null;
  verifiedOnly: boolean;
  interestSlugs: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  clientId: string | null;
  body: string;
  messageType: 'TEXT' | 'SYSTEM';
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  deletedAt: string | null;
}

export interface MatchSummary {
  matchId: string;
  conversationId: string | null;
  matchedAt: string;
  lastMessageAt: string | null;
  otherUser: {
    userId: string;
    profileId: string;
    displayName: string;
    age: number;
    city: string | null;
    occupation: string | null;
    isVerified: boolean;
    isPremium?: boolean;
    photoUrl: string | null;
    thumbnailUrl?: string | null;
  };
  noteFromOther: string | null;
  latestMessage?: Message | null;
  unreadCount?: number;
}

export interface MatchDetail {
  matchId: string;
  conversationId: string | null;
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

export interface ConversationSummary {
  id: string;
  matchId: string;
  updatedAt: string;
  otherUser: {
    userId: string;
    displayName: string;
    photoUrl: string | null;
    thumbnailUrl: string | null;
    isVerified: boolean;
  };
  latestMessage: Message | null;
  unreadCount: number;
}

export interface ConversationDetail {
  id: string;
  matchId: string;
  otherUser: {
    userId: string;
    displayName: string;
    photoUrl: string | null;
    thumbnailUrl: string | null;
  };
}

export interface InAppNotification {
  id: string;
  type: 'MATCH' | 'MESSAGE' | 'LIKE' | 'SYSTEM' | 'LIVE' | 'SECURITY';
  entityId: string | null;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
