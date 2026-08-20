import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import type { UserResponse } from '../types';
import { SkeletonScreen } from './Skeleton';

type ProtectedRouteProps = {
  children: ReactNode;
  requireOnboarding?: boolean;
  allowedRoles?: UserResponse['role'][];
};

export function ProtectedRoute({
  children,
  requireOnboarding = false,
  allowedRoles,
}: ProtectedRouteProps) {
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
  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
