import './styles/index.css';

import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/app/ThemeProvider';
import { App } from '@/app/App';
import { Toaster } from '@/components/ui/sonner';
import { copy } from '@/lib/copy';

const AuthProvider = lazy(() => import('@/app/AuthProvider').then((module) => ({
  default: module.AuthProvider,
})));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<main className="auth-loading">{copy.loadingAccount}</main>}>
          <AuthProvider>
            <App />
            <Toaster />
          </AuthProvider>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
