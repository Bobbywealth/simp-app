import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { SkeletonScreen } from './Skeleton';

export function ProtectedRoute({
  children,
  requireOnboarding = false,
}: {
  children: ReactNode;
  requireOnboarding?: boolean;
}) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <SkeletonScreen label="Loading" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.emailVerified && location.pathname !== '/verify-email-pending') {
    return <Navigate to="/verify-email-pending" replace />;
  }
  if (requireOnboarding && !user.onboardingCompletedAt) {
    return <Navigate to="/profile-setup" replace />;
  }
  return <>{children}</>;
}
