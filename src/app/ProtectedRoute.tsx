import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { copy } from '@/lib/copy';
import { useAuth } from './auth-context';

export function ProtectedRoute() {
  const { isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="auth-loading" aria-label={copy.loadingAccount}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full max-w-md" />
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
