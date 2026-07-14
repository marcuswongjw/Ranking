export type SnapshotMeta = {
  version: number;
  exportedAt: string;
  country: string;
  classSlug: string;
  classLabel: string;
  countryLabel: string;
  rankingWindow: number;
  bestOf: number;
  source: string;
  fleets?: string[];
  note?: string;
};

export type SailorResult = {
  regattaId: string;
  regattaName: string;
  date: string;
  place: number | null;
  nett: number | null;
  fleetSize: number;
  scoredAs: number;
  didNotSail: boolean;
  fleet?: string;
};

export type TrajectoryPoint = {
  date: string;
  regatta: string;
  rank: number;
  score: number;
  fleet?: string;
};

export type FleetStanding = {
  rank: number;
  slug: string;
  name: string;
  club: string;
  score: number;
  squad: string | null;
  ageBand: string | null;
  gender: string | null;
  fleet?: string;
};

export type FleetSailor = {
  id: string;
  slug: string;
  rankingKey: string;
  name: string;
  gender: string | null;
  club: string;
  ageBand: string | null;
  rank: number;
  score: number;
  squad: string | null;
  fleet: string;
  results: SailorResult[];
  trajectory: TrajectoryPoint[];
};

export type Regatta = {
  id: string;
  slug: string;
  name: string;
  date: string;
  fleetSize: number;
  fleet?: string;
  country: string;
  classSlug: string;
  results: {
    name: string;
    place: number | null;
    nett: number | null;
    club: string;
    gender: string | null;
    sailorSlug: string | null;
  }[];
};

export type Club = {
  id: string;
  slug: string;
  name: string;
  country: string;
  classSlug: string;
  fleet?: string;
  members: {
    slug: string;
    name: string;
    rank: number;
    score: number;
    squad: string | null;
    ageBand: string | null;
  }[];
};

export type FleetBundle = {
  id: string;
  label: string;
  standings: FleetStanding[];
  sailors: FleetSailor[];
  regattas: Regatta[];
  clubs: Club[];
};

/** Merged sailor profile (may include gold and/or silver fleet results). */
export type Sailor = {
  id: string;
  slug: string;
  rankingKey: string;
  name: string;
  gender: string | null;
  club: string;
  ageBand: string | null;
  fleets: Record<
    string,
    {
      rank: number;
      score: number;
      squad: string | null;
      results: SailorResult[];
      trajectory: TrajectoryPoint[];
    }
  >;
  chapters: { country: string; classSlug: string; fleet: string; label: string }[];
  // v1 flat fields when only gold snapshot
  rank?: number;
  score?: number;
  squad?: string | null;
  results?: SailorResult[];
  trajectory?: TrajectoryPoint[];
  fleet?: string;
};

export type Snapshot = {
  meta: SnapshotMeta;
  fleets?: Record<string, FleetBundle>;
  standings: FleetStanding[];
  sailors: Sailor[];
  regattas: Regatta[];
  clubs: Club[];
};

export type FleetId = 'gold' | 'silver';

export const FLEET_LABELS: Record<FleetId, string> = {
  gold: 'Gold Fleet',
  silver: 'Silver Fleet',
};
