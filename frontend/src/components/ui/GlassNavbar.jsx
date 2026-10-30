import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Archive, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { GlassButton } from './GlassButton';

const navClass = ({ isActive }) =>
  `rounded-full px-3 py-2 text-sm font-medium transition hover:bg-primary/soft ${isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`;

export function GlassNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const toast = useToast();

  async function handleSignOut() {
    try {
      await signOut();
      setMenuOpen(false);
      navigate('/login');
    } catch (error) {
      toast(error.message || 'You could not be signed out.', 'error');
    }
  }

  return (
    <header className="glass-navbar sticky top-0 z-40">
      <nav className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8" aria-label="Main navigation">
        <Link to={user ? '/dashboard' : '/login'} className="flex min-w-0 items-center gap-2.5 rounded-lg text-foreground">
          <span className="logo-mark grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary shadow-sm">
            <Archive className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-heading text-2xl font-semibold leading-none">WarrantyVault</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {user ? (
            <>
              <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
              <NavLink to="/household" className={navClass}>Household</NavLink>
              <GlassButton as={Link} to="/items/new" className="ml-2 min-h-10 px-4 py-2">Add item</GlassButton>
              <button
                type="button"
                onClick={handleSignOut}
                className="ml-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-primary/soft hover:text-foreground"
              >
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login" className={navClass}>Sign in</NavLink>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full p-2.5 text-muted-foreground transition hover:bg-primary/soft hover:text-foreground"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full p-2.5 text-muted-foreground hover:bg-primary/soft"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="rounded-full p-2.5 text-foreground hover:bg-primary/soft"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="mx-3 mb-3 grid gap-2 rounded-2xl border border-border bg-card p-3 shadow-lg md:hidden">
          {user ? (
            <>
              <NavLink onClick={() => setMenuOpen(false)} to="/dashboard" className={navClass}>Dashboard</NavLink>
              <NavLink onClick={() => setMenuOpen(false)} to="/household" className={navClass}>Household</NavLink>
              <NavLink onClick={() => setMenuOpen(false)} to="/items/new" className={navClass}>Add item</NavLink>
              <GlassButton variant="ghost" className="justify-start" onClick={handleSignOut}>Sign out</GlassButton>
            </>
          ) : (
            <NavLink onClick={() => setMenuOpen(false)} to="/login" className={navClass}>Sign in</NavLink>
          )}
        </div>
      )}
    </header>
  );
}
