import { describe, expect, it } from 'vitest';
import { nativeAuthRedirect, parseNativeAuthRedirect } from './native-config';

describe('native auth redirects', () => {
  it('creates a custom-scheme redirect and retains an internal return path', () => {
    const redirect = new URL(nativeAuthRedirect('/callback', '/items/123'));

    expect(redirect.protocol).toBe('app.vercel.warrantyvault1729:');
    expect(redirect.host).toBe('auth');
    expect(redirect.pathname).toBe('/callback');
    expect(redirect.searchParams.get('returnTo')).toBe('/items/123');
  });

  it('recognizes password recovery and rejects unsafe return paths', () => {
    const callback = parseNativeAuthRedirect(
      'app.vercel.warrantyvault1729://auth/reset?code=abc&returnTo=%2F%2Fevil.example',
    );

    expect(callback).toEqual({
      code: 'abc',
      error: null,
      returnTo: '/',
      isPasswordRecovery: true,
    });
  });

  it('ignores unrelated URLs and callbacks without an auth code or error', () => {
    expect(parseNativeAuthRedirect('https://example.com/auth/callback?code=abc')).toBeNull();
    expect(parseNativeAuthRedirect('app.vercel.warrantyvault1729://auth/callback')).toBeNull();
  });
});
