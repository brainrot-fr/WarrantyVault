import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { Archive, LoaderCircle } from 'lucide-react';
import { GlassNavbar } from './components/ui/GlassNavbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AcceptInvite } from './pages/AcceptInvite';
import { AddItem } from './pages/AddItem';
import { Dashboard } from './pages/Dashboard';
import { DesignShowcase } from './pages/DesignShowcase';
import { Household } from './pages/Household';
import { ItemDetails } from './pages/ItemDetails';
import { Login } from './pages/Login';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => error?.message !== 'Your session has expired. Please sign in again.' && failureCount < 1,
      refetchOnWindowFocus: true,
    },
  },
});

function RequireAuth({ children }) {
  const { loading, user } = useAuth();
  if (loading) {
    return (
      <main className="grid min-h-[70vh] place-items-center" role="status" aria-label="Loading your account">
        <LoaderCircle className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
      </main>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function AppLayout() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <span className="ambient-blob ambient-blob-gold" />
        <span className="ambient-blob ambient-blob-stone" />
        <span className="ambient-blob ambient-blob-gold-secondary" />
      </div>
      <GlassNavbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={<RequireAuth><Dashboard /></RequireAuth>}
        />
        <Route
          path="/items/new"
          element={<RequireAuth><AddItem /></RequireAuth>}
        />
        <Route
          path="/items/:id"
          element={<RequireAuth><ItemDetails /></RequireAuth>}
        />
        <Route
          path="/household"
          element={<RequireAuth><Household /></RequireAuth>}
        />
        <Route
          path="/accept-invite"
          element={<AcceptInvite />}
        />
        {import.meta.env.DEV && <Route path="/design" element={<DesignShowcase />} />}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 border-t border-primary/soft px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
        <Link to="/dashboard" className="inline-flex items-center gap-2 font-semibold text-foreground">
          <Archive className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> WarrantyVault
        </Link>
        <p>Keep what matters, covered.</p>
      </footer>
    </div>
  );
}

function NotFound() {
  return (
    <main className="page-shell grid min-h-[50vh] place-items-center text-center">
      <div>
        <p className="eyebrow justify-center">Page not found</p>
        <h1 className="mt-3 font-heading text-5xl font-semibold">That page isn’t in your vault.</h1>
        <Link to="/dashboard" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">Return to dashboard</Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AppLayout />
            </BrowserRouter>
          </QueryClientProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
