import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, textContrastPairs } from '@/lib/colors';

const tokenSource = readFileSync('src/styles/tokens.css', 'utf8');

function parseVariables(selector: string): Record<string, string> {
  const block = tokenSource.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1];

  if (!block) {
    throw new Error(`Could not find the ${selector} token block.`);
  }

  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      `--${name}`,
      value.trim(),
    ]),
  );
}

const lightTokens = parseVariables(':root');
const darkTokens = { ...lightTokens, ...parseVariables('\\.dark') };

function resolveColor(
  token: string,
  theme: 'light' | 'dark',
  visited = new Set<string>(),
): string {
  const values = theme === 'light' ? lightTokens : darkTokens;
  const value = values[token];

  if (!value) {
    throw new Error(`Token ${token} is not defined for the ${theme} theme.`);
  }

  const alias = value.match(/^var\((--[\w-]+)\)$/)?.[1];

  if (!alias) {
    return value;
  }
  if (visited.has(token)) {
    throw new Error(`Circular color token reference at ${token}.`);
  }

  visited.add(token);
  return resolveColor(alias, theme, visited);
}

describe('theme text contrast', () => {
  it.each(textContrastPairs)('$theme $name meets WCAG AA', ({ theme, foreground, background }) => {
    expect(
      contrastRatio(resolveColor(foreground, theme), resolveColor(background, theme)),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
