/** Reserved handles / path segments — must not be claimable. */
export const RESERVED_HANDLES = new Set([
  'login',
  'dashboard',
  'claim',
  'admin',
  'api',
  'sg',
  'my',
  'th',
  'id',
  's',
  'r',
  'clubs',
  'regattas',
  'rankings',
  'about',
  'privacy',
  'help',
  'compare',
  'demo',
  'favicon.ico',
  'gold',
  'silver',
  'optimist',
  'ranking-app',
  'founding',
  'www',
  'app',
  'static',
  'data',
  'sailorpath',
]);

export function normalizeHandle(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateHandle(raw: string): { ok: true; handle: string } | { ok: false; error: string } {
  const handle = normalizeHandle(raw);
  if (handle.length < 3) return { ok: false, error: 'Handle must be at least 3 characters.' };
  if (handle.length > 32) return { ok: false, error: 'Handle must be 32 characters or fewer.' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
    return { ok: false, error: 'Use lowercase letters, numbers, and hyphens only.' };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, error: 'That handle is reserved. Try another.' };
  }
  return { ok: true, handle };
}
