function getRegattaDnsPenalty(reg) {
  if (!reg) return DNS;
  const total = (reg.dns !== undefined && reg.dns !== null) ? parseInt(reg.dns) : (reg.sailors ? reg.sailors.length : 0);
  if (total <= 0) return DNS;
  return total + 1;
}

function ageGroup(born, refYear = COMP_YEAR) {
  const a = refYear - born;
  return a >= 13 ? 13 : a === 12 ? 12 : a === 11 ? 11 : 10;
}

// refYear lets callers project squad allocation onto a future reference year
// (e.g. COMP_YEAR + 1 for the next selection cycle), re-bucketing ages and
// dropping sailors who will have retired (16+) by that year, while still
// using each sailor's current best-3 score.
function computeSquads(sailorList, refYear = COMP_YEAR) {
  const res = new Map();
  ['M','F'].forEach(g => {
    const pool = sailorList.filter(s => s.g === g && !EXCLUDED.has(s.name) && s.born >= (refYear - 15))
      .map(s => ({ ...s, _sc: s.simScore !== undefined ? s.simScore : s.score })).sort((a,b) => a._sc - b._sc);
    pool.slice(0,8).forEach(s => res.set(s.name, 'Nat A'));
    const rem = () => pool.filter(s => !res.has(s.name));
    let nbF = 0;
    for (const {ag, quota} of [{ag:13, quota:2},{ag:12, quota:3},{ag:11, quota:3}]) {
      if (nbF >= 8) break;
      const av = Math.min(quota, 8 - nbF);
      const aged = rem().filter(s => {
        const a = refYear - s.born;
        return ag === 13 ? a === 13 : ag === 12 ? a === 12 : a <= 11;
      });
      let f = 0;
      for (const s of aged) {
        if (f >= av) break;
        res.set(s.name, 'Nat B');
        f++;
        nbF++;
      }
      if (f < av) {
        for (const s of rem()) {
          if (f >= av) break;
          res.set(s.name, 'Nat B');
          f++;
          nbF++;
        }
      }
    }
  });

  const dsEl = g => sailorList.filter(s => s.g === g && !EXCLUDED.has(s.name) && s.born >= (refYear - 12) && !res.has(s.name))
    .map(s => ({ ...s, _sc: s.simScore !== undefined ? s.simScore : s.score })).sort((a,b) => a._sc - b._sc);

  const dsF = { M: 0, F: 0 };
  ['M','F'].forEach(g => {
    const pool = dsEl(g);
    for (const {ag, quota} of [{ag:12, quota:1},{ag:11, quota:4},{ag:10, quota:3}]) {
      if (dsF[g] >= 8) break;
      const av = Math.min(quota, 8 - dsF[g]);
      const aged = pool.filter(s => {
        const a = refYear - s.born;
        return ag === 12 ? a === 12 : ag === 11 ? a === 11 : a <= 10;
      });
      let f = 0;
      for (const s of aged) {
        if (f >= av || res.has(s.name)) break;
        res.set(s.name, 'DS');
        dsF[g]++;
        f++;
      }
    }
  });

  ['M','F'].forEach(g => {
    const need = 8 - dsF[g];
    if (need <= 0) return;
    let n = 0;
    for (const s of dsEl(g).filter(s => (refYear - s.born) <= 11 && !res.has(s.name))) {
      if (n >= need) break;
      res.set(s.name, 'DS');
      dsF[g]++;
      n++;
    }
  });

  const tot = dsF.M + dsF.F;
  if (tot < 16) {
    const cross = ['M','F'].flatMap(g => dsEl(g).filter(s => (refYear - s.born) <= 11 && !res.has(s.name))).sort((a,b) => a._sc - b._sc);
    let n = tot;
    for (const s of cross) {
      if (n >= 16) break;
      if (res.has(s.name)) continue;
      res.set(s.name, 'DS');
      dsF[s.g]++;
      n++;
    }
  }
  return res;
}

