const nameNormalizationCache = new Map();
const historicalRankCache = new Map();

/**
 * Non-blocking toast notifications (replaces routine alert() noise).
 * @param {string} message
 * @param {'success'|'error'|'info'|'warn'} [type]
 * @param {{ title?: string, duration?: number }} [opts]
 */
function showToast(message, type = 'info', opts = {}) {
  const host = document.getElementById('toast-host');
  if (!host) {
    // Fallback if host not mounted yet
    if (type === 'error') console.error(message);
    else console.log(message);
    return;
  }
  const duration = opts.duration != null ? opts.duration : (type === 'error' ? 5200 : 3200);
  const icons = { success: '✓', error: '!', info: 'i', warn: '⚠' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const titleHtml = opts.title
    ? `<div class="toast-title">${escapeHtml(opts.title)}</div>`
    : '';
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-body">${titleHtml}<div class="toast-msg">${escapeHtml(String(message))}</div></div>
    <button type="button" class="toast-close" aria-label="Dismiss">×</button>
  `;
  const dismiss = () => {
    if (el._gone) return;
    el._gone = true;
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 180);
  };
  el.querySelector('.toast-close')?.addEventListener('click', dismiss);
  host.appendChild(el);
  if (duration > 0) setTimeout(dismiss, duration);
  return dismiss;
}

function toastSuccess(msg, opts) { return showToast(msg, 'success', opts); }
function toastError(msg, opts) { return showToast(msg, 'error', opts); }
function toastInfo(msg, opts) { return showToast(msg, 'info', opts); }
function toastWarn(msg, opts) { return showToast(msg, 'warn', opts); }

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} str - Raw string to sanitize
 * @returns {string} - Sanitized string safe for innerHTML
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') return String(str);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function parseBirthYearInput(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === '') return null;
  const parsed = parseInt(str, 10);
  if (!Number.isInteger(parsed)) return NaN;
  if (parsed < COMP_YEAR - 20 || parsed > COMP_YEAR) return NaN;
  return parsed;
}

function createSelectOption(value, text) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  return option;
}

/**
 * Strip URI encoding and HTML entities that can corrupt names stored in
 * data-attributes or an older DROPPED_SAILORS cloud payload.
 */
function cleanSailorName(name) {
  if (name === null || name === undefined) return '';
  let s = String(name).trim();
  if (!s) return '';
  // Decode URI components (may be applied once or twice by older UI)
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(s);
      if (decoded === s) break;
      s = decoded;
    } catch (_) {
      break;
    }
  }
  if (typeof document !== 'undefined') {
    const ta = document.createElement('textarea');
    ta.innerHTML = s;
    s = ta.value;
  } else {
    s = s
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
  return s.trim();
}

/**
 * Normalize sailor names for comparison (case-insensitive, punctuation-agnostic)
 * @param {string} name - Sailor name to normalize
 * @returns {string} - Normalized name
 */
function normalizeName(name) {
  if (!name) return "";
  const cleaned = cleanSailorName(name);
  let cached = nameNormalizationCache.get(cleaned);
  if (cached !== undefined) return cached;
  const normalized = cleaned
    .toLowerCase()
    .replace(/[,.-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
  nameNormalizationCache.set(cleaned, normalized);
  return normalized;
}

/**
 * Check if two names refer to the same sailor
 * @param {string} nameA - First name
 * @param {string} nameB - Second name
 * @returns {boolean} - True if names match
 */
function isSameSailor(nameA, nameB) {
  return normalizeName(nameA) === normalizeName(nameB);
}

/**
 * Decode a sailor name from a data-sailor attribute.
 * Fleet buttons use encodeURIComponent; other UI may store plain / HTML-decoded names.
 */
function sailorNameFromDataAttr(raw) {
  return cleanSailorName(raw);
}

/**
 * Whether this sailor is in the manually-dropped set.
 * Uses normalized name matching so "Jared Tan" and "JARED TAN" both hit.
 */
function isDroppedSailor(name) {
  if (!name) return false;
  const cleaned = cleanSailorName(name);
  if (!cleaned) return false;
  if (DROPPED_SAILORS.has(cleaned) || DROPPED_SAILORS.has(name)) return true;
  for (const d of DROPPED_SAILORS) {
    if (isSameSailor(d, cleaned)) return true;
  }
  return false;
}

/**
 * Collapse/clean the dropped set (call after load or before save).
 * @returns {boolean} true if the set changed
 */
function sanitizeDroppedSailors() {
  const before = Array.from(DROPPED_SAILORS).slice().sort().join('\0');
  const next = new Set();
  for (const d of Array.from(DROPPED_SAILORS)) {
    const c = cleanSailorName(d);
    if (!c) continue;
    let dupe = false;
    for (const x of next) {
      if (isSameSailor(x, c)) { dupe = true; break; }
    }
    if (!dupe) next.add(c);
  }
  DROPPED_SAILORS = next;
  const after = Array.from(DROPPED_SAILORS).slice().sort().join('\0');
  return before !== after;
}

/** Add name to the dropped set, collapsing any prior aliases of the same person. */
function markSailorDropped(name) {
  const cleaned = cleanSailorName(name);
  if (!cleaned) return;
  for (const d of Array.from(DROPPED_SAILORS)) {
    if (isSameSailor(d, cleaned)) DROPPED_SAILORS.delete(d);
  }
  DROPPED_SAILORS.add(cleaned);
}

/** Remove this person (any name spelling) from the dropped set. */
function unmarkSailorDropped(name) {
  const cleaned = cleanSailorName(name);
  if (!cleaned) return;
  for (const d of Array.from(DROPPED_SAILORS)) {
    if (isSameSailor(d, cleaned)) DROPPED_SAILORS.delete(d);
  }
}

/**
 * Whether this sailor is on the exclusions list (normalized name match).
 */
function isExcludedSailor(name) {
  if (!name || !EXCLUDED || EXCLUDED.size === 0) return false;
  const cleaned = cleanSailorName(name);
  if (!cleaned) return false;
  if (EXCLUDED.has(cleaned) || EXCLUDED.has(name)) return true;
  for (const k of EXCLUDED.keys()) {
    if (isSameSailor(k, cleaned)) return true;
  }
  return false;
}

function getExclusionReason(name) {
  if (!name || !EXCLUDED) return undefined;
  const cleaned = cleanSailorName(name);
  if (EXCLUDED.has(cleaned)) return EXCLUDED.get(cleaned);
  if (EXCLUDED.has(name)) return EXCLUDED.get(name);
  for (const [k, reason] of EXCLUDED.entries()) {
    if (isSameSailor(k, cleaned)) return reason;
  }
  return undefined;
}

/** Set exclusion for a sailor, collapsing any prior aliases of the same person. */
function markSailorExcluded(name, reason) {
  const cleaned = cleanSailorName(name);
  if (!cleaned) return;
  for (const k of Array.from(EXCLUDED.keys())) {
    if (isSameSailor(k, cleaned)) EXCLUDED.delete(k);
  }
  EXCLUDED.set(cleaned, reason || 'Excluded');
}

function unmarkSailorExcluded(name) {
  const cleaned = cleanSailorName(name);
  if (!cleaned) return;
  for (const k of Array.from(EXCLUDED.keys())) {
    if (isSameSailor(k, cleaned)) EXCLUDED.delete(k);
  }
}

/** Typical Optimist birth year default for missing data (age ~13). */
function defaultBirthYear() {
  return (typeof COMP_YEAR === 'number' ? COMP_YEAR : new Date().getFullYear()) - 13;
}

/** Canonical metadata key for squad period locks, e.g. squadJul26 / squadJan27. */
function squadPeriodKey(kind, year) {
  const y = year != null ? year : (typeof COMP_YEAR === 'number' ? COMP_YEAR : new Date().getFullYear());
  const yy = String(y).slice(-2);
  return (kind === 'jan' ? 'squadJan' : 'squadJul') + yy;
}

/**
 * Current 6-month squad roster period (stable membership once locked).
 * Jan–Jun → squadJanYY · Jul–Dec → squadJulYY
 * @returns {{ kind: 'jan'|'jul', year: number, periodKey: string, label: string, rangeLabel: string }}
 */
function getCurrentSquadPeriod(refDate) {
  const d = refDate instanceof Date ? refDate : new Date();
  const year = d.getFullYear();
  const month = d.getMonth(); // 0–11
  if (month < 6) {
    return {
      kind: 'jan',
      year,
      periodKey: squadPeriodKey('jan', year),
      label: 'Jan ' + String(year).slice(-2),
      rangeLabel: 'Jan–Jun ' + year
    };
  }
  return {
    kind: 'jul',
    year,
    periodKey: squadPeriodKey('jul', year),
    label: 'Jul ' + String(year).slice(-2),
    rangeLabel: 'Jul–Dec ' + year
  };
}

/**
 * Locked squad only for a period key — no auto ranking fallback.
 * Used by quick filters so roster membership stays fixed for the half-year.
 * @returns {string|null} 'Nat A' | 'Nat B' | 'DS' | null
 */
function getLockedSquad(sailorName, periodKey) {
  if (!periodKey || !sailorName) return null;
  const metaKey = (typeof resolveSailorMetadataKey === 'function')
    ? resolveSailorMetadataKey(sailorName)
    : sailorName;
  const meta = (SAILOR_METADATA && (SAILOR_METADATA[metaKey] || SAILOR_METADATA[sailorName])) || {};
  return meta[periodKey] || null;
}

/**
 * Single source of truth for squad status: metadata lock wins, else auto map.
 * @returns {{ value: string|null, locked: boolean, periodKey: string }}
 */
function getEffectiveSquad(sailorName, periodKey, autoMap) {
  const metaKey = (typeof resolveSailorMetadataKey === 'function')
    ? resolveSailorMetadataKey(sailorName)
    : sailorName;
  const meta = (SAILOR_METADATA && (SAILOR_METADATA[metaKey] || SAILOR_METADATA[sailorName])) || {};
  if (meta[periodKey]) {
    return { value: meta[periodKey], locked: true, periodKey };
  }
  if (autoMap) {
    if (autoMap.has && autoMap.has(sailorName)) {
      return { value: autoMap.get(sailorName) || null, locked: false, periodKey };
    }
    // Map may use a different spelling of the name
    if (autoMap.forEach) {
      let found = null;
      autoMap.forEach((v, n) => {
        if (!found && isSameSailor(n, sailorName)) found = v;
      });
      if (found) return { value: found, locked: false, periodKey };
    }
  }
  return { value: null, locked: false, periodKey };
}

/**
 * Fleet membership period keys, parallel to squad locks:
 *   fleetJan26 → Jan–Jun 2026
 *   fleetJul26 → Jul–Dec 2026
 * A sailor can be Silver in H1 and Gold in H2 (promotion).
 */
function fleetPeriodKey(kind, year) {
  const y = year != null ? year : (typeof COMP_YEAR === 'number' ? COMP_YEAR : new Date().getFullYear());
  const yy = String(y).slice(-2);
  return (kind === 'jan' ? 'fleetJan' : 'fleetJul') + yy;
}

function getCurrentFleetPeriod(refDate) {
  const d = refDate instanceof Date ? refDate : new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month < 6) {
    return {
      kind: 'jan',
      year,
      periodKey: fleetPeriodKey('jan', year),
      label: 'Jan ' + String(year).slice(-2),
      rangeLabel: 'Jan–Jun ' + year
    };
  }
  return {
    kind: 'jul',
    year,
    periodKey: fleetPeriodKey('jul', year),
    label: 'Jul ' + String(year).slice(-2),
    rangeLabel: 'Jul–Dec ' + year
  };
}

/** Active membership period (board + Manage Fleet). Falls back to calendar half-year. */
function getActiveFleetPeriod() {
  if (typeof ACTIVE_FLEET_PERIOD === 'object' && ACTIVE_FLEET_PERIOD && ACTIVE_FLEET_PERIOD.periodKey) {
    return ACTIVE_FLEET_PERIOD;
  }
  return getCurrentFleetPeriod();
}

/** Options for period selector (recent + current + next half-year). */
function getFleetPeriodOptions() {
  const y = typeof COMP_YEAR === 'number' ? COMP_YEAR : new Date().getFullYear();
  const opts = [];
  for (let year = y - 1; year <= y + 1; year++) {
    opts.push({
      kind: 'jan',
      year,
      periodKey: fleetPeriodKey('jan', year),
      label: 'Jan ' + String(year).slice(-2),
      rangeLabel: 'Jan–Jun ' + year
    });
    opts.push({
      kind: 'jul',
      year,
      periodKey: fleetPeriodKey('jul', year),
      label: 'Jul ' + String(year).slice(-2),
      rangeLabel: 'Jul–Dec ' + year
    });
  }
  return opts;
}

/**
 * Fleet membership for a sailor in a given half-year: 'gold' | 'silver'.
 * Reads SAILOR_METADATA[name][fleetJanYY|fleetJulYY], then legacy .fleet, then infer.
 */
function getSailorFleet(name, periodKey) {
  if (!name) return 'gold';
  const pk = periodKey || getActiveFleetPeriod().periodKey;
  const key = (typeof resolveSailorMetadataKey === 'function')
    ? resolveSailorMetadataKey(name)
    : (typeof cleanSailorName === 'function' ? cleanSailorName(name) : name);
  const meta = (typeof SAILOR_METADATA === 'object' && SAILOR_METADATA)
    ? (SAILOR_METADATA[key] || SAILOR_METADATA[name] || {})
    : {};

  if (pk && meta[pk]) {
    return String(meta[pk]).toLowerCase() === 'silver' ? 'silver' : 'gold';
  }
  // Legacy single-field membership
  if (String(meta.fleet || '').toLowerCase() === 'silver') return 'silver';
  if (String(meta.fleet || '').toLowerCase() === 'gold') return 'gold';

  // Infer from regatta participation when metadata not yet set
  try {
    let inGold = false;
    let inSilver = false;
    (REGATTAS || []).forEach(reg => {
      const f = (reg && reg.fleet === 'silver') ? 'silver' : 'gold';
      if (!(reg.sailors || []).some(s => isSameSailor(s.name, name))) return;
      if (f === 'silver') inSilver = true;
      else inGold = true;
    });
    if (inSilver && !inGold) return 'silver';
  } catch (_) { /* ignore */ }
  return 'gold';
}

/**
 * Set fleet membership for a half-year period.
 * @param {string} name
 * @param {'gold'|'silver'} fleet
 * @param {string} [periodKey] fleetJanYY / fleetJulYY — defaults to active period
 */
function setSailorFleet(name, fleet, periodKey) {
  if (!name) return;
  const key = (typeof resolveSailorMetadataKey === 'function')
    ? resolveSailorMetadataKey(name)
    : (typeof cleanSailorName === 'function' ? cleanSailorName(name) : name);
  if (!key) return;
  if (!SAILOR_METADATA[key]) SAILOR_METADATA[key] = {};
  const pk = periodKey || getActiveFleetPeriod().periodKey;
  const val = fleet === 'silver' ? 'silver' : 'gold';
  SAILOR_METADATA[key][pk] = val;
  // Mirror onto legacy .fleet when editing the active period (current board)
  if (pk === getActiveFleetPeriod().periodKey) {
    SAILOR_METADATA[key].fleet = val;
  }
}

function sailorBelongsToFleet(name, fleet, periodKey) {
  const f = fleet === 'silver' ? 'silver' : 'gold';
  return getSailorFleet(name, periodKey) === f;
}

/** Write squad lock into SAILOR_METADATA (shared by Rankings + Historical & Gold). */
function setSquadStatus(sailorName, periodKey, value) {
  const key = (typeof resolveSailorMetadataKey === 'function')
    ? resolveSailorMetadataKey(sailorName)
    : cleanSailorName(sailorName);
  if (!key) return;
  if (!SAILOR_METADATA[key]) SAILOR_METADATA[key] = {};
  if (value) SAILOR_METADATA[key][periodKey] = value;
  else delete SAILOR_METADATA[key][periodKey];
}

function getRegattaPercentileBase(reg) {
  if (reg && reg.dns !== undefined && reg.dns !== null && reg.dns > 0) {
    return reg.dns;
  }
  if (!reg || !reg.sailors || reg.sailors.length === 0) return 1;
  let maxRank = 0;
  reg.sailors.forEach(s => {
    const r = s.rank !== undefined && s.rank !== null ? s.rank : s.nett;
    if (r !== null && r !== undefined && r > maxRank) {
      maxRank = r;
    }
  });
  return maxRank > 0 ? maxRank : 1;
}

const GOLD_ENTRY_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const GOLD_ENTRY_START_YEAR = 2022;

/**
 * Build Jan/Jul gold-entry options from GOLD_ENTRY_START_YEAR through COMP_YEAR + 1
 * so the list stays current without annual hardcoding.
 */
function getGoldEntryOptions() {
  const options = [{ value: '—', label: '— none / unknown —' }];
  const endYear = COMP_YEAR + 1;
  for (let y = GOLD_ENTRY_START_YEAR; y <= endYear; y++) {
    for (const mon of ['Jan', 'Jul']) {
      const v = `${mon} ${y}`;
      options.push({ value: v, label: v });
    }
  }
  return options;
}

/**
 * Parse an optional positive whole-number rank.
 * Empty → null; invalid/non-integer or less than 1 → NaN (caller should reject).
 */
function parseOptionalPositiveInt(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === '') return null;
  const n = Number(str);
  if (!Number.isInteger(n) || n < 1) return NaN;
  return n;
}

function populateGoldEntrySelect(selectEl, { selectedValue = '', includeNone = true } = {}) {
  if (!selectEl) return;

  const allOptions = getGoldEntryOptions();
  const options = includeNone
    ? allOptions
    : allOptions.filter(option => option.value !== '—');

  selectEl.innerHTML = '';

  options.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    if (selectedValue === option.value) opt.selected = true;
    selectEl.appendChild(opt);
  });

  if (selectedValue && !options.some(option => option.value === selectedValue)) {
    const fallbackOpt = document.createElement('option');
    fallbackOpt.value = selectedValue;
    fallbackOpt.textContent = selectedValue;
    fallbackOpt.selected = true;
    selectEl.appendChild(fallbackOpt);
  }

  if (!selectEl.value && options.length) {
    selectEl.value = options[0].value;
  }
}

/**
 * Parse a "Mon YYYY" gold fleet entry date (e.g. "Jul 2025") into a Date.
 * Returns null if unset/unknown ("—") or unparseable.
 */
function parseGoldEntryDate(enteredGold) {
  if (!enteredGold || enteredGold === '—') return null;
  const m = String(enteredGold).match(/^(\w{3})\s+(\d{4})$/);
  if (!m || GOLD_ENTRY_MONTHS[m[1]] === undefined) return null;
  return new Date(parseInt(m[2]), GOLD_ENTRY_MONTHS[m[1]], 1);
}

function isAgeDropped(born, refYear = COMP_YEAR) {
  if (!born) return false;
  return born <= (refYear - 16);
}

function getAgeLimitCutoffYear() {
  return COMP_YEAR - 15;
}

function squadBadge(sq) {
  if (!sq) return '<span class="badge b-n">—</span>';
  const cls = sq === 'Nat A' ? 'b-a' : sq === 'Nat B' ? 'b-b' : sq === 'DS' ? 'b-ds' : 'b-n';
  return `<span class="badge ${cls}">${escapeHtml(sq)}</span>`;
}

function squadNameOrder(squad) {
  if (squad === 'Nat A') return 1;
  if (squad === 'Nat B') return 2;
  if (squad === 'DS') return 3;
  return 4;
}

function getHistoricalRank(sailorName, dateStr) {
  const meta = SAILOR_METADATA[sailorName];
  if (meta) {
    if (dateStr === '2024-06-30' && meta.histJun24 !== undefined && meta.histJun24 !== null) return `#${meta.histJun24}`;
    if (dateStr === '2024-12-31' && meta.histDec24 !== undefined && meta.histDec24 !== null) return `#${meta.histDec24}`;
    if (dateStr === '2025-06-30' && meta.histJun25 !== undefined && meta.histJun25 !== null) return `#${meta.histJun25}`;
    if (dateStr === '2025-12-31' && meta.histDec25 !== undefined && meta.histDec25 !== null) return `#${meta.histDec25}`;
    if (dateStr === '2026-06-30' && meta.histJun26 !== undefined && meta.histJun26 !== null) return `#${meta.histJun26}`;
  }

  const cacheKey = `optimist_${sailorName}_${dateStr}`;
  if (historicalRankCache.has(cacheKey)) {
    return historicalRankCache.get(cacheKey);
  }
  
  const batchKeyPrefix = `optimist_batch_${dateStr}`;
  if (!historicalRankCache.has(batchKeyPrefix)) {
    const cutoff = new Date(dateStr);
    const eligibleRegs = REGATTAS.filter(r => r.date && new Date(r.date) <= cutoff);
    if (eligibleRegs.length === 0) {
      historicalRankCache.set(batchKeyPrefix, true);
      historicalRankCache.set(cacheKey, '—');
      return '—';
    }
    
    const sortedRegs = [...eligibleRegs].sort((a,b) => {
      const dA = a.date ? new Date(a.date) : new Date(0);
      const dB = b.date ? new Date(b.date) : new Date(0);
      return dA - dB;
    });
    
    const activeRegs = sortedRegs.filter(r => r.type !== 'overseas' && r.sailors && r.sailors.length > 0).slice(-5);
    
    const sysSailors = [];
    const systemNames = new Set();
    activeRegs.forEach(reg => reg.sailors.forEach(s => systemNames.add(s.name)));
    
    const normalizedToOriginal = new Map();
    systemNames.forEach(name => {
      const norm = normalizeName(name);
      if (!normalizedToOriginal.has(norm)) {
        normalizedToOriginal.set(norm, name);
      }
    });
    
    normalizedToOriginal.forEach((originalName, norm) => {
      let g = "M", born = defaultBirthYear();
      eligibleRegs.forEach(reg => {
        const found = reg.sailors.find(x => normalizeName(x.name) === norm);
        if (found) {
          if (found.g) g = found.g;
          if (found.born) born = found.born;
        }
      });
      
      if (isDroppedSailor(originalName)) return;
      if (isExcludedSailor(originalName)) return;
      if (isAgeDropped(born)) return;
      
      const scores = activeRegs.map(reg => {
        const sInReg = reg.sailors.find(x => normalizeName(x.name) === norm);
        return sInReg ? (sInReg.rank !== undefined && sInReg.rank !== null ? sInReg.rank : sInReg.nett) : null;
      });
      
      const validScores = scores.map((v, regIdx) => v === null ? getRegattaDnsPenalty(activeRegs[regIdx]) : v);
      while (validScores.length < activeRegs.length) {
        validScores.push(getRegattaDnsPenalty(activeRegs[validScores.length]));
      }
      const sorted = validScores.slice().sort((a,b)=>a-b);
      const score = sorted.slice(0,3).reduce((a,b)=>a+b,0);
      sysSailors.push({ name: originalName, score, ranks: validScores });
    });
    
    sysSailors.sort((a,b) => {
      if (a.score !== b.score) return a.score - b.score;
      const rA = [...a.ranks].sort((x,y)=>x-y);
      const rB = [...b.ranks].sort((x,y)=>x-y);
      for (let i = 0; i < activeRegs.length; i++) {
        const valA = rA[i] !== undefined && rA[i] !== null ? rA[i] : getRegattaDnsPenalty(activeRegs[i]);
        const valB = rB[i] !== undefined && rB[i] !== null ? rB[i] : getRegattaDnsPenalty(activeRegs[i]);
        if (valA !== valB) return valA - valB;
      }
      return 0;
    });
    
    sysSailors.forEach((s, idx) => {
      historicalRankCache.set(`optimist_${s.name}_${dateStr}`, `#${idx + 1}`);
    });
    historicalRankCache.set(batchKeyPrefix, true);
  }
  
  return historicalRankCache.get(cacheKey) || '—';
}

function getHistoricalSortValue(sailor, prop, dateStr) {
  if (sailor[prop] !== null && sailor[prop] !== undefined && sailor[prop] !== '') {
    return sailor[prop];
  }
  const hist = getHistoricalRank(sailor.name, dateStr);
  if (hist && hist.startsWith('#')) {
    const num = parseInt(hist.substring(1));
    if (!isNaN(num)) return num;
  }
  return 9999;
}
