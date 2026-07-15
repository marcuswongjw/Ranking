import { cache } from 'react';
import fs from 'fs';
import path from 'path';
import type { Club, FleetBundle, FleetId, Regatta, Sailor, Snapshot } from './types';
import { FLEET_LABELS } from './types';

const FIRESTORE_SNAP_URL =
  process.env.SAILORPATH_SNAPSHOT_URL ||
  'https://firestore.googleapis.com/v1/projects/opti-ranking/databases/(default)/documents/opRanking/sailorpathSnapshot';

const RESERVED = new Set([
  'login', 'dashboard', 'claim', 'admin', 'api', 'sg', 'my', 'th', 'id',
  's', 'r', 'clubs', 'regattas', 'rankings', 'about', 'privacy', 'help',
  'compare', 'demo', 'favicon.ico', 'gold', 'silver',
]);

export function isReservedSlug(slug: string) {
  return RESERVED.has(slug.toLowerCase());
}

export function isFleetId(v: string): v is FleetId {
  return v === 'gold' || v === 'silver';
}

function emptyFleet(id: FleetId): FleetBundle {
  return {
    id,
    label: FLEET_LABELS[id],
    standings: [],
    sailors: [],
    regattas: [],
    clubs: [],
  };
}

/** Normalize v1 flat snapshots into multi-fleet shape. */
export function normalizeSnapshot(raw: Snapshot): Snapshot {
  if (raw.fleets && raw.fleets.gold) {
    if (!raw.fleets.silver) raw.fleets.silver = emptyFleet('silver');
    return raw;
  }
  // v1 → wrap as gold only
  raw.fleets = {
    gold: {
      id: 'gold',
      label: FLEET_LABELS.gold,
      standings: raw.standings || [],
      sailors: (raw.sailors || []).map((s) => ({
        id: s.id || s.slug,
        slug: s.slug,
        rankingKey: s.rankingKey || s.slug,
        name: s.name,
        gender: s.gender,
        club: s.club,
        ageBand: s.ageBand,
        rank: s.rank || 0,
        score: s.score || 0,
        squad: s.squad || null,
        fleet: 'gold',
        results: s.results || [],
        trajectory: s.trajectory || [],
      })),
      regattas: raw.regattas || [],
      clubs: raw.clubs || [],
    },
    silver: emptyFleet('silver'),
  };
  // upgrade flat sailors to merged shape if needed
  if (raw.sailors?.length && !raw.sailors[0].fleets) {
    raw.sailors = raw.sailors.map((s) => ({
      id: s.id || s.slug,
      slug: s.slug,
      rankingKey: s.rankingKey || s.slug,
      name: s.name,
      gender: s.gender,
      club: s.club,
      ageBand: s.ageBand,
      fleets: {
        gold: {
          rank: s.rank || 0,
          score: s.score || 0,
          squad: s.squad || null,
          results: s.results || [],
          trajectory: s.trajectory || [],
        },
      },
      chapters: [
        {
          country: raw.meta.country,
          classSlug: raw.meta.classSlug,
          fleet: 'gold',
          label: 'Optimist · Singapore · Gold Fleet',
        },
      ],
    }));
  }
  return raw;
}

function parseFirestoreDoc(data: {
  fields?: { json?: { stringValue?: string } };
}): Snapshot | null {
  const json = data?.fields?.json?.stringValue;
  if (!json) return null;
  try {
    return normalizeSnapshot(JSON.parse(json) as Snapshot);
  } catch {
    return null;
  }
}

function loadLocalFile(): Snapshot {
  const file = path.join(process.cwd(), 'public', 'data', 'official-snapshot.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot;
  return normalizeSnapshot(raw);
}

/**
 * Prefer live Firestore snapshot (published by ranking editor on save / login).
 * Fall back to bundled seed snapshot only for offline build/dev when cloud is empty.
 */
export const getSnapshot = cache(async (): Promise<Snapshot> => {
  try {
    const res = await fetch(FIRESTORE_SNAP_URL, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const doc = await res.json();
      const snap = parseFirestoreDoc(doc);
      if (snap && (snap.fleets?.gold?.standings?.length || snap.standings?.length)) {
        // Ensure meta.source reflects live cloud when present
        if (snap.meta && snap.meta.source !== 'firestore') {
          snap.meta = { ...snap.meta, source: 'firestore' };
        }
        return snap;
      }
    } else if (res.status === 404) {
      console.warn(
        'SailorPath snapshot missing in Firestore (opRanking/sailorpathSnapshot). ' +
          'Sign into the Ranking editor once to auto-publish. Using bundled seed fallback.'
      );
    }
  } catch (e) {
    console.warn('Live SailorPath snapshot fetch failed, using local file:', e);
  }
  return loadLocalFile();
});

export function getFleet(snap: Snapshot, fleet: FleetId): FleetBundle {
  return snap.fleets?.[fleet] || emptyFleet(fleet);
}

export async function getSailor(slug: string): Promise<Sailor | undefined> {
  const snap = await getSnapshot();
  return snap.sailors.find((s) => s.slug === slug || s.id === slug);
}

export async function getRegatta(fleet: FleetId, slug: string): Promise<Regatta | undefined> {
  const snap = await getSnapshot();
  return getFleet(snap, fleet).regattas.find((r) => r.slug === slug || r.id === slug);
}

export async function getClub(fleet: FleetId, slug: string): Promise<Club | undefined> {
  const snap = await getSnapshot();
  return getFleet(snap, fleet).clubs.find((c) => c.slug === slug || c.id === slug);
}

export function seriesBase(country = 'sg', classSlug = 'optimist', fleet?: FleetId) {
  if (fleet) return `/${country}/${classSlug}/${fleet}`;
  return `/${country}/${classSlug}`;
}
