import { cache } from 'react';
import fs from 'fs';
import path from 'path';
import type { Club, Regatta, Sailor, Snapshot } from './types';

const RESERVED = new Set([
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
  'favicon.ico',
]);

export function isReservedSlug(slug: string) {
  return RESERVED.has(slug.toLowerCase());
}

export const getSnapshot = cache((): Snapshot => {
  const file = path.join(process.cwd(), 'public', 'data', 'official-snapshot.json');
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as Snapshot;
});

export function getSailor(slug: string): Sailor | undefined {
  return getSnapshot().sailors.find((s) => s.slug === slug || s.id === slug);
}

export function getRegatta(slug: string): Regatta | undefined {
  return getSnapshot().regattas.find((r) => r.slug === slug || r.id === slug);
}

export function getClub(slug: string): Club | undefined {
  return getSnapshot().clubs.find((c) => c.slug === slug || c.id === slug);
}

export function seriesBase(country = 'sg', classSlug = 'optimist') {
  return `/${country}/${classSlug}`;
}