function recomputeSailors() {
  historicalRankCache.clear();
  REGATTAS.forEach(reg => {
    if (!reg.date) {
      reg.date = getRegattaDateByName(reg.name);
    }
  });

  REGATTAS.sort((a, b) => {
    const dA = a.date ? new Date(a.date) : new Date(0);
    const dB = b.date ? new Date(b.date) : new Date(0);
    return dA - dB;
  });

  const latestRegs = getActiveRegattas();
  const sailorMap = new Map();
  const normalizedToOriginal = new Map();
  
  const allSystemSailors = getAllSailorsInSystem();
  allSystemSailors.forEach(s => {
    if (DROPPED_SAILORS.has(s.name)) return;
    if (isAgeDropped(s.born)) return;
    const norm = normalizeName(s.name);
    normalizedToOriginal.set(norm, s.name);
    sailorMap.set(s.name, {
      name: s.name,
      g: s.g,
      born: s.born,
      club: s.club,
      school: s.school || '',
      scores: Array(latestRegs.length).fill(null),
      ranks: Array(latestRegs.length).fill(null)
    });
  });
  
  latestRegs.forEach((reg, regIdx) => {
    reg.sailors.forEach(s => {
      if (DROPPED_SAILORS.has(s.name)) return;
      if (isAgeDropped(s.born)) return;
      
      const norm = normalizeName(s.name);
      let matchedKey = normalizedToOriginal.get(norm);
      if (!matchedKey) {
        matchedKey = s.name;
        normalizedToOriginal.set(norm, matchedKey);
        sailorMap.set(matchedKey, {
          name: s.name,
          g: s.g || s.gender,
          born: s.born,
          club: s.club,
          school: s.school || '',
          scores: Array(latestRegs.length).fill(null),
          ranks: Array(latestRegs.length).fill(null)
        });
      }
      const sailorObj = sailorMap.get(matchedKey);
      const rankVal = (s.rank !== undefined && s.rank !== null) ? s.rank : s.nett;
      
      sailorObj.scores[regIdx] = rankVal;
      sailorObj.ranks[regIdx] = rankVal;
      
      if (s.g && !sailorObj.g) sailorObj.g = s.g;
      if (s.born && !sailorObj.born) sailorObj.born = s.born;
      if (s.club && !sailorObj.club) sailorObj.club = s.club;
      if (s.school && !sailorObj.school) sailorObj.school = s.school;
    });
  });

  const computed = [];
  sailorMap.forEach((s, name) => {
    const validScores = s.scores.map((v, regIdx) => {
      if (v === null || v === undefined) {
        const reg = latestRegs[regIdx];
        return getRegattaDnsPenalty(reg);
      }
      return v;
    });
    while (validScores.length < latestRegs.length) {
      const reg = latestRegs[validScores.length];
      validScores.push(getRegattaDnsPenalty(reg));
    }
    const sortedScores = validScores.slice().sort((a, b) => a - b);
    const score = sortedScores.slice(0, 3).reduce((a, b) => a + b, 0);

    const metadata = SAILOR_METADATA[s.name] || {};
    computed.push({
      name: s.name,
      g: s.g,
      born: s.born,
      club: s.club,
      school: s.school,
      score: score,
      scores: s.scores,
      ranks: s.ranks,
      enteredGold: metadata.enteredGold || '—',
      histJun24: metadata.histJun24 || null,
      histDec24: metadata.histDec24 || null,
      histJun25: metadata.histJun25 || null,
      histDec25: metadata.histDec25 || null,
      histJun26: metadata.histJun26 || null
    });
  });

  computed.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    
    const ranksA = a.ranks.map((v, regIdx) => v === null ? getRegattaDnsPenalty(latestRegs[regIdx]) : v).sort((x, y) => x - y);
    const ranksB = b.ranks.map((v, regIdx) => v === null ? getRegattaDnsPenalty(latestRegs[regIdx]) : v).sort((x, y) => x - y);
    
    for (let i = 0; i < Math.max(ranksA.length, ranksB.length); i++) {
      const rA = ranksA[i] !== undefined ? ranksA[i] : getRegattaDnsPenalty(latestRegs[i]);
      const rB = ranksB[i] !== undefined ? ranksB[i] : getRegattaDnsPenalty(latestRegs[i]);
      if (rA !== rB) return rA - rB;
    }
    return 0;
  });
  computed.forEach((s, i) => s.cur = i + 1);
  SAILORS = computed;
}

