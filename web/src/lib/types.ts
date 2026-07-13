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
};

export type TrajectoryPoint = {
  date: string;
  regatta: string;
  rank: number;
  score: number;
};

export type Sailor = {
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
  results: SailorResult[];
  trajectory: TrajectoryPoint[];
  chapters: { country: string; classSlug: string; label: string }[];
};

export type Regatta = {
  id: string;
  slug: string;
  name: string;
  date: string;
  fleetSize: number;
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
  members: {
    slug: string;
    name: string;
    rank: number;
    score: number;
    squad: string | null;
    ageBand: string | null;
  }[];
};

export type Snapshot = {
  meta: SnapshotMeta;
  sailors: Sailor[];
  regattas: Regatta[];
  clubs: Club[];
  standings: {
    rank: number;
    slug: string;
    name: string;
    club: string;
    score: number;
    squad: string | null;
    ageBand: string | null;
    gender: string | null;
  }[];
};
