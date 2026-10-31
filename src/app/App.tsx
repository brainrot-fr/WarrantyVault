import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { Button } from '@/components/ui/button';
import { ProtectedRoute } from './ProtectedRoute';
import { copy } from '@/lib/copy';


const DesignShowcase = lazy(() => import('@/routes/DesignShowcase').then((module) => ({
  default: module.DesignShowcase,
})));
const AuthPage = lazy(() => import('@/features/auth/AuthPage').then((module) => ({
  default: module.AuthPage,
})));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage').then((module) => ({
  default: module.ResetPasswordPage,
})));
const AppShell = lazy(() => import('@/app/AppShell').then((module) => ({
  default: module.AppShell,
})));
const ItemsPage = lazy(() => import('@/features/items/ItemsPage').then((module) => ({
  default: module.ItemsPage,
})));
const AddItemPage = lazy(() => import('@/features/items/AddItemPage').then((module) => ({
  default: module.AddItemPage,
})));
const HouseholdPage = lazy(() => import('@/features/households/HouseholdPage').then((module) => ({
  default: module.HouseholdPage,
})));
const InvitesPage = lazy(() => import('@/features/households/InvitesPage').then((module) => ({
  default: module.InvitesPage,
})));
const SettingsPage = lazy(() => import('./SettingsPage').then((module) => ({
  default: module.SettingsPage,
})));

function RouteLoading() {
  return <main className="auth-loading">{copy.loadingAccount}</main>;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The application encountered an unexpected error.', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="page-shell app-error-page">
          <h1>{copy.appErrorTitle}</h1>
          <p>{copy.appErrorDescription}</p>
          <Button type="button" onClick={() => window.location.assign('/')}>{copy.returnHome}</Button>
        </main>
      );
    }

    return this.props.children;
  }
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <main className="page-shell app-error-page">
      <h1>{copy.notFoundTitle}</h1>
      <p>{copy.notFoundBody}</p>
      <Button type="button" onClick={() => navigate('/')}>{copy.returnHome}</Button>
    </main>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <Routes>
          <Route path="/login" element={<Suspense fallback={<RouteLoading />}><AuthPage /></Suspense>} />
          <Route path="/auth/reset" element={<Suspense fallback={<RouteLoading />}><ResetPasswordPage /></Suspense>} />
          {import.meta.env.DEV && (
            <Route
              path="/design"
              element={(
                <Suspense fallback={<RouteLoading />}>
                  <DesignShowcase />
                </Suspense>
              )}
            />
          )}
          <Route element={<ProtectedRoute />}>
            <Route element={<Suspense fallback={<RouteLoading />}><AppShell /></Suspense>}>
              <Route index element={<Suspense fallback={<RouteLoading />}><ItemsPage /></Suspense>} />
              <Route path="items/new" element={<Suspense fallback={<RouteLoading />}><AddItemPage /></Suspense>} />
              <Route path="items/:itemId" element={<Suspense fallback={<RouteLoading />}><ItemsPage /></Suspense>} />
              <Route path="household" element={<Suspense fallback={<RouteLoading />}><HouseholdPage /></Suspense>} />
              <Route path="invites" element={<Suspense fallback={<RouteLoading />}><InvitesPage /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<RouteLoading />}><SettingsPage /></Suspense>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}
