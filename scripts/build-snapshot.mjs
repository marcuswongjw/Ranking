#!/usr/bin/env node
/**
 * Build official-snapshot.json for SailorPath.
 * Prefer live Firestore sailorpathSnapshot; else seed via export-snapshot.js.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'web', 'public', 'data', 'official-snapshot.json');
const FIRESTORE_URL =
  process.env.SAILORPATH_SNAPSHOT_URL ||
  'https://firestore.googleapis.com/v1/projects/opti-ranking/databases/(default)/documents/opRanking/sailorpathSnapshot';

async function tryLive() {
  try {
    const res = await fetch(FIRESTORE_URL);
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

function buildFromSeed() {
  const exportCode = fs.readFileSync(path.join(ROOT, 'js', 'export-snapshot.js'), 'utf8');
  const seedCode = fs.readFileSync(path.join(ROOT, 'js', 'seed.js'), 'utf8');
  const ctx = { console, globalThis: {} };
  vm.createContext(ctx);
  // export-snapshot attaches to globalThis
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
  let snap = await tryLive();
  if (snap) {
    console.log('Using live Firestore sailorpathSnapshot');
  } else {
    console.log('Live snapshot unavailable — building from seed');
    snap = buildFromSeed();
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
