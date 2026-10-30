import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  safelist: ['status-active', 'status-expiring', 'status-expired', 'text-on-accent', 'text-on-destructive'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
        'on-primary': 'var(--color-on-primary)',
        secondary: 'rgb(var(--color-secondary-rgb) / <alpha-value>)',
        'on-secondary': 'var(--color-on-secondary)',
        accent: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
        'on-accent': 'var(--color-on-accent)',
        background: 'rgb(var(--color-background-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground-rgb) / <alpha-value>)',
        muted: 'rgb(var(--color-muted-rgb) / <alpha-value>)',
        'muted-foreground': 'var(--color-muted-foreground)',
        border: 'rgb(var(--color-border-rgb) / <alpha-value>)',
        destructive: 'rgb(var(--color-destructive-rgb) / <alpha-value>)',
        'on-destructive': 'var(--color-on-destructive)',
        'surface-tint': 'var(--surface-tint)',
        'accent-tint': 'var(--accent-tint)',
        'status-active': 'var(--status-active-text)',
        'status-expiring': 'var(--status-expiring-text)',
        'status-expired': 'var(--status-expired-text)',
      },
      fontFamily: {
        heading: ['Cormorant', 'Georgia', 'serif'],
        sans: ['Montserrat', 'sans-serif'],
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
      },
      borderRadius: {
        glass: 'var(--radius-card)',
        modal: 'var(--radius-modal)',
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
        'glass-highlight': 'var(--glass-highlight)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      backgroundColor: {
        'glass': 'var(--glass-bg)',
        'status-active': 'var(--status-active-bg)',
        'status-expiring': 'var(--status-expiring-bg)',
        'status-expired': 'var(--status-expired-bg)',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
      },
      transitionDuration: {
        glass: 'var(--motion-duration)',
      },
      opacity: {
        soft: 'var(--opacity-soft)',
        tint: 'var(--opacity-tint)',
        status: 'var(--opacity-status)',
        alert: 'var(--opacity-alert)',
        border: 'var(--opacity-border)',
        strong: 'var(--opacity-strong)',
        overlay: 'var(--opacity-overlay)',
        highlight: 'var(--opacity-highlight)',
        half: 'var(--opacity-half)',
      },
    },
  },
  plugins: [],
};

export default config;
