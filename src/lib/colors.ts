export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex.match(/[0-9a-f]{2}/gi);

    if (!channels || channels.length !== 3) {
      throw new Error(`Expected a 6-digit hex color, received "${hex}".`);
    }

    const [red, green, blue] = channels.map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export const textContrastPairs = [
  { theme: 'light', name: 'ink on paper', foreground: '--ink', background: '--paper' },
  { theme: 'light', name: 'ink on slip', foreground: '--ink', background: '--slip' },
  { theme: 'light', name: 'muted text on slip', foreground: '--muted-foreground', background: '--slip' },
  { theme: 'light', name: 'muted text on muted surface', foreground: '--muted-foreground', background: '--muted' },
  { theme: 'light', name: 'carbon text on paper', foreground: '--carbon', background: '--paper' },
  { theme: 'light', name: 'carbon button label', foreground: '--primary-foreground', background: '--primary' },
  { theme: 'light', name: 'secondary text', foreground: '--secondary-foreground', background: '--secondary' },
  { theme: 'light', name: 'accent text', foreground: '--accent-foreground', background: '--accent' },
  { theme: 'light', name: 'expired stamp', foreground: '--void', background: '--slip' },
  { theme: 'light', name: 'active stamp', foreground: '--ok', background: '--slip' },
  { theme: 'light', name: 'expiring stamp', foreground: '--due', background: '--slip' },
  { theme: 'light', name: 'sidebar text', foreground: '--sidebar-foreground', background: '--sidebar' },
  { theme: 'light', name: 'sidebar primary label', foreground: '--sidebar-primary-foreground', background: '--sidebar-primary' },
  { theme: 'light', name: 'sidebar accent label', foreground: '--sidebar-accent-foreground', background: '--sidebar-accent' },
  { theme: 'dark', name: 'ink on paper', foreground: '--ink', background: '--paper' },
  { theme: 'dark', name: 'ink on slip', foreground: '--ink', background: '--slip' },
  { theme: 'dark', name: 'muted text on slip', foreground: '--muted-foreground', background: '--slip' },
  { theme: 'dark', name: 'muted text on muted surface', foreground: '--muted-foreground', background: '--muted' },
  { theme: 'dark', name: 'carbon text on paper', foreground: '--carbon', background: '--paper' },
  { theme: 'dark', name: 'carbon button label', foreground: '--primary-foreground', background: '--primary' },
  { theme: 'dark', name: 'secondary text', foreground: '--secondary-foreground', background: '--secondary' },
  { theme: 'dark', name: 'accent text', foreground: '--accent-foreground', background: '--accent' },
  { theme: 'dark', name: 'expired stamp', foreground: '--void', background: '--slip' },
  { theme: 'dark', name: 'active stamp', foreground: '--ok', background: '--slip' },
  { theme: 'dark', name: 'expiring stamp', foreground: '--due', background: '--slip' },
  { theme: 'dark', name: 'sidebar text', foreground: '--sidebar-foreground', background: '--sidebar' },
  { theme: 'dark', name: 'sidebar primary label', foreground: '--sidebar-primary-foreground', background: '--sidebar-primary' },
  { theme: 'dark', name: 'sidebar accent label', foreground: '--sidebar-accent-foreground', background: '--sidebar-accent' },
] as const;
