export const capacitorAppId = 'app.vercel.warrantyvault1729';
export const nativeAuthScheme = capacitorAppId;

export function nativeAuthRedirect(path: '/callback' | '/reset', returnTo?: string) {
  const redirect = new URL(`${nativeAuthScheme}://auth${path}`);
  if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
    redirect.searchParams.set('returnTo', returnTo);
  }
  return redirect.toString();
}

export function parseNativeAuthRedirect(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== `${nativeAuthScheme}:` || url.hostname !== 'auth') {
    return null;
  }

  const code = url.searchParams.get('code');
  if (!code && !url.searchParams.has('error')) return null;

  const isPasswordRecovery = url.pathname === '/reset'
    || url.searchParams.get('type') === 'recovery';
  const requestedPath = url.searchParams.get('returnTo');
  const returnTo = requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
    ? requestedPath
    : '/';

  return {
    code,
    error: url.searchParams.get('error_description') ?? url.searchParams.get('error'),
    returnTo,
    isPasswordRecovery,
  };
}