function getContextPool(sailor, goal) {
  if (goal === 'Nat A' || goal === 'Nat B') {
    return SAILORS.filter(s => s.g === sailor.g && s.born >= (COMP_YEAR - 15)).sort((a,b) => a.score - b.score);
  }
  const ag = ageGroup(sailor.born);
  const bkt = ag >= 12 ? 12 : ag === 11 ? 11 : 10;
  return SAILORS.filter(s => {
    if (s.g !== sailor.g || s.born < (COMP_YEAR - 12)) return false;
    const sag = ageGroup(s.born);
    const sb = sag >= 12 ? 12 : sag === 11 ? 11 : 10;
    return sb === bkt;
  }).sort((a,b) => a.score - b.score);
}

function calcSimScore(sailor, simSailors, rankingMode = false) {
  const simEntry = simSailors.find(x => x.name === sailor.name);
  const simPos = simEntry ? (simEntry.rank !== undefined && simEntry.rank !== null ? simEntry.rank : simEntry.nett) : DNS;
  
  const activeRegs = getActiveRegattas();
  const simulatedRegsList = [
    ...activeRegs,
    {
      name: "Simulated Regatta",
      date: "2026-12-31",
      sailors: [],
      dns: DNS - 1
    }
  ];
  
  const scores = simulatedRegsList.map(reg => {
    if (reg.name === "Simulated Regatta") return simPos;
    const sInReg = reg.sailors.find(x => isSameSailor(x.name, sailor.name));
    const fallbackDns = getRegattaDnsPenalty(reg);
    if (rankingMode) {
      return sInReg ? (sInReg.rank !== undefined && sInReg.rank !== null ? sInReg.rank : (sInReg.nett !== null ? sInReg.nett : fallbackDns)) : null;
    }
    return sInReg ? (sInReg.rank !== undefined && sInReg.rank !== null ? sInReg.rank : sInReg.nett) : null;
  });
  
  const validScores = scores.map((v, regIdx) => v === null ? getRegattaDnsPenalty(simulatedRegsList[regIdx]) : v);
  while (validScores.length < simulatedRegsList.length) {
    const reg = simulatedRegsList[validScores.length];
    validScores.push(getRegattaDnsPenalty(reg));
  }
  const sorted = validScores.sort((a,b) => a - b);
  return sorted.slice(0,3).reduce((a,b) => a + b, 0);
}

