const nameNormalizationCache = new Map();
const historicalRankCache = new Map();

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
  return div.innerHTML;
}

/**
 * Normalize sailor names for comparison (case-insensitive, punctuation-agnostic)
 * @param {string} name - Sailor name to normalize
 * @returns {string} - Normalized name
 */
function normalizeName(name) {
  if (!name) return "";
  let cached = nameNormalizationCache.get(name);
  if (cached !== undefined) return cached;
  const normalized = String(name)
    .toLowerCase()
    .replace(/[,.-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
  nameNormalizationCache.set(name, normalized);
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

function getRegattaPercentileBase(reg) {
  if (reg && reg.dns !== undefined && reg.dns !== null && reg.dns > 1) {
    return reg.dns - 1;
  }
  if (!reg || !reg.sailors || reg.sailors.length === 0) return 1;
  let maxRank = 0;
  reg.sailors.forEach(s => {
    const r = s.rank !== undefined && s.rank !== null ? s.rank : s.nett;
    if (r !== null && r !== undefined && r > maxRank) {
      maxRank = r;
    }
  });
  return maxRank > 1 ? maxRank - 1 : 1;
}

function isAgeDropped(born) {
  if (!born) return false;
  return born <= (COMP_YEAR - 16);
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
      let g = "M", born = 2013;
      eligibleRegs.forEach(reg => {
        const found = reg.sailors.find(x => normalizeName(x.name) === norm);
        if (found) {
          if (found.g) g = found.g;
          if (found.born) born = found.born;
        }
      });
      
      if (DROPPED_SAILORS.has(originalName)) return;
      if (isAgeDropped(born)) return;
      
      const scores = activeRegs.map(reg => {
        const sInReg = reg.sailors.find(x => normalizeName(x.name) === norm);
        return sInReg ? (sInReg.rank !== undefined && sInReg.rank !== null ? sInReg.rank : sInReg.nett) : null;
      });
      
      const validScores = scores.map(v => v === null ? DNS : v);
      while (validScores.length < 5) validScores.push(DNS);
      const sorted = validScores.slice().sort((a,b)=>a-b);
      const score = sorted.slice(0,3).reduce((a,b)=>a+b,0);
      sysSailors.push({ name: originalName, score, ranks: validScores });
    });
    
    sysSailors.sort((a,b) => {
      if (a.score !== b.score) return a.score - b.score;
      const rA = [...a.ranks].sort((x,y)=>(x===null?DNS:x) - (y===null?DNS:y));
      const rB = [...b.ranks].sort((x,y)=>(x===null?DNS:x) - (y===null?DNS:y));
      for (let i=0; i<5; i++) {
        const valA = rA[i] !== undefined && rA[i] !== null ? rA[i] : DNS;
        const valB = rB[i] !== undefined && rB[i] !== null ? rB[i] : DNS;
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
  if (sailor[prop] !== null && sailor[prop] !== undefined) {
    return sailor[prop];
  }
  const hist = getHistoricalRank(sailor.name, dateStr);
  if (hist && hist.startsWith('#')) {
    const num = parseInt(hist.substring(1));
    if (!isNaN(num)) return num;
  }
  return 999;
}
