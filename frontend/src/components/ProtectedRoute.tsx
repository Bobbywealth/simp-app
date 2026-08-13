import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { SkeletonScreen } from './Skeleton';

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { user, ready } = useAuth();
  if (!ready) {
    return <SkeletonScreen label="Loading" />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