function runSimulation() {
  const rows = document.querySelectorAll('#sailor-inputs .sailor-row');
  if (!rows.length) {
    addSailorInput();
    return;
  }
  const entries = [];
  rows.forEach(row => {
    const id = row.id.replace('sr-', '');
    const nm = document.getElementById('ss-' + id).value;
    const pos = parseInt(document.getElementById('sp-' + id).value) || 10;
    if (!nm) return;
    const s = SAILORS.find(x => x.name === nm);
    if (s) entries.push({ sailor: s, pos });
  });
  if (!entries.length) return;
  
  const simSailors = entries.map(e => ({
    name: e.sailor.name,
    g: e.sailor.g,
    born: e.sailor.born,
    club: e.sailor.club,
    nett: e.pos
  }));
  
  const backupRegattas = JSON.parse(JSON.stringify(REGATTAS));
  REGATTAS.push({
    name: "Simulated Regatta",
    date: "2026-12-31",
    sailors: simSailors.map(ss => ({ ...ss, g: ss.g, born: ss.born, club: ss.club })),
    dns: DNS - 1
  });
  
  recomputeSailors();
  const simSq = computeSquads(SAILORS);
  
  REGATTAS = backupRegattas;
  recomputeSailors();
  const baseSq = computeSquads(SAILORS);

  const sortedSim = SAILORS.map(s => {
    const simScore = calcSimScore(s, simSailors);
    return { ...s, simScore };
  }).sort((a,b) => a.simScore - b.simScore);
  
  const rankMap = new Map(sortedSim.map((s,i) => [s.name, i + 1]));
  
  const panel = document.getElementById('results-panel');
  if (!panel) return;
  panel.style.display = 'block';
  
  const activeRegsForSim = getActiveRegattas();
  const last4Regs = activeRegsForSim.slice(-4);
  
  const resultRows = entries.map(e => {
    const s = e.sailor;
    const ns = calcSimScore(s, simSailors);
    const gain = s.score < 900 ? (s.score - ns) : 0;
    const newRank = rankMap.get(s.name) || s.cur, rd = s.cur - newRank;
    const dc = rd > 0 ? 'up' : rd < 0 ? 'dn' : 'eq', dt = rd > 0 ? '▲' + rd : rd < 0 ? '▼' + Math.abs(rd) : '—';
    const oldSq = baseSq.get(s.name) || null, newSq = simSq.get(s.name) || null;
    const sqD = oldSq !== newSq 
      ? `<span style="opacity:.5;text-decoration:line-through;font-size:9px;font-family:var(--mono)">${escapeHtml(String(oldSq)) || '—'}</span> ${squadBadge(newSq)}`
      : squadBadge(newSq);
    
    const last4Html = last4Regs.map(reg => {
      const sInReg = reg.sailors.find(x => isSameSailor(x.name, s.name));
      const v = sInReg ? (sInReg.rank !== undefined && sInReg.rank !== null ? sInReg.rank : sInReg.nett) : null;
      const safeTitle = escapeHtml(reg.name);
      return `<span style="font-family:var(--mono);font-size:9px;padding:1px 4px;background:var(--bg2);border:1px solid var(--border);border-radius:2px;color:${v !== null ? 'var(--text)' : 'var(--text3)'}" title="${safeTitle}">${v !== null ? v : '—'}</span>`;
    }).join('');
    
    return `<div class="res-row">
      <div><div class="res-name">${escapeHtml(s.name)}</div><div class="res-sub">${squadBadge(oldSq)} #${s.cur}</div></div>
      <div><span class="fin-tag">P${e.pos}</span></div>
      <div><span class="s-old">${Math.floor(s.score)}</span></div>
      <div><span class="s-new">${ns}</span></div>
      <div><span class="chg ${gain > 0 ? 'chg-up' : gain < 0 ? 'chg-dn' : 'chg-eq'}">${gain > 0 ? '−' + gain : gain < 0 ? '+' + Math.abs(gain) : '0'}</span></div>
      <div><span class="rnk-was">was #${s.cur}</span><span class="rnk-new">#${newRank}</span><span class="chg ${dc}" style="font-size:9px">${dt}</span></div>
      <div>${sqD}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">${last4Html}</div>
    </div>`;
  }).join('');
  
  document.getElementById('results-body').innerHTML = resultRows;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function runTarget(){
  if(!SAILORS.length)return;
  const nm=document.getElementById('targetSailor').value,goal=document.getElementById('targetGoal').value;
  const out=document.getElementById('target-output');
  const sliderContainer = document.getElementById('target-slider-container');
  if(!nm||!goal){
    out.innerHTML='';
    if (sliderContainer) sliderContainer.style.display = 'none';
    return;
  }
  const sailor=SAILORS.find(s=>s.name===nm);if(!sailor)return;
  const gl=goal==='Nat A'?'National A':goal==='Nat B'?'National B':'Development Squad';
  const gpc=goal==='Nat A'?'gt-a':goal==='Nat B'?'gt-b':'gt-ds';
  const agN=ageGroup(sailor.born),agL=agN>=13?'13yo':agN===12?'12yo':agN===11?'11&U':'10&U';
  const gL=sailor.g==='M'?'boys':'girls',sqOrd={'Nat A':1,'Nat B':2,'DS':3};
  const baseSq=computeSquads(SAILORS),curSq=EXCLUDED.has(sailor.name)?null:(baseSq.get(sailor.name)||null);
  const already=(sqOrd[curSq]||99)<=(sqOrd[goal]||99);
  const latestRegs = getActiveRegattas();

  function testQualify(pos) {
    const simSailors = [{ name: sailor.name, nett: pos, rank: pos }];
    const simScores = SAILORS.map(s => {
      const score = calcSimScore(s, simSailors, true);
      return { 
        ...s, 
        score: score,
        simScore: score,
        ranks: [...s.ranks, isSameSailor(s.name, sailor.name) ? pos : null] 
      };
    });
    
    const simRegs = [...latestRegs, { dns: DNS - 1 }];
    simScores.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const ranksA = a.ranks.map((v, regIdx) => v === null ? getRegattaDnsPenalty(simRegs[regIdx]) : v).sort((x, y) => x - y);
      const ranksB = b.ranks.map((v, regIdx) => v === null ? getRegattaDnsPenalty(simRegs[regIdx]) : v).sort((x, y) => x - y);
      for (let i = 0; i < Math.max(ranksA.length, ranksB.length); i++) {
        const rA = ranksA[i] !== undefined ? ranksA[i] : getRegattaDnsPenalty(simRegs[i]);
        const rB = ranksB[i] !== undefined ? ranksB[i] : getRegattaDnsPenalty(simRegs[i]);
        if (rA !== rB) return rA - rB;
      }
      return 0;
    });
    simScores.forEach((s, idx) => s.cur = idx + 1);
    
    const sq = computeSquads(simScores).get(sailor.name);
    return sq && (sqOrd[sq]||99)<=(sqOrd[goal]||99);
  }

  // Optimize target search to O(log N) iterations with Binary Search
  let posNeeded = null;
  let low = 1, high = 200;
  while(low <= high) {
    const mid = Math.floor((low + high) / 2);
    if(testQualify(mid)) {
      posNeeded = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const pool=getContextPool(sailor,goal);
  const pIdx=pool.findIndex(s=>s.name===sailor.name);
  const windowSize = goal === 'Nat A' ? 3 : 2;
  const ctx = pool.slice(Math.max(0, pIdx - windowSize), Math.min(pool.length, pIdx + windowSize + 1));

  targetCachedData = {
    sailor, goal, gl, gpc, agL, gL, sqOrd, baseSq, curSq, already, posNeeded, ctx, out, pool
  };

  if (posNeeded && !already) {
    if (sliderContainer) {
      sliderContainer.style.display = 'block';
      const slider = document.getElementById('targetSlider');
      if (slider) {
        slider.max = Math.max(150, posNeeded + 20);
        slider.value = posNeeded;
        document.getElementById('target-slider-val').textContent = 'P' + posNeeded;
      }
    }
  } else {
    if (sliderContainer) sliderContainer.style.display = 'none';
  }

  renderTargetSimulation(posNeeded || 1);
}

function updateTargetSliderVal(val) {
  document.getElementById('target-slider-val').textContent = 'P' + val;
  renderTargetSimulation(parseInt(val));
}

function renderTargetSimulation(simulatedPos) {
  if (!targetCachedData) return;
  const { sailor, goal, gl, gpc, agL, gL, sqOrd, baseSq, curSq, already, posNeeded, ctx, out, pool } = targetCachedData;
  const latestRegs = getActiveRegattas();
  const safeSailorName = escapeHtml(sailor.name);
  const safeGl = escapeHtml(gl);
  const safeAgL = escapeHtml(agL);
  const safeGL = escapeHtml(gL);
  const safeCurSq = escapeHtml(curSq || 'None');
  const poolLabel = escapeHtml(goal === 'Nat A' ? gL.toUpperCase() : (agL + ' ' + gL).toUpperCase());

  const simSailors = [{ name: sailor.name, nett: simulatedPos, rank: simulatedPos }];
  const projScore = calcSimScore(sailor, simSailors, true);

  const simScoresM = SAILORS.map(s => {
    const score = calcSimScore(s, simSailors, true);
    return { 
      ...s, 
      score: score,
      simScore: score,
      ranks: [...s.ranks, isSameSailor(s.name, sailor.name) ? simulatedPos : null] 
    };
  });
  const simRegsM = [...latestRegs, { dns: DNS - 1 }];
  simScoresM.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const ranksA = a.ranks.map((v, regIdx) => v === null ? getRegattaDnsPenalty(simRegsM[regIdx]) : v).sort((x, y) => x - y);
    const ranksB = b.ranks.map((v, regIdx) => v === null ? getRegattaDnsPenalty(simRegsM[regIdx]) : v).sort((x, y) => x - y);
    for (let i = 0; i < Math.max(ranksA.length, ranksB.length); i++) {
      const rA = ranksA[i] !== undefined ? ranksA[i] : getRegattaDnsPenalty(simRegsM[i]);
      const rB = ranksB[i] !== undefined ? ranksB[i] : getRegattaDnsPenalty(simRegsM[i]);
      if (rA !== rB) return rA - rB;
    }
    return 0;
  });
  simScoresM.forEach((s, idx) => s.cur = idx + 1);
  const simSqM = computeSquads(simScoresM);
  
  const blocking = SAILORS.filter(s => {
    if (s.name === sailor.name) return false;
    const wasIn = (sqOrd[baseSq.get(s.name)] || 99) <= (sqOrd[goal] || 99);
    const nowIn = (sqOrd[simSqM.get(s.name)] || 99) <= (sqOrd[goal] || 99);
    return wasIn && !nowIn;
  });
  
  const ctxT = buildCtxTable(ctx, sailor, baseSq, simSqM, simulatedPos);
  const wiS = buildWhatIf(sailor, goal, ctx);
  
  let html = '';
  if (already) {
    html = `<div class="tgt-res"><div class="tgt-res-hdr"><h3>${safeSailorName}</h3><span class="goal-tag ${gpc}">${safeGl}</span><span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${safeAgL} · ${safeGL}</span></div>
      <div class="tgt-body"><div style="padding:12px 14px;background:var(--accent-l);border:1px solid rgba(26,71,42,.2);border-radius:var(--r);color:var(--accent);font-size:12px;font-weight:600;margin-bottom:14px">✓ Already allocated to <strong>${escapeHtml(curSq)}</strong> — meets or exceeds ${safeGl}.</div>
      <div class="sec-lbl" style="margin-top:0">Pool context — ${poolLabel}</div>${ctxT}${wiS}</div></div>`;
  } else if (!posNeeded) {
    html = `<div class="tgt-res"><div class="tgt-res-hdr"><h3>${safeSailorName}</h3><span class="goal-tag ${gpc}">${safeGl}</span></div>
      <div class="tgt-body"><div class="impossible">Even P1 at the next regatta cannot reach <strong>${safeGl}</strong> based on current standings.</div>
      <div class="sec-lbl">Pool context — ${poolLabel}</div>${ctxT}${wiS}</div></div>`;
  } else {
    const isCustom = simulatedPos !== posNeeded;
    const alertBg = isCustom ? 'var(--bg2)' : 'var(--accent-l)';
    const alertBorder = isCustom ? 'var(--border)' : 'rgba(26,71,42,.15)';
    const alertText = isCustom 
      ? `Simulated Scenario: finish of <strong>P${escapeHtml(String(simulatedPos))}</strong> yields score <strong>${escapeHtml(String(projScore))}</strong>` 
      : `Finish <strong>P${escapeHtml(String(posNeeded))} or better</strong> at the next regatta. Score: ${Math.floor(sailor.score)} → <strong>${escapeHtml(String(projScore))}</strong>`;

    html = `<div class="tgt-res"><div class="tgt-res-hdr"><h3>${safeSailorName}</h3><span class="goal-tag ${gpc}">${safeGl}</span><span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${safeAgL} · ${safeGL}</span></div>
      <div class="tgt-body">
        <div class="tgt-sum">
          <div class="tgt-stat"><div class="tgt-stat-lbl">Current squad</div><div class="tgt-stat-val" style="font-size:14px">${safeCurSq}</div><div class="tgt-stat-sub">score: ${Math.floor(sailor.score)}</div></div>
          <div class="tgt-stat"><div class="tgt-stat-lbl">Target Minimum</div><div class="tgt-stat-val">P${escapeHtml(String(posNeeded))}</div><div class="tgt-stat-sub">score needed → ${escapeHtml(String(projScore))}</div></div>
          <div class="tgt-stat"><div class="tgt-stat-lbl">Age group</div><div class="tgt-stat-val" style="font-size:14px">${safeAgL}</div><div class="tgt-stat-sub">${safeGL} pool</div></div>
        </div>
        <div class="sc-item" style="border-color:${alertBorder};background:${alertBg}">
          <div class="sc-icon">${isCustom ? '⚙' : '◎'}</div><div><div class="sc-title">${isCustom ? 'Simulated scenario' : 'Performance needed'}</div>
          <div class="sc-desc">${alertText}</div></div>
        </div>
        ${blocking.length ? `<div class="sc-item" style="border-color:rgba(122,53,0,.15);background:var(--accent3-l)">
          <div class="sc-icon">⚡</div><div><div class="sc-title">Sailors displaced (${blocking.length})</div>
          <div class="sc-desc">${blocking.map(b => `<strong>${escapeHtml(b.name)}</strong> (score ${Math.floor(b.score)}, ${escapeHtml(baseSq.get(b.name) || '—')})`).join('<br>')}
          <br><span style="color:var(--text3);font-size:10px">Each must finish worse than P${escapeHtml(String(simulatedPos))} or not compete to be displaced.</span></div></div>` : ''}
        <div class="sec-lbl">Pool context — ${poolLabel}</div>${ctxT}${wiS}
      </div></div>`;
  }
  out.innerHTML = html;
}

