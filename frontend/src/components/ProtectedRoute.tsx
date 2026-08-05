import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-950">
        <div className="size-10 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}
