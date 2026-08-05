export type Gender = 'WOMAN' | 'MAN' | 'NONBINARY' | 'PREFER_NOT_TO_SAY';
export type LookingFor = 'WOMEN' | 'MEN' | 'EVERYONE';

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