function buildCtxTable(ctx,sailor,baseSq,simSqM,posNeeded){
  const latestRegs = getActiveRegattas();
  const rows=ctx.map((s,i)=>{
    const isSelf=s.name===sailor.name,isExcl=EXCLUDED.has(s.name);
    const curSq=isExcl?null:(baseSq.get(s.name)||null);
    const simSq=simSqM?(simSqM.get(s.name)||null):null;
    const changed=simSq&&simSq!==curSq;
    const bg=isSelf?'class="hi-self"':'',rowSt=isExcl&&!isSelf?'opacity:.4;':'';
    
    let ns = null;
    if (isSelf && posNeeded) {
      ns = calcSimScore(s, [{ name: s.name, nett: posNeeded, rank: posNeeded }], true);
    }
    const scoreD=ns!=null?`<span style="color:var(--text3);text-decoration:line-through;font-size:10px">${Math.floor(s.score)}</span> <strong style="color:var(--accent)">${escapeHtml(String(ns))}</strong>`:(s.score<900?Math.floor(s.score):'—');
    const exclTag=isExcl?`<span class="excl-tag">${escapeHtml(EXCLUDED.get(s.name))}</span>`:'';
    const sqCell=isExcl?'<span class="badge b-n">Excl.</span>':changed?`${squadBadge(curSq)}<span style="color:var(--accent);font-family:var(--mono);font-size:9px"> →${escapeHtml(simSq)}</span>`:squadBadge(curSq);
    
    const ev = latestRegs.map(reg => {
      const sInReg = reg.sailors.find(x => isSameSailor(x.name, s.name));
      const val = sInReg ? (sInReg.rank !== undefined && sInReg.rank !== null ? sInReg.rank : sInReg.nett) : null;
      return sInReg ? `${escapeHtml(String(reg.name).substring(0, 5))} ${escapeHtml(String(val))}` : null;
    }).filter(Boolean).join(' · ');

    return`<tr ${bg} style="${rowSt}">
      <td class="sub-c">#${i+1}</td>
      <td style="font-weight:${isSelf?700:500};color:${isSelf?'var(--accent)':'inherit'}">${escapeHtml(s.name)}${exclTag}</td>
      <td class="sub-c">${escapeHtml(s.g)}</td>
      <td class="sub-c">${escapeHtml(String(s.born ?? ''))}</td>
      <td class="sub-c" style="font-size:10px">${escapeHtml(s.club || '')}</td>
      <td>${sqCell}</td>
      <td style="text-align:center">${scoreD}</td>
      <td style="font-size:9px;color:var(--text3)">${ev}</td>
    </tr>`;
  }).join('');
  return `<table class="ct">
    <thead>
      <tr class="ct-hdr">
        <td style="width:35px">Pos</td>
        <td>Sailor</td>
        <td style="width:25px">G</td>
        <td style="width:50px">Born</td>
        <td style="width:55px">Club</td>
        <td style="width:140px">Squad (Before → Sim)</td>
        <td style="width:70px;text-align:center">Score</td>
        <td>History</td>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`;
}

