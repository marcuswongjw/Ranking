#!/usr/bin/env node
/**
 * Fixture tests for entry/drop-date fleet membership (mirrors utils.js + export-snapshot.js).
 */
function parsePeriodToValue(p) {
  if (!p || p === '—') return null;
  let m = String(p).match(/^(Jan|Jul)\s+(\d{4})$/i);
  if (m) {
    const isJul = m[1].toLowerCase() === 'jul';
    return parseInt(m[2], 10) * 2 + (isJul ? 1 : 0);
  }
  m = String(p).match(/^(?:fleet|squad)(Jan|Jul)(\d{2})$/i);
  if (m) {
    const isJul = m[1].toLowerCase() === 'jul';
    return (2000 + parseInt(m[2], 10)) * 2 + (isJul ? 1 : 0);
  }
  return null;
}

function getSailorFleet(meta, periodKey, legacy = 'gold') {
  const targetVal = parsePeriodToValue(periodKey);
  if (targetVal === null) return legacy === 'silver' ? 'silver' : 'gold';

  const dropVal = parsePeriodToValue(meta.droppedOptimist);
  if (dropVal !== null && targetVal >= dropVal) return null;

  let effectiveGoldVal = null;
  const goldEntryVal = parsePeriodToValue(meta.enteredGold);
  if (goldEntryVal !== null) effectiveGoldVal = goldEntryVal;
  else if (legacy === 'gold') effectiveGoldVal = parsePeriodToValue('Jan 2024');

  if (effectiveGoldVal !== null && targetVal >= effectiveGoldVal) return 'gold';

  let effectiveSilverVal = null;
  const silverEntryVal = parsePeriodToValue(meta.enteredSilver);
  if (silverEntryVal !== null) effectiveSilverVal = silverEntryVal;
  else if (meta.enteredGold && meta.enteredGold !== '—') effectiveSilverVal = parsePeriodToValue('Jan 2024');
  else if (legacy === 'silver') effectiveSilverVal = parsePeriodToValue('Jan 2024');

  if (effectiveSilverVal !== null && targetVal >= effectiveSilverVal) return 'silver';
  return null;
}

const cases = [
  {
    name: 'Gold Jul 2025 → gold from that period on',
    meta: { enteredGold: 'Jul 2025' },
    checks: [
      ['fleetJul25', 'gold'],
      ['fleetJan26', 'gold'],
      ['fleetJul26', 'gold'],
      ['fleetJan25', 'silver'], // auto-silver before gold
      ['fleetJul24', 'silver'],
    ],
  },
  {
    name: 'No gold entry, legacy gold → Jan 2024 gold',
    meta: {},
    legacy: 'gold',
    checks: [
      ['fleetJan24', 'gold'],
      ['fleetJul26', 'gold'],
      ['fleetJul23', null],
    ],
  },
  {
    name: 'Silver only Jul 2026',
    meta: { enteredSilver: 'Jul 2026', fleet: 'silver' },
    legacy: 'silver',
    checks: [
      ['fleetJul26', 'silver'],
      ['fleetJan26', null],
      ['fleetJul25', null],
    ],
  },
  {
    name: 'Drop Jan 2026 removes from then on',
    meta: { enteredGold: 'Jan 2024', droppedOptimist: 'Jan 2026' },
    checks: [
      ['fleetJul25', 'gold'],
      ['fleetJan26', null],
      ['fleetJul26', null],
    ],
  },
  {
    name: 'fleetJan stamps must be ignored (simulate stamp conflict)',
    meta: { enteredGold: 'Jan 2025', fleetJan26: 'silver', fleetJul26: 'gold' },
    checks: [
      ['fleetJan26', 'gold'], // stamp says silver — entry date wins
      ['fleetJul26', 'gold'],
      ['fleetJul24', 'silver'],
    ],
  },
];

let failed = 0;
for (const c of cases) {
  for (const [pk, expected] of c.checks) {
    const got = getSailorFleet(c.meta, pk, c.legacy || 'gold');
    if (got !== expected) {
      console.error(`FAIL ${c.name}: ${pk} expected ${expected}, got ${got}`);
      failed++;
    }
  }
}
if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log(`OK — ${cases.length} scenarios, all membership assertions passed`);
