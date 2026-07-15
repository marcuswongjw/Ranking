#!/usr/bin/env node
/**
 * Build official-snapshot.json for SailorPath.
 * Prefer live Firestore sailorpathSnapshot;
 * else derive from opRanking/state (public REST);
 * else seed via export-snapshot.js.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'web', 'public', 'data', 'official-snapshot.json');
const FIRESTORE_SNAP_URL =
  process.env.SAILORPATH_SNAPSHOT_URL ||
  'https://firestore.googleapis.com/v1/projects/opti-ranking/databases/(default)/documents/opRanking/sailorpathSnapshot';
const FIRESTORE_STATE_URL =
  process.env.SAILORPATH_STATE_URL ||
  'https://firestore.googleapis.com/v1/projects/opti-ranking/databases/(default)/documents/opRanking/state';

/** Decode Firestore REST field values to plain JS. */
function decodeValue(v) {
  if (v == null || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) {
    const vals = v.arrayValue.values || [];
    return vals.map(decodeValue);
  }
  if ('mapValue' in v) {
    const fields = v.mapValue.fields || {};
    const out = {};
    for (const [k, fv] of Object.entries(fields)) out[k] = decodeValue(fv);
    return out;
  }
  return null;
}

function decodeDocument(doc) {
  const fields = doc?.fields || {};
  const out = {};
  for (const [k, fv] of Object.entries(fields)) out[k] = decodeValue(fv);
  return out;
}

async function tryLiveSnapshot() {
  try {
    const res = await fetch(FIRESTORE_SNAP_URL);
    if (!res.ok) return null;
    const doc = await res.json();
    const json = doc?.fields?.json?.stringValue;
    if (!json) return null;
    const snap = JSON.parse(json);
    if (!snap?.meta) return null;
    return snap;
  } catch {
    return null;
  }
}

function runBuildSnapshot(state) {
  const exportCode = fs.readFileSync(path.join(ROOT, 'js', 'export-snapshot.js'), 'utf8');
  const ctx = {
    console,
    globalThis: {},
    __state: {
      regattas: state.regattas || [],
      dropped: state.dropped || [],
      excluded: state.excluded || {},
      metadata: state.metadata || {},
      source: state.source || 'firestore',
      compYear: new Date().getFullYear(),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(
    `
    var globalThis = this;
    ${exportCode}
    this.__snap = buildSailorpathSnapshot(this.__state);
    `,
    ctx
  );
  return ctx.__snap;
}

async function tryFromState() {
  try {
    const res = await fetch(FIRESTORE_STATE_URL);
    if (!res.ok) return null;
    const doc = await res.json();
    const state = decodeDocument(doc);
    if (!Array.isArray(state.regattas) || state.regattas.length === 0) return null;
    state.source = 'firestore';
    return runBuildSnapshot(state);
  } catch (e) {
    console.warn('Build from opRanking/state failed:', e.message || e);
    return null;
  }
}

function buildFromSeed() {
  const exportCode = fs.readFileSync(path.join(ROOT, 'js', 'export-snapshot.js'), 'utf8');
  const seedCode = fs.readFileSync(path.join(ROOT, 'js', 'seed.js'), 'utf8');
  const ctx = { console, globalThis: {} };
  vm.createContext(ctx);
  vm.runInContext(
    `
    var globalThis = this;
    ${exportCode}
    ${seedCode}
    var regs = getOptimistSeedRegattas().map(function(r) {
      if (!r.fleet) r.fleet = 'gold';
      return r;
    });
    var dropped = Array.from(getDefaultDroppedSailors());
    var excluded = Object.fromEntries(getDefaultExcludedSailors());
    this.__snap = buildSailorpathSnapshot({
      regattas: regs,
      dropped: dropped,
      excluded: excluded,
      metadata: getDefaultSailorMetadata(),
      source: 'seed',
      compYear: new Date().getFullYear()
    });
    `,
    ctx
  );
  return ctx.__snap;
}

async function main() {
  let snap = await tryLiveSnapshot();
  if (snap) {
    console.log('Using live Firestore sailorpathSnapshot');
  } else {
    console.log('Live snapshot unavailable — trying opRanking/state…');
    snap = await tryFromState();
    if (snap) {
      console.log('Built snapshot from live opRanking/state');
    } else {
      console.log('State unavailable — building from seed');
      snap = buildFromSeed();
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snap));
  const g = snap.fleets?.gold?.standings?.length || snap.standings?.length || 0;
  const s = snap.fleets?.silver?.standings?.length || 0;
  console.log(`Wrote ${OUT}`);
  console.log(`  source=${snap.meta?.source} gold=${g} silver=${s} exportedAt=${snap.meta?.exportedAt}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