function buildWhatIf(sailor, goal, ctx) {
  const scenarios = [1, 3, 5, 10, 20, 50];
  const sqOrd = { 'Nat A': 1, 'Nat B': 2, 'DS': 3 };
  let rows = scenarios.map(pos => {
    const ns = calcSimScore(sailor, [{ name: sailor.name, nett: pos, rank: pos }], true);
    
    const backupRegattas = JSON.parse(JSON.stringify(REGATTAS));
    REGATTAS.push({
      name: "Simulated Regatta",
      date: "2026-12-31",
      sailors: [{ name: sailor.name, g: sailor.g, born: sailor.born, club: sailor.club, nett: pos, rank: pos }],
      dns: DNS - 1
    });
    recomputeSailors();
    const sq = computeSquads(SAILORS).get(sailor.name);
    REGATTAS = backupRegattas;
    recomputeSailors();

    const ok = sq && (sqOrd[sq] || 99) <= (sqOrd[goal] || 99);
    const bg = ok ? 'style="background:var(--accent-l);"' : '';
    return `<div class="wi-row" ${bg}>
      <div>
        <span class="fin-tag">P${pos}</span>
        <span style="font-size:11px;margin-left:8px">Score will be <strong>${ns}</strong></span>
      </div>
      <div style="text-align:right">
        ${squadBadge(sq)}
      </div>
    </div>`;
  }).join('');
  return `<div class="sec-lbl">What-if scenarios for the next regatta</div>${rows}`;
}
