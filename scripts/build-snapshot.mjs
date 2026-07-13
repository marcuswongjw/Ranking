#!/usr/bin/env node
/**
 * Build official-snapshot.json for SailorPath from ranking seed data.
 * Later: replace seed input with live Firestore export.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'js', 'seed.js');
const OUT = path.join(ROOT, 'web', 'public', 'data', 'official-snapshot.json');

const COUNTRY = 'sg';
const CLASS_SLUG = 'optimist';
const COMP_YEAR = new Date().getFullYear();
const WINDOW = 5;
const BEST_N = 3;

function normalizeName(name) {
  return String(name || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function slugify(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'sailor';
}

function ageBand(born, refYear = COMP_YEAR) {
  if (!born) return null;
  const a = refYear - born;
  if (a >= 13) return '13+';
  if (a === 12) return '12';
  if (a === 11) return '11';
  if (a <= 10) return '10 & under';
  return String(a);
}

function loadSeed() {
  const code = fs.readFileSync(SEED, 'utf8');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(
    `${code}\nthis.__regs = getOptimistSeedRegattas();\nthis.__meta = getDefaultSailorMetadata();\nthis.__dropped = Array.from(getDefaultDroppedSailors());\nthis.__excluded = Object.fromEntries(getDefaultExcludedSailors());`,
    ctx
  );
  return {
    regattas: ctx.__regs || [],
    metadata: ctx.__meta || {},
    dropped: new Set((ctx.__dropped || []).map(normalizeName)),
    excluded: new Map(Object.entries(ctx.__excluded || {})),
  };
}

function fleetSize(reg) {
  if (reg.dns != null && reg.dns !== '') return Number(reg.dns) || reg.sailors.length;
  return (reg.sailors && reg.sailors.length) || 0;
}

function dnsPenalty(reg) {
  const n = fleetSize(reg);
  return n > 0 ? n + 1 : 84;
}

function activeRegattas(regs) {
  return regs
    .filter((r) => r && r.name && Array.isArray(r.sailors) && r.sailors.length > 0)
    .slice()
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function computeRankings(allRegs, dropped, excluded) {
  const ordered = activeRegattas(allRegs);
  const windowRegs = ordered.slice(-WINDOW);
  const byNorm = new Map();

  // Collect identities from all window regattas
  for (const reg of windowRegs) {
    for (const row of reg.sailors) {
      const norm = normalizeName(row.name);
      if (!norm || dropped.has(norm)) continue;
      if (excluded.has(row.name) || excluded.has(norm)) continue;
      if (!byNorm.has(norm)) {
        byNorm.set(norm, {
          name: row.name,
          g: row.g || null,
          born: row.born || null,
          club: row.club || '',
          scores: Array(windowRegs.length).fill(null),
          ranks: Array(windowRegs.length).fill(null),
        });
      }
      const s = byNorm.get(norm);
      if (row.g && !s.g) s.g = row.g;
      if (row.born && !s.born) s.born = row.born;
      if (row.club && !s.club) s.club = row.club;
      if (row.name.length > s.name.length) s.name = row.name; // prefer fuller name form
    }
  }

  windowRegs.forEach((reg, idx) => {
    const byName = new Map();
    for (const row of reg.sailors) {
      byName.set(normalizeName(row.name), row);
    }
    for (const [norm, s] of byNorm) {
      const row = byName.get(norm);
      if (row) {
        const place = row.rank != null ? Number(row.rank) : row.nett != null ? Number(row.nett) : null;
        s.ranks[idx] = place;
        s.scores[idx] = place;
      }
    }
  });

  const list = [];
  for (const s of byNorm.values()) {
    const filled = s.scores.map((v, i) => (v == null ? dnsPenalty(windowRegs[i]) : v));
    const best = filled.slice().sort((a, b) => a - b).slice(0, BEST_N);
    const score = best.reduce((a, b) => a + b, 0);
    list.push({ ...s, score, filledScores: filled });
  }

  list.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  list.forEach((s, i) => {
    s.rank = i + 1;
  });

  // Simple squad badges by gender pool (top 8 Nat A, next band Nat B — approximate)
  const squad = new Map();
  for (const g of ['M', 'F']) {
    const pool = list.filter((s) => s.g === g);
    pool.slice(0, 8).forEach((s) => squad.set(normalizeName(s.name), 'Nat A'));
    pool.slice(8, 16).forEach((s) => {
      if (!squad.has(normalizeName(s.name))) squad.set(normalizeName(s.name), 'Nat B');
    });
    pool.slice(16).forEach((s) => {
      if (!squad.has(normalizeName(s.name))) squad.set(normalizeName(s.name), 'DS');
    });
  }

  return { list, windowRegs, squad };
}

function buildTrajectory(allRegs, dropped, excluded, sailorNorm) {
  const ordered = activeRegattas(allRegs);
  const points = [];
  for (let end = Math.min(WINDOW, ordered.length); end <= ordered.length; end++) {
    const slice = ordered.slice(0, end);
    const { list, windowRegs } = computeRankings(slice, dropped, excluded);
    // recompute only on prefix using last WINDOW of prefix
    const prefixRegs = ordered.slice(Math.max(0, end - WINDOW), end);
    const sub = computeRankings(prefixRegs, dropped, excluded);
    const me = sub.list.find((s) => normalizeName(s.name) === sailorNorm);
    if (!me) continue;
    const lastReg = prefixRegs[prefixRegs.length - 1];
    points.push({
      date: lastReg.date,
      regatta: lastReg.name,
      rank: me.rank,
      score: me.score,
    });
  }
  return points;
}

function main() {
  const { regattas, dropped, excluded } = loadSeed();
  const { list, windowRegs, squad } = computeRankings(regattas, dropped, excluded);

  const slugCount = new Map();
  function uniqueSlug(name) {
    let base = slugify(name);
    let n = slugCount.get(base) || 0;
    slugCount.set(base, n + 1);
    if (n === 0) return base;
    return `${base}-${n + 1}`;
  }

  const sailors = list.map((s) => {
    const norm = normalizeName(s.name);
    const id = uniqueSlug(s.name);
    const results = windowRegs.map((reg, idx) => {
      const place = s.ranks[idx];
      const fs = fleetSize(reg);
      return {
        regattaId: slugify(reg.name) + '-' + (reg.date || ''),
        regattaName: reg.name,
        date: reg.date,
        place: place,
        nett: place,
        fleetSize: fs,
        scoredAs: s.filledScores[idx],
        didNotSail: place == null,
      };
    });

    return {
      id,
      slug: id,
      rankingKey: norm,
      name: s.name,
      gender: s.g,
      club: s.club || '',
      ageBand: ageBand(s.born),
      // never export raw birth year for public site
      rank: s.rank,
      score: s.score,
      squad: squad.get(norm) || null,
      results,
      trajectory: buildTrajectory(regattas, dropped, excluded, norm),
      chapters: [{ country: COUNTRY, classSlug: CLASS_SLUG, label: 'Optimist · Singapore' }],
    };
  });

  const regattaPages = activeRegattas(regattas).map((reg) => {
    const fs = fleetSize(reg);
    const id = slugify(reg.name) + '-' + (reg.date || '');
    const results = (reg.sailors || [])
      .map((row) => ({
        name: row.name,
        place: row.rank != null ? Number(row.rank) : null,
        nett: row.nett != null ? Number(row.nett) : row.rank != null ? Number(row.rank) : null,
        club: row.club || '',
        gender: row.g || null,
        sailorSlug: sailors.find((s) => s.rankingKey === normalizeName(row.name))?.slug || null,
      }))
      .sort((a, b) => (a.place ?? 9999) - (b.place ?? 9999));
    return {
      id,
      slug: id,
      name: reg.name,
      date: reg.date,
      fleetSize: fs,
      country: COUNTRY,
      classSlug: CLASS_SLUG,
      results,
    };
  });

  const clubMap = new Map();
  for (const s of sailors) {
    const c = s.club || 'Unknown';
    if (!clubMap.has(c)) clubMap.set(c, []);
    clubMap.get(c).push({
      slug: s.slug,
      name: s.name,
      rank: s.rank,
      score: s.score,
      squad: s.squad,
      ageBand: s.ageBand,
    });
  }
  const clubs = [...clubMap.entries()]
    .map(([name, members]) => ({
      id: slugify(name),
      slug: slugify(name),
      name,
      country: COUNTRY,
      classSlug: CLASS_SLUG,
      members: members.sort((a, b) => a.rank - b.rank),
    }))
    .sort((a, b) => b.members.length - a.members.length);

  const snapshot = {
    meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      country: COUNTRY,
      classSlug: CLASS_SLUG,
      classLabel: 'Optimist',
      countryLabel: 'Singapore',
      rankingWindow: WINDOW,
      bestOf: BEST_N,
      source: 'seed',
      note: 'Official series snapshot for SailorPath. Birth years excluded. Squad badges are approximate until live export wires locked squads.',
    },
    sailors,
    regattas: regattaPages,
    clubs,
    standings: sailors.map((s) => ({
      rank: s.rank,
      slug: s.slug,
      name: s.name,
      club: s.club,
      score: s.score,
      squad: s.squad,
      ageBand: s.ageBand,
      gender: s.gender,
    })),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snapshot));
  console.log(`Wrote ${OUT}`);
  console.log(`  sailors=${sailors.length} regattas=${regattaPages.length} clubs=${clubs.length}`);
  console.log(`  window=${windowRegs.map((r) => r.name).join(' | ')}`);
}

main();
