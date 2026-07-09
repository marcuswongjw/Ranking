function switchView(viewId, navBtn, skipHash) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + viewId);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  // Prefer the passed navBtn, fall back to any nav-item with matching data-view
  const matchedNav = navBtn || document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (matchedNav) matchedNav.classList.add('active');

  lastMainView = viewId;
  destroyCharts();

  // Update the URL hash so each tab has its own URL (skip on back/forward navigation
  // to avoid duplicate history entries).
  if (!skipHash) {
    const newHash = '#' + viewId;
    if (window.location.hash !== newHash) {
      history.pushState({ viewId }, '', newHash);
    }
  }

  if (viewId === 'rankings') {
    renderRankingsPanel();
  } else if (viewId === 'regattas') {
    renderRegattasPanel();
    if (navBtn || !CURRENT_SELECTED_REGATTA) {
      renderSpecificRegattaResults(null);
    } else {
      renderSpecificRegattaResults(CURRENT_SELECTED_REGATTA);
    }
  } else if (viewId === 'major-comps') {
    renderMajorCompsPanel();
  } else if (viewId === 'hist-gold') {
    renderHistGoldPanel();
  } else if (viewId === 'fleet') {
    renderFleetPanel();
  } else if (viewId === 'charts') {
    if (typeof renderCharts === 'function') renderCharts();
  } else if (viewId === 'results') {
    if (typeof renderSpecificRegattaResults === 'function') renderSpecificRegattaResults();
  } else if (viewId === 'exclusions') {
    if (typeof renderExclusions === 'function') renderExclusions();
  }
}

function openSailorModal(sailorName, skipHash) {
  const allSystem = getAllSailorsInSystem();
  let sailor = allSystem.find(s => isSameSailor(s.name, sailorName));
  const meta = SAILOR_METADATA[sailorName] || {};

  if (!sailor) {
    sailor = {
      name: sailorName,
      g: meta.g || 'M',
      born: meta.born || '',
      club: meta.club || '',
      school: meta.school || ''
    };
  }

  document.getElementById('sm-orig-name').value = sailor.name;
  document.getElementById('sm-name').value = sailor.name;
  document.getElementById('sm-gender').value = sailor.g || meta.g || 'M';
  document.getElementById('sm-born').value = sailor.born || meta.born || '';
  document.getElementById('sm-club').value = sailor.club || meta.club || '';
  document.getElementById('sm-school').value = sailor.school || meta.school || '';

  document.getElementById('sm-entered-gold').value = meta.enteredGold || '—';

  const major = meta.majorComps || {};
  const worlds = major.worlds || [];
  const euros = major.euros || [];
  const asians = major.asians || [];
  const seagames = major.seagames || [];
  
  document.querySelectorAll('.mc-worlds').forEach(cb => cb.checked = worlds.includes(parseInt(cb.value)));
  document.querySelectorAll('.mc-euros').forEach(cb => cb.checked = euros.includes(parseInt(cb.value)));
  document.querySelectorAll('.mc-asians').forEach(cb => cb.checked = asians.includes(parseInt(cb.value)));
  document.querySelectorAll('.mc-seagames').forEach(cb => cb.checked = seagames.includes(parseInt(cb.value)));

  // Combined Standings & Squad History: one row per half-year snapshot, with
  // the rank override input (auto rank as placeholder) and the squad status
  // select for the squad period that snapshot determines. Squad keys are
  // shared with the rankings-table lock dropdowns.
  const histSquadContainer = document.getElementById('sm-hist-squad-container');
  if (histSquadContainer) {
    const periods = [
      { snap: 'Jun 24', date: '2024-06-30', histId: 'sm-override-jun24', metaKey: 'histJun24', squadKey: 'squadJul24', squadLbl: 'Jul 24' },
      { snap: 'Dec 24', date: '2024-12-31', histId: 'sm-override-dec24', metaKey: 'histDec24', squadKey: 'squadJan25', squadLbl: 'Jan 25' },
      { snap: 'Jun 25', date: '2025-06-30', histId: 'sm-override-jun25', metaKey: 'histJun25', squadKey: 'squadJul25', squadLbl: 'Jul 25' },
      { snap: 'Dec 25', date: '2025-12-31', histId: 'sm-override-dec25', metaKey: 'histDec25', squadKey: 'squadJan26', squadLbl: 'Jan 26' },
      { snap: 'Jun 26', date: '2026-06-30', histId: 'sm-override-jun26', metaKey: 'histJun26', squadKey: 'squadJul26', squadLbl: 'Jul 26' }
    ];
    histSquadContainer.innerHTML = periods.map(p => {
      const rankVal = meta[p.metaKey] !== undefined && meta[p.metaKey] !== null ? meta[p.metaKey] : '';
      const autoRank = getHistoricalRank(sailor.name, p.date);
      const curSquad = meta[p.squadKey] || '';
      return `<div style="display:grid; grid-template-columns:86px 1fr 1fr; gap:8px; align-items:center;">
        <span style="font-family:var(--mono); font-size:10.5px; color:var(--text2);">${p.snap}</span>
        <input type="number" id="${p.histId}" value="${rankVal}" placeholder="${autoRank !== '—' ? autoRank : 'Auto'}"
               style="width:100%; height:28px; font-size:11px;" title="Standing as of ${p.snap} (blank = auto)">
        <select class="sm-squad-select" data-field="${p.squadKey}" style="width:100%; height:28px; font-size:11px;" title="Squad for ${p.squadLbl}">
          <option value="">— ${p.squadLbl} —</option>
          ${['Nat A', 'Nat B', 'DS'].map(o => `<option value="${o}" ${curSquad === o ? 'selected' : ''}>${o} (${p.squadLbl})</option>`).join('')}
        </select>
      </div>`;
    }).join('');
  }

  // Show modal view
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-sailor-analysis').classList.add('active');

  renderSailorPerformanceSummary(sailor);
  updateSailorProfileFleetControls();

  // Give each sailor profile its own URL (skip on back/forward navigation)
  if (!skipHash) {
    const newHash = '#sailor/' + encodeURIComponent(sailor.name);
    if (window.location.hash !== newHash) {
      history.pushState({ sailor: sailor.name }, '', newHash);
    }
  }
}

function closeSailorModal() {
  destroyCharts();
  switchView(lastMainView);
}

function saveSailorProfile() {
  if (!requireEditor()) return;
  const origName = document.getElementById('sm-orig-name').value;
  const newName = document.getElementById('sm-name').value.trim();
  const gender = document.getElementById('sm-gender').value;
  const bornRaw = document.getElementById('sm-born').value;
  const bornParsed = parseBirthYearInput(bornRaw);
  if (bornRaw !== '' && (bornParsed === null || Number.isNaN(bornParsed))) {
    alert(`Please enter a valid Birth Year (between ${COMP_YEAR - 20} and ${COMP_YEAR}).`);
    return;
  }
  const born = bornParsed;
  const club = document.getElementById('sm-club').value.trim();
  const school = document.getElementById('sm-school').value.trim();
  
  const enteredGold = document.getElementById('sm-entered-gold').value;
  const histJun24Raw = document.getElementById('sm-override-jun24').value;
  const histDec24Raw = document.getElementById('sm-override-dec24').value;
  const histJun25Raw = document.getElementById('sm-override-jun25').value;
  const histDec25Raw = document.getElementById('sm-override-dec25').value;
  const histJun26Raw = document.getElementById('sm-override-jun26').value;
  // Use Number() so decimals like "1.5" are rejected (parseInt would truncate them).
  const parseOptionalPositiveRank = (raw) => {
    if (raw === '') return null;
    const n = Number(String(raw).trim());
    if (!Number.isInteger(n) || n < 1) return NaN;
    return n;
  };
  const histJun24 = parseOptionalPositiveRank(histJun24Raw);
  const histDec24 = parseOptionalPositiveRank(histDec24Raw);
  const histJun25 = parseOptionalPositiveRank(histJun25Raw);
  const histDec25 = parseOptionalPositiveRank(histDec25Raw);
  const histJun26 = parseOptionalPositiveRank(histJun26Raw);
  const invalidHistRank = [histJun24, histDec24, histJun25, histDec25, histJun26].some(v => v !== null && (Number.isNaN(v) || !Number.isInteger(v) || v < 1));
  if (invalidHistRank) {
    alert('Historical rank overrides must be whole numbers greater than 0 when provided.');
    return;
  }

  if (!newName) {
    alert("Name cannot be empty.");
    return;
  }
  
  // Validate all regatta rank inputs first so we never partially apply a save.
  const regattaScoreUpdates = [];
  for (let regIdx = 0; regIdx < REGATTAS.length; regIdx++) {
    const scoreInput = document.querySelector(`.sm-reg-score[data-reg-idx="${regIdx}"]`);
    // Empty field = no participation → default DNS in rankings (unless/until edited).
    const scoreVal = scoreInput && scoreInput.value.trim() !== ''
      ? parseOptionalPositiveInt(scoreInput.value)
      : null;
    if (Number.isNaN(scoreVal)) {
      alert('Regatta ranks must be whole numbers greater than 0 when provided.');
      return;
    }
    regattaScoreUpdates.push(scoreVal);
  }

  REGATTAS.forEach((reg, regIdx) => {
    let sIdx = reg.sailors.findIndex(x => isSameSailor(x.name, origName));
    const scoreVal = regattaScoreUpdates[regIdx];
    
    if (sIdx !== -1) {
      reg.sailors[sIdx].name = newName;
      reg.sailors[sIdx].g = gender;
      reg.sailors[sIdx].born = born;
      reg.sailors[sIdx].club = club;
      reg.sailors[sIdx].school = school;
      // null rank/nett = did not participate → scoring + table use DNS penalty
      reg.sailors[sIdx].nett = scoreVal;
      reg.sailors[sIdx].rank = scoreVal;
    } else if (scoreVal !== null) {
      // Edited rank for a regatta they were not in → add participation
      reg.sailors.push({
        name: newName,
        g: gender,
        born: born,
        club: club,
        school: school,
        nett: scoreVal,
        rank: scoreVal
      });
    }
  });
  
  const prevMeta = SAILOR_METADATA[origName] || {};
  if (origName !== newName) {
    if (EXCLUDED.has(origName)) {
      const reason = EXCLUDED.get(origName);
      EXCLUDED.delete(origName);
      EXCLUDED.set(newName, reason);
    }
    // Keep dropped status attached to the sailor across renames
    if (isDroppedSailor(origName)) {
      unmarkSailorDropped(origName);
      markSailorDropped(newName);
    }
    delete SAILOR_METADATA[origName];
  }
  
  const mcWorlds = Array.from(document.querySelectorAll('.mc-worlds:checked')).map(cb => parseInt(cb.value));
  const mcEuros = Array.from(document.querySelectorAll('.mc-euros:checked')).map(cb => parseInt(cb.value));
  const mcAsians = Array.from(document.querySelectorAll('.mc-asians:checked')).map(cb => parseInt(cb.value));
  const mcSeagames = Array.from(document.querySelectorAll('.mc-seagames:checked')).map(cb => parseInt(cb.value));

  // Spread prevMeta first so fields not managed by this form (e.g. the
  // squadJan/squadJul lock keys) survive a profile save or rename.
  SAILOR_METADATA[newName] = {
    ...prevMeta,
    enteredGold,
    histJun24,
    histDec24,
    histJun25,
    histDec25,
    histJun26,
    g: gender,
    born: born,
    club: club,
    school: school,
    majorComps: {
      worlds: mcWorlds,
      euros: mcEuros,
      asians: mcAsians,
      seagames: mcSeagames
    }
  };

  // Squad status per period (shared keys with the rankings lock dropdowns)
  document.querySelectorAll('.sm-squad-select').forEach(sel => {
    const field = sel.getAttribute('data-field');
    if (!field) return;
    if (sel.value) {
      SAILOR_METADATA[newName][field] = sel.value;
    } else {
      delete SAILOR_METADATA[newName][field];
    }
  });

  recomputeSailors();
  saveData();
  closeSailorModal();
  renderAll();
}



function populateTargetDropdown() {
  const sel = document.getElementById('targetSailor');
  if (!sel) return;
  const cur = sel.value;
  sel.replaceChildren(createSelectOption('', '— choose sailor —'));

  SAILORS.forEach(s => {
    const genderText = s.g === 'M' ? 'Boy' : 'Girl';
    const option = createSelectOption(s.name, `${s.cur}. ${s.name} (${genderText}, ${s.born})`);
    sel.appendChild(option);
  });

  if (cur && Array.from(sel.options).some(o => o.value === cur)) {
    sel.value = cur;
  }
}

function populateSimDropdown(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const cur = sel.value;
  sel.replaceChildren(createSelectOption('', '— select —'));

  SAILORS.forEach(s => {
    const option = createSelectOption(s.name, `${s.cur}. ${s.name} (${s.g}, ${s.born})`);
    sel.appendChild(option);
  });

  if (cur && Array.from(sel.options).some(o => o.value === cur)) {
    sel.value = cur;
  }
}

function populateExclDropdown() {
  const sel = document.getElementById('exclSelect');
  if (!sel) return;
  const cur = sel.value;
  sel.replaceChildren(createSelectOption('', '— choose sailor —'));

  SAILORS.forEach(s => {
    const option = createSelectOption(s.name, `${s.cur}. ${s.name} (${s.g}, ${s.born})`);
    sel.appendChild(option);
  });

  if (cur && Array.from(sel.options).some(o => o.value === cur)) {
    sel.value = cur;
  }
}

function populateResultsDropdown() {
  const sel = document.getElementById('resultsRegattaSelect');
  if (!sel) return;
  const cur = sel.value;
  sel.replaceChildren(createSelectOption('', '— select regatta —'));

  REGATTAS.forEach(r => {
    const option = createSelectOption(r.name, r.name);
    sel.appendChild(option);
  });

  if (cur && Array.from(sel.options).some(o => o.value === cur)) {
    sel.value = cur;
  }
}

let CURRENT_SELECTED_REGATTA = null;

function renderSpecificRegattaResults(regName) {
  try {
    const sel = document.getElementById('resultsRegattaSelect');
    const wrap = document.getElementById('specific-regatta-results-wrap');
    const body = document.getElementById('specific-regatta-body');
    const landing = document.getElementById('regatta-landing-view');
    if (!wrap || !body) return;

    if (regName === undefined) {
      regName = CURRENT_SELECTED_REGATTA || (sel ? sel.value : null);
    }
    
    if (!regName) {
      CURRENT_SELECTED_REGATTA = null;
      wrap.style.display = 'none';
      if (landing) landing.style.display = 'block';
      if (sel) sel.value = '';
      return;
    }

    CURRENT_SELECTED_REGATTA = regName;
    const reg = REGATTAS.find(r => r.name === regName);
    if (!reg) {
      CURRENT_SELECTED_REGATTA = null;
      wrap.style.display = 'none';
      if (landing) landing.style.display = 'block';
      if (sel) sel.value = '';
      return;
    }

    if (landing) landing.style.display = 'none';
    wrap.style.display = 'block';

    if (sel) {
      sel.value = regName;
    }

    const nameEl = document.getElementById('specific-regatta-name');
    if (nameEl) nameEl.textContent = reg.name;

    const dateInput = document.getElementById('specific-regatta-date-input');
    if (dateInput) {
      dateInput.value = reg.date || '';
      dateInput.disabled = !isEditor();
    }

    const dnsInput = document.getElementById('specific-regatta-dns');
    if (dnsInput) {
      dnsInput.value = reg.dns !== undefined && reg.dns !== null ? reg.dns : '';
      dnsInput.placeholder = reg.sailors ? reg.sailors.length : '';
      dnsInput.disabled = !isEditor();
    }

    // Document Upload/Download slot
    const docContainer = document.getElementById('specific-regatta-doc-container');
    if (docContainer) {
      if (reg.documentUrl) {
        const docName = reg.documentName || 'Download Results Document';
        let deleteBtn = '';
        if (isEditor()) {
          deleteBtn = `<button id="delete-regatta-doc-btn" style="background:none; border:none; color:var(--red); font-size:12px; cursor:pointer; font-weight:600; display:inline-flex; align-items:center; gap:2px; margin-left: 6px;" title="Delete document">🗑️ Remove</button>`;
        }
        docContainer.innerHTML = `
          <a href="${escapeHtml(reg.documentUrl)}" target="_blank" style="color:var(--accent); text-decoration:underline; font-weight:600; display:inline-flex; align-items:center; gap:4px; font-size:11.5px;">
            📄 ${escapeHtml(docName)}
          </a>
          ${deleteBtn}
        `;
      } else {
        if (isEditor()) {
          docContainer.innerHTML = `
            <button id="upload-regatta-doc-btn" style="background:var(--bg3); border:1px solid var(--border); border-radius:var(--r); padding:4px 8px; font-size:11px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-family:var(--mono);">
              📎 Upload Document
            </button>
            <input type="file" id="regattaDocFileInput" style="display:none;">
          `;
        } else {
          docContainer.innerHTML = `<span style="color:var(--text3); font-style:italic; font-size:11px;">No document uploaded</span>`;
        }
      }
    }

    const regSailors = (reg.sailors || []).filter(s => s && s.name);
    const sortedSailors = [...regSailors].sort((a, b) => {
      const valA = (a.rank !== undefined && a.rank !== null) ? a.rank : ((a.nett !== undefined && a.nett !== null) ? a.nett : null);
      const valB = (b.rank !== undefined && b.rank !== null) ? b.rank : ((b.nett !== undefined && b.nett !== null) ? b.nett : null);
      if (valA === null && valB === null) return a.name.localeCompare(b.name);
      if (valA === null) return 1;
      if (valB === null) return -1;
      return valA - valB;
    });

    body.innerHTML = sortedSailors.map((s, idx) => {
      const safeName = escapeHtml(s.name || 'Unknown');
      const rankVal = s.rank !== undefined && s.rank !== null ? s.rank : '';
      const pointsVal = s.nett !== undefined && s.nett !== null ? s.nett : '';
      
      const base = getRegattaPercentileBase(reg);
      const r = s.rank !== undefined && s.rank !== null ? s.rank : s.nett;
      const pct = base > 0 && r !== null && r !== undefined ? (r / base) * 100 : 100;
      let pctLabel, pctColor, pctBg;
      if (pct <= 25) { pctLabel = 'Top 25%'; pctColor = 'var(--accent)'; pctBg = 'var(--accent-l)'; }
      else if (pct <= 50) { pctLabel = 'Top 50%'; pctColor = 'var(--accent2)'; pctBg = 'var(--accent2-l)'; }
      else if (pct <= 75) { pctLabel = 'Top 75%'; pctColor = 'var(--accent3)'; pctBg = 'var(--accent3-l)'; }
      else { pctLabel = 'Bottom 25%'; pctColor = 'var(--red)'; pctBg = 'var(--red-l)'; }
      
      return `<tr>
        <td class="rank-c">${idx + 1}</td>
        <td class="name-c" data-sailor="${safeName}" style="cursor:pointer; color:var(--accent); font-weight:600; text-decoration:underline;">${safeName}</td>
        <td class="sub-c">${escapeHtml(s.g || '—')}</td>
        <td class="sub-c">${escapeHtml(String(s.born || '—'))}</td>
        <td class="sub-c" style="font-size:10px">${escapeHtml(s.club || '—')}</td>
        <td style="text-align:center;">
          <input type="number" class="reg-rank-input" data-reg="${escapeHtml(reg.name)}" data-sailor="${safeName}" value="${rankVal}"
                 style="width:70px; height:24px; text-align:center; padding:2px; font-family:var(--mono);" ${!isEditor() ? 'disabled' : ''}>
        </td>
        <td style="text-align:center;">
          <input type="number" class="reg-points-input" data-reg="${escapeHtml(reg.name)}" data-sailor="${safeName}" value="${pointsVal}"
                 style="width:70px; height:24px; text-align:center; padding:2px; font-family:var(--mono); font-weight:600; color:var(--accent2);" ${!isEditor() ? 'disabled' : ''}>
        </td>
        <td style="text-align:center;"><span class="pct-b" style="background:${pctBg};color:${pctColor};font-size:9.5px;padding:3px 6px;border-radius:3px;font-weight:600">${pctLabel}</span></td>
        <td class="table-editor-only" style="text-align:center;">
          <button class="reg-sailor-delete-btn" data-reg="${escapeHtml(reg.name)}" data-sailor="${safeName}"
                  style="background:none; border:none; color:var(--red); cursor:pointer; font-weight:bold; font-size:14px;" title="Remove Sailor" ${BULK_EDIT_MODE ? 'disabled' : ''}>✕</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:24px">No results entered yet.</td></tr>';

    if (typeof updateBulkEditUI === 'function') updateBulkEditUI();
  } catch (err) {
    console.error("Error in renderSpecificRegattaResults:", err);
  }
}

function populateRegattaCheckboxList() {
  const container = document.getElementById('regatta-checkboxes-list');
  if (!container) return;
  
  const sorted = [...REGATTAS].sort((a, b) => {
    const dA = a.date ? new Date(a.date) : new Date(0);
    const dB = b.date ? new Date(b.date) : new Date(0);
    return dA - dB;
  });
  
  const html = sorted.map((reg) => {
    const safeName = escapeHtml(reg.name);
    const checked = (SELECTED_REGATTA_NAMES === null || SELECTED_REGATTA_NAMES.includes(reg.name)) ? 'checked' : '';
    return `<label class="regatta-cb-row" style="display:flex; align-items:center; gap:8px; padding:6px 10px; cursor:pointer; font-size:11.5px; border-radius:4px; font-family:var(--mono);">
      <input type="checkbox" class="regatta-select-cb" value="${safeName}" ${checked} style="width:15px; height:15px; cursor:pointer;">
      <span>${safeName}</span>
    </label>`;
  }).join('');
  
  container.innerHTML = html;
}

function destroyCharts() {
  ['comparison', 'dist', 'scatter', 'club', 'year'].forEach(key => {
    if (chartObjs[key]) {
      chartObjs[key].destroy();
      chartObjs[key] = null;
    }
  });
}

function renderSailorPerformanceSummary(sailor) {
  const meta = SAILOR_METADATA[sailor.name] || {};
  const enteredGold = meta.enteredGold || '—';
  const goldEntryDate = parseGoldEntryDate(enteredGold);
  const isPreGold = reg => goldEntryDate && reg.date && new Date(reg.date) < goldEntryDate;

  let best = Infinity;
  let sum = 0;
  let count = 0;
  const venueScores = {};

  // Stats only count results from gold fleet entry onward
  REGATTAS.forEach(reg => {
    if (isPreGold(reg)) return;
    const sInReg = reg.sailors.find(x => isSameSailor(x.name, sailor.name));
    const val = sInReg ? (sInReg.rank !== undefined && sInReg.rank !== null ? sInReg.rank : sInReg.nett) : null;

    if (val !== null && val !== undefined) {
      if (val < best) best = val;
      sum += val;
      count++;

      const venue = reg.name.split(' ')[0] || 'Unknown';
      if (!venueScores[venue]) venueScores[venue] = [];
      venueScores[venue].push(val);
    }
  });

  const avg = count > 0 ? (sum / count).toFixed(1) : '—';

  document.getElementById('sm-stat-best').textContent = best === Infinity ? '—' : 'P' + best;
  document.getElementById('sm-stat-avg').textContent = count > 0 ? 'P' + avg : '—';

  const eventsEl = document.getElementById('sm-stat-events');
  if (eventsEl) eventsEl.textContent = count;

  const noticeEl = document.getElementById('sm-gold-fleet-notice');
  if (noticeEl) {
    if (goldEntryDate) {
      noticeEl.style.display = 'block';
      noticeEl.textContent = `Stats count results from Gold Fleet entry onward (${enteredGold}). Earlier results are dimmed.`;
    } else {
      noticeEl.style.display = 'none';
    }
  }

  // Best venue = lowest average rank among venues with results
  let bestVenue = '—';
  let bestVenueAvg = Infinity;
  Object.entries(venueScores).forEach(([venue, scores]) => {
    const venueAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (venueAvg < bestVenueAvg) {
      bestVenueAvg = venueAvg;
      bestVenue = venue;
    }
  });
  const venueEl = document.getElementById('sm-stat-venue');
  if (venueEl) venueEl.textContent = bestVenue;

  // Combined regatta results: one row per regatta (most recent first), with an
  // editable rank input (data-reg-idx keyed to REGATTAS order, read by
  // saveSailorProfile) and the percentile badge for entered results.
  const resultsContainer = document.getElementById('sm-results-container');
  if (!resultsContainer) return;

  const rows = REGATTAS.map((reg, regIdx) => {
    const sInReg = reg.sailors.find(x => isSameSailor(x.name, sailor.name));
    const val = sInReg ? (sInReg.rank !== undefined && sInReg.rank !== null ? sInReg.rank : sInReg.nett) : null;
    const hasResult = val !== null && val !== undefined;

    let pctBadge = '<span style="width:64px;"></span>';
    if (hasResult) {
      const base = getRegattaPercentileBase(reg);
      const pct = base > 0 ? (val / base) * 100 : 100;
      const pctRounded = Math.min(100, Math.max(1, Math.round(pct)));
      let pctColor, pctBg;
      if (pct <= 25) { pctColor = 'var(--accent)'; pctBg = 'var(--accent-l)'; }
      else if (pct <= 50) { pctColor = 'var(--accent2)'; pctBg = 'var(--accent2-l)'; }
      else if (pct <= 75) { pctColor = 'var(--accent3)'; pctBg = 'var(--accent3-l)'; }
      else { pctColor = 'var(--red)'; pctBg = 'var(--red-l)'; }
      pctBadge = `<span style="width:64px; text-align:center; font-size:9.5px; font-weight:600; font-family:var(--mono); color:${pctColor}; background:${pctBg}; padding:2px 0; border-radius:3px;">Top ${pctRounded}%</span>`;
    }

    const preGold = isPreGold(reg);
    const dnsPenalty = getRegattaDnsPenalty(reg);
    const displayValue = hasResult ? val : '';
    const dnsBadge = !hasResult ? `<span style="font-size:9px; font-family:var(--mono); color:var(--text3); background:var(--bg3); padding:2px 5px; border-radius:999px;">DNS ${dnsPenalty}</span>` : '';
    return { regIdx, preGold, date: reg.date, html: `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:3px 0; border-bottom:1px solid var(--border); ${preGold ? 'opacity:.45;' : ''}"
           ${preGold ? 'title="Before Gold Fleet entry — not counted in stats"' : ''}>
        <span style="font-size:11px; color:var(--text2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(reg.name)}</span>
        <span style="display:inline-flex; align-items:center; gap:6px; flex-shrink:0;">
          ${pctBadge}
          ${dnsBadge}
          <input type="number" class="sm-reg-score" data-reg-idx="${regIdx}" value="${displayValue}"
                 style="width:60px; height:24px; font-size:10px; text-align:center;" placeholder="DNS">
        </span>
      </div>` };
  });

  // Most recent regatta first (REGATTAS is kept chronologically ascending)
  resultsContainer.innerHTML = rows.slice().reverse().map(r => r.html).join('')
    || '<div style="padding:6px 0; color:var(--text3);">No regattas loaded yet.</div>';
}

function renderComparisonChart() {
  const chartEl = document.getElementById('comparisonChart');
  if (!chartEl) return;

  const squadFilterVal = document.getElementById('squadFilter').value;
  const nameSearchVal = document.getElementById('nameSearch').value.toLowerCase();
  
  const squadMap = computeSquads(SAILORS);
  let dataset = SAILORS.filter(s => {
    if (genderFilter !== 'all' && s.g !== genderFilter) return false;
    const squad = EXCLUDED.has(s.name) ? null : squadMap.get(s.name);
    if (squadFilterVal && squad !== squadFilterVal) return false;
    if (nameSearchVal && !s.name.toLowerCase().includes(nameSearchVal)) return false;
    return true;
  });
  
  dataset = dataset.slice(0, MAX_CHART_SAILORS);

  if (chartObjs.comparison) {
    chartObjs.comparison.destroy();
    chartObjs.comparison = null;
  }

  if (dataset.length === 0) {
    // Clear chart canvas area
    const ctx = chartEl.getContext('2d');
    ctx.clearRect(0, 0, chartEl.width, chartEl.height);
    return;
  }

  const labels = dataset.map(s => s.name);
  const scoresData = dataset.map(s => s.score);

  chartObjs.comparison = new Chart(chartEl, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Best 3 Score (Lower is Better)',
          data: scoresData,
          backgroundColor: dataset.map(s => {
            const squad = squadMap.get(s.name);
            return squad === 'Nat A' ? 'rgba(26, 71, 42, 0.7)' :
                   squad === 'Nat B' ? 'rgba(45, 74, 138, 0.7)' :
                   squad === 'DS' ? 'rgba(122, 53, 0, 0.7)' :
                   'rgba(154, 149, 140, 0.6)';
          }),
          borderColor: dataset.map(s => {
            const squad = squadMap.get(s.name);
            return squad === 'Nat A' ? '#1a472a' :
                   squad === 'Nat B' ? '#2d4a8a' :
                   squad === 'DS' ? '#7a3500' :
                   '#9a958c';
          }),
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Sum of Ranks',
            font: { size: 10, family: 'var(--mono)' }
          }
        },
        x: {
          ticks: {
            font: { size: 9 },
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  });
}

function renderRankingsPanel() {
  const container = document.getElementById('rankings-content');
  if (!container) return;
  
  if (REGATTAS.length === 0) {
    container.innerHTML = `
      <div class="welcome">
        <div class="drop-zone" id="main-dz">
          <div class="dz-icon">📊</div>
          <div class="dz-title">Drop your ranking file here</div>
          <div class="dz-sub">Drag and drop <strong>OP_Gold_for_website.xlsx</strong><br>or any updated version of it</div>
          <div class="dz-hint">Accepts .xlsx · .xlsm · .xls · Drop again anytime to refresh</div>
        </div>
        <p style="font-size:11px;color:var(--text3);font-family:var(--mono)">After each regatta, update col Y in the Excel file and drop it here again.</p>
      </div>
    `;
    setupDropZone();
    return;
  }

  const latestRegs = getActiveRegattas();
  const regHeaders = latestRegs.map((reg, idx) => {
    // Break "SAFYC (Mar 26)" into two lines: name on top, "(Mar 26)" below
    const m = String(reg.name).match(/^(.*?)\s*(\([^)]*\))\s*$/);
    const title = m
      ? `${escapeHtml(m[1])}<br><span style="font-weight:400;color:var(--text3)">${escapeHtml(m[2])}</span>`
      : escapeHtml(reg.name);
    return `<th class="col-reg sort-header" style="cursor:pointer;user-select:none;white-space:normal;line-height:1.35" data-sort="reg_${idx}">${title}${getSortIndicator('reg_' + idx)}</th>`;
  }).join('');

  container.innerHTML = `
    <div class="metrics">
      <div class="mc mc1">
        <div class="mc-lbl">Active Fleet</div>
        <div class="mc-val" id="m-fleet">${SAILORS.length}</div>
        <div class="mc-sub">Qualified for rankings</div>
      </div>
      <div class="mc mc2">
        <div class="mc-lbl">National A</div>
        <div class="mc-val" id="m-sq-a">0</div>
        <div class="mc-sub">Top 8 Boys & Girls</div>
      </div>
      <div class="mc mc3">
        <div class="mc-lbl">National B</div>
        <div class="mc-val" id="m-sq-b">0</div>
        <div class="mc-sub">Age group allocations</div>
      </div>
      <div class="mc mc4">
        <div class="mc-lbl">Dev Squad</div>
        <div class="mc-val" id="m-sq-ds">0</div>
        <div class="mc-sub">Younger talent pipeline</div>
      </div>
      <div class="mc mc5">
        <div class="mc-lbl">Regattas</div>
        <div class="mc-val" id="m-regattas">${REGATTAS.length}</div>
        <div class="mc-sub">Active: ${latestRegs.length} loaded</div>
      </div>
    </div>
    
    <div class="charts-grid" style="margin-bottom:20px;">
      <div class="chart-card">
        <h3>Squad Score Comparison (Top 10)</h3>
        <div class="chart-container">
          <canvas id="comparisonChart"></canvas>
        </div>
      </div>
      <div class="chart-card" style="display:flex; flex-direction:column; justify-content:center;">
        <h3>Squad Distribution</h3>
        <div style="display:flex; justify-content:space-around; align-items:center; height:100%; padding:10px 0;">
          <div style="text-align:center;">
            <div style="font-size:24px; font-weight:600; color:var(--accent); font-family:var(--mono);" id="dist-a">0</div>
            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-top:4px;">National A</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:24px; font-weight:600; color:var(--accent2); font-family:var(--mono);" id="dist-b">0</div>
            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-top:4px;">National B</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:24px; font-weight:600; color:var(--accent3); font-family:var(--mono);" id="dist-ds">0</div>
            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-top:4px;">Dev Squad</div>
          </div>
        </div>
      </div>
    </div>

    <div class="tbl-wrap rankings-tbl-wrap" title="Scroll horizontally to see all columns">
      <table class="rankings-table">
        <thead><tr>
          <th class="col-rank sort-header" style="cursor:pointer;user-select:none" data-sort="cur">Rank${getSortIndicator('cur')}</th>
          <th class="col-name sort-header" style="cursor:pointer;user-select:none" data-sort="name">Sailor${getSortIndicator('name')}</th>
          <th class="sort-header" style="cursor:pointer;user-select:none" data-sort="gender">G${getSortIndicator('gender')}</th>
          <th class="sort-header" style="cursor:pointer;user-select:none" data-sort="born">Born${getSortIndicator('born')}</th>
          <th class="col-squad sort-header" style="cursor:pointer;user-select:none" data-sort="squad">${escapeHtml('Squad (Jul ' + String(COMP_YEAR).slice(-2) + ')')}${getSortIndicator('squad')}</th>
          <th class="col-squad sort-header" style="cursor:pointer;user-select:none" data-sort="squadNext">${escapeHtml('Squad (Jan ' + String(COMP_YEAR + 1).slice(-2) + ')')}${getSortIndicator('squadNext')}</th>
          <th class="col-score sort-header" style="cursor:pointer;user-select:none" data-sort="score">Best 3 of ${latestRegs.length}${getSortIndicator('score')}</th>
          ${regHeaders}
        </tr></thead>
        <tbody id="rank-body"></tbody>
      </table>
    </div>
  `;
  
  renderRankings();
}

function renderRankings() {
  const body = document.getElementById('rank-body');
  if (!body || !SAILORS.length) return;
  const sqF = document.getElementById('squadFilter').value;
  const nm = document.getElementById('nameSearch').value.toLowerCase();
  const t50 = document.getElementById('top50').checked;
  const sq = computeSquads(SAILORS);
  const sqNext = computeSquads(SAILORS, COMP_YEAR + 1);

  // Manually locked squad statuses, stored per sailor in SAILOR_METADATA
  // under year-suffixed keys (e.g. squadJul26 for COMP_YEAR 2026).
  const yy = String(COMP_YEAR).slice(-2);
  const squadJulKey = 'squadJul' + yy;
  const squadLock = (name, key) => (SAILOR_METADATA[name] || {})[key] || null;

  const latestRegs = getActiveRegattas();

  // Count squad distributions
  let countA = 0, countB = 0, countDS = 0;
  SAILORS.forEach(s => {
    const squad = EXCLUDED.has(s.name) ? null : sq.get(s.name);
    if (squad === 'Nat A') countA++;
    else if (squad === 'Nat B') countB++;
    else if (squad === 'DS') countDS++;
  });
  
  const mSqA = document.getElementById('m-sq-a'), mSqB = document.getElementById('m-sq-b'), mSqDs = document.getElementById('m-sq-ds');
  if (mSqA) mSqA.textContent = countA;
  if (mSqB) mSqB.textContent = countB;
  if (mSqDs) mSqDs.textContent = countDS;
  
  const distA = document.getElementById('dist-a'), distB = document.getElementById('dist-b'), distDs = document.getElementById('dist-ds');
  if (distA) distA.textContent = countA;
  if (distB) distB.textContent = countB;
  if (distDs) distDs.textContent = countDS;

  const data = SAILORS.filter(s => {
    if (genderFilter !== 'all' && s.g !== genderFilter) return false;
    const squad = EXCLUDED.has(s.name) ? null : (sq.get(s.name) || null);
    if (sqF && squad !== sqF) return false;
    if (nm && !s.name.toLowerCase().includes(nm)) return false;
    if (t50 && s.cur > 50) return false;
    return true;
  });

  data.sort((a, b) => {
    let valA, valB;
    if (sortKey === 'cur') {
      valA = a.cur;
      valB = b.cur;
    } else if (sortKey === 'name') {
      valA = a.name;
      valB = b.name;
    } else if (sortKey === 'gender') {
      valA = a.g;
      valB = b.g;
    } else if (sortKey === 'born') {
      valA = a.born;
      valB = b.born;
    } else if (sortKey === 'squad') {
      valA = squadNameOrder(squadLock(a.name, squadJulKey) || sq.get(a.name));
      valB = squadNameOrder(squadLock(b.name, squadJulKey) || sq.get(b.name));
    } else if (sortKey === 'squadNext') {
      valA = squadNameOrder(sqNext.get(a.name));
      valB = squadNameOrder(sqNext.get(b.name));
    } else if (sortKey === 'enteredGold') {
      valA = a.enteredGold || '—';
      valB = b.enteredGold || '—';
    } else if (sortKey === 'score') {
      valA = a.score;
      valB = b.score;
    } else if (sortKey.startsWith('reg_')) {
      const regIdx = parseInt(sortKey.split('_')[1], 10);
      // Non-participants sort as their DNS penalty (same as scoring)
      valA = a.ranks[regIdx] !== null && a.ranks[regIdx] !== undefined
        ? a.ranks[regIdx]
        : getRegattaDnsPenalty(latestRegs[regIdx]);
      valB = b.ranks[regIdx] !== null && b.ranks[regIdx] !== undefined
        ? b.ranks[regIdx]
        : getRegattaDnsPenalty(latestRegs[regIdx]);
    } else {
      valA = a.cur;
      valB = b.cur;
    }

    if (valA === valB) {
      return a.cur - b.cur;
    }
    
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return sortAsc ? valA - valB : valB - valA;
    }
  });

  body.innerHTML = data.map(s => {
    const isExcl = EXCLUDED.has(s.name);
    const squad = isExcl ? null : (sq.get(s.name) || null);
    const isRetiringNext = isAgeDropped(s.born, COMP_YEAR + 1);
    const squadNext = isExcl ? null : (sqNext.get(s.name) || null);
    const rowSt = isExcl ? 'opacity:.42;' : '';
    const exclTag = isExcl ? `<span class="excl-tag">${escapeHtml(EXCLUDED.get(s.name))}</span>` : '';

    const validRanks = s.ranks.map((v, regIdx) =>
      (v === null || v === undefined) ? getRegattaDnsPenalty(latestRegs[regIdx]) : v
    );
    const best3Indices = validRanks.map((v, i) => ({ v, i })).sort((a,b) => a.v - b.v).slice(0,3).map(x => x.i);
    const isBest3 = new Set(best3Indices);

    const cells = latestRegs.map((reg, idx) => {
      const v = s.ranks[idx];
      // No result for this ranking regatta → default DNS (reg.dns+1 / fleet penalty)
      if (v === null || v === undefined) {
        const dns = getRegattaDnsPenalty(reg);
        return `<td class="col-reg" style="text-align:center"><span class="pos-tag dns" title="Did not participate — default DNS ${dns}">${dns}</span></td>`;
      }
      return `<td class="col-reg" style="text-align:center"><span class="pos-tag${isBest3.has(idx) ? ' best' : ''}">${escapeHtml(String(v))}</span></td>`;
    }).join('');

    const safeName = escapeHtml(s.name);
    const safeGender = escapeHtml(s.g);
    const safeBorn = escapeHtml(s.born);

    const lockJul = squadLock(s.name, squadJulKey);
    const squadLockCell = (field, locked, autoLabel) => {
      if (!isEditor()) return locked ? squadBadge(locked) : (autoLabel !== null ? squadBadge(autoLabel) : '<span class="badge b-n">—</span>');
      const autoText = autoLabel !== null ? `— auto (${autoLabel || '—'}) —` : '—';
      return `<select class="squad-lock-select" data-sailor="${safeName}" data-field="${field}"
        style="height:22px;font-size:10px;padding:1px 2px;max-width:100px;${locked ? 'border-color:var(--accent);font-weight:600;' : ''}">
        <option value="">${autoText}</option>
        ${['Nat A', 'Nat B', 'DS'].map(o => `<option value="${o}" ${locked === o ? 'selected' : ''}>${o} 🔒</option>`).join('')}
      </select>`;
    };

    return `<tr style="${rowSt}">
      <td class="rank-c col-rank">${s.cur}</td>
      <td class="name-c col-name" data-sailor="${safeName}" style="cursor:pointer; color:var(--accent); font-weight:600; text-decoration:underline;">${safeName}${exclTag}</td>
      <td class="sub-c">${safeGender}</td>
      <td class="sub-c">${safeBorn}</td>
      <td class="col-squad">${isExcl && !lockJul && !isEditor() ? '<span class="badge b-n">Excl.</span>' : squadLockCell(squadJulKey, lockJul, isExcl ? null : squad)}</td>
      <td class="col-squad">${isExcl ? '<span class="badge b-n">Excl.</span>' : isRetiringNext ? '<span class="badge b-n" style="background:var(--red-l);color:var(--red)" title="Turns 16 by then — ages out of the Gold Fleet">Retiring</span>' : squadBadge(squadNext)}</td>
      <td class="score-c col-score" style="text-align:center">${s.score}</td>
      ${cells}
    </tr>`;
  }).join('') || `<tr><td colspan="${7 + latestRegs.length}" style="text-align:center;color:var(--text3);padding:24px">No sailors match criteria.</td></tr>`;

  syncRankingsStickyOffsets();
  renderComparisonChart();
}

/** Keep sticky Sailor column flush against Rank when the table scrolls horizontally. */
function syncRankingsStickyOffsets() {
  const table = document.querySelector('.rankings-table');
  if (!table) return;
  const rankTh = table.querySelector('thead .col-rank');
  if (!rankTh) return;
  const w = Math.ceil(rankTh.getBoundingClientRect().width);
  table.querySelectorAll('.col-name').forEach(el => {
    el.style.left = w + 'px';
  });
}

if (typeof window !== 'undefined' && !window.__rankingsStickyResizeBound) {
  window.__rankingsStickyResizeBound = true;
  window.addEventListener('resize', () => {
    if (document.querySelector('.rankings-table')) syncRankingsStickyOffsets();
  });
}

function renderRegattasPanel() {
  const container = document.getElementById('regatta-list');
  if (!container) return;
  
  if (REGATTAS.length === 0) {
    container.innerHTML = '<div class="excl-empty" style="grid-column: 1 / -1;">No regattas uploaded yet. Drop an Excel file or click the load button.</div>';
    return;
  }
  
  const html = REGATTAS.map((reg, idx) => {
    const safeName = escapeHtml(reg.name);
    const competitorCount = (reg.dns !== undefined && reg.dns !== null) ? reg.dns : (reg.sailors ? reg.sailors.length : 0);
    const dateStr = reg.date || 'Date not set';
    
    return `
      <div class="card regatta-card" data-name="${safeName}" style="cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; padding:18px; border:1px solid var(--border); border-radius:var(--r); background:var(--card); transition:transform 0.15s ease, box-shadow 0.15s ease;">
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:16px; font-weight:700; color:var(--text); line-height:1.3;">${safeName}</div>
          <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text3); font-family:var(--mono);">
            <span>📅 ${dateStr}</span>
            <span>•</span>
            <span>⛵ ${competitorCount} Sailors</span>
          </div>
        </div>
        <div style="margin-top:14px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; color:var(--accent); font-weight:600; font-family:var(--mono);">View Results →</span>
          ${isEditor() ? `<button class="excl-rm regatta-delete-btn" data-name="${safeName}" style="background:var(--red-l); color:var(--red); border:1px solid rgba(138,28,28,.15); height:24px; padding:0 8px; font-size:10px; border-radius:4px; font-family:var(--mono);">✕ Delete</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

function renderExclusions() {
  const list = document.getElementById('excl-list');
  const countBadge = document.getElementById('excl-count-badge');
  if (!list) return;
  
  if (countBadge) countBadge.textContent = EXCLUDED.size;
  
  if (EXCLUDED.size === 0) {
    list.innerHTML = '<div class="excl-empty">No sailors excluded</div>';
    return;
  }
  
  const html = Array.from(EXCLUDED.entries()).map(([name, reason]) => {
    const safeName = escapeHtml(name);
    const safeReason = escapeHtml(reason);
    return `<div class="excl-item">
      <div>
        <div class="excl-name">${safeName}</div>
        <div class="excl-reason">${safeReason}</div>
      </div>
      <button class="excl-rm editor-only excl-remove-btn" data-name="${safeName}">✕ Remove</button>
    </div>`;
  }).join('');
  
  list.innerHTML = html;
}

function renderMajorCompsPanel() {
  const container = document.getElementById('major-comps-table-container');
  if (!container) return;
  
  const onlyParticipants = document.getElementById('mc-only-participants')?.checked ?? true;
  const searchVal = (document.getElementById('mc-search')?.value || '').toLowerCase();
  
  const allSystem = getAllSailorsInSystem();
  const allSystemMap = new Map();
  allSystem.forEach(s => {
    allSystemMap.set(normalizeName(s.name), s);
  });
  
  const allNames = new Map();
  const normalizedToOriginal = new Map();
  
  allSystem.forEach(s => {
    const norm = normalizeName(s.name);
    normalizedToOriginal.set(norm, s.name);
    allNames.set(s.name, s.name);
  });
  
  Object.keys(SAILOR_METADATA).forEach(name => {
    const norm = normalizeName(name);
    if (!normalizedToOriginal.has(norm)) {
      normalizedToOriginal.set(norm, name);
      allNames.set(name, name);
    }
  });

  let list = Array.from(allNames.values()).map(name => {
    const meta = SAILOR_METADATA[name] || {};
    const major = meta.majorComps || {};
    const norm = normalizeName(name);
    
    const activeObj = SAILORS.find(x => normalizeName(x.name) === norm);
    const sObj = allSystemMap.get(norm);
    
    const curRank = activeObj ? activeObj.cur : null;
    const gender = activeObj ? (activeObj.g || '—') : (meta.g || sObj?.g || '—');
    const born = activeObj ? (activeObj.born || '—') : (meta.born || sObj?.born || '—');
    const enteredGold = meta.enteredGold || '—';
    
    const worlds = major.worlds || [];
    const euros = major.euros || [];
    const asians = major.asians || [];
    const seagames = major.seagames || [];
    
    const totalRepresentations = worlds.length + euros.length + asians.length + seagames.length;

    return {
      name,
      curRank,
      gender,
      born,
      enteredGold,
      worlds,
      euros,
      asians,
      seagames,
      totalRepresentations,
      isActive: !!activeObj
    };
  });

  list = list.filter(item => {
    if (searchVal && !item.name.toLowerCase().includes(searchVal)) return false;
    if (onlyParticipants && item.totalRepresentations === 0) return false;
    return true;
  });

  list.sort((a, b) => {
    let valA, valB;
    if (mcSortKey === 'name') {
      valA = a.name;
      valB = b.name;
    } else if (mcSortKey === 'gender') {
      valA = a.gender;
      valB = b.gender;
    } else if (mcSortKey === 'born') {
      valA = a.born === '—' ? 9999 : a.born;
      valB = b.born === '—' ? 9999 : b.born;
    } else if (mcSortKey === 'enteredGold') {
      valA = a.enteredGold === '—' ? 'zzzz' : a.enteredGold;
      valB = b.enteredGold === '—' ? 'zzzz' : b.enteredGold;
    } else if (mcSortKey === 'worlds') {
      valA = a.worlds.length ? Math.min(...a.worlds) : 9999;
      valB = b.worlds.length ? Math.min(...b.worlds) : 9999;
    } else if (mcSortKey === 'euros') {
      valA = a.euros.length ? Math.min(...a.euros) : 9999;
      valB = b.euros.length ? Math.min(...b.euros) : 9999;
    } else if (mcSortKey === 'asians') {
      valA = a.asians.length ? Math.min(...a.asians) : 9999;
      valB = b.asians.length ? Math.min(...b.asians) : 9999;
    } else if (mcSortKey === 'seagames') {
      valA = a.seagames.length ? Math.min(...a.seagames) : 9999;
      valB = b.seagames.length ? Math.min(...b.seagames) : 9999;
    } else {
      valA = a.name;
      valB = b.name;
    }

    if (valA === valB) {
      return a.name.localeCompare(b.name);
    }
    
    let res = 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      res = valA - valB;
    } else {
      res = String(valA).localeCompare(String(valB));
    }
    return mcSortAsc ? res : -res;
  });

  const rows = list.map(s => {
    function renderList(years) {
      if (!years || years.length === 0) return '—';
      return years.map(y => `<span class="pos-tag" style="margin:1px;font-size:9.5px">${y}</span>`).join(' ');
    }
    const safeName = escapeHtml(s.name);
    const safeGender = escapeHtml(s.gender);
    const safeBorn = escapeHtml(s.born);
    const safeEntered = escapeHtml(s.enteredGold);

    return `<tr>
      <td class="name-c" data-sailor="${safeName}" style="cursor:pointer; color:var(--accent); font-weight:600; text-decoration:underline;">${safeName}</td>
      <td class="sub-c" style="text-align:center;">${safeGender}</td>
      <td class="sub-c" style="text-align:center;">${safeBorn}</td>
      <td style="font-family:var(--sans);font-size:11px;color:var(--text2);text-align:center;">${safeEntered}</td>
      <td style="text-align:center;padding:4px;">${renderList(s.worlds)}</td>
      <td style="text-align:center;padding:4px;">${renderList(s.euros)}</td>
      <td style="text-align:center;padding:4px;">${renderList(s.asians)}</td>
      <td style="text-align:center;padding:4px;">${renderList(s.seagames)}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th style="width:180px; cursor:pointer; user-select:none" class="mc-sort-header" data-sort="name">Sailor${getMcSortIndicator('name')}</th>
          <th style="width:32px; text-align:center; cursor:pointer; user-select:none" class="mc-sort-header" data-sort="gender">G${getMcSortIndicator('gender')}</th>
          <th style="width:46px; text-align:center; cursor:pointer; user-select:none" class="mc-sort-header" data-sort="born">Born${getMcSortIndicator('born')}</th>
          <th style="width:100px; text-align:center; cursor:pointer; user-select:none" class="mc-sort-header" data-sort="enteredGold">Entered Gold${getMcSortIndicator('enteredGold')}</th>
          <th style="text-align:center; cursor:pointer; user-select:none" class="mc-sort-header" data-sort="worlds">Optimist World Champ.${getMcSortIndicator('worlds')}</th>
          <th style="text-align:center; cursor:pointer; user-select:none" class="mc-sort-header" data-sort="euros">Optimist European Champ.${getMcSortIndicator('euros')}</th>
          <th style="text-align:center; cursor:pointer; user-select:none" class="mc-sort-header" data-sort="asians">Optimist Asian & Oceanian Champ.${getMcSortIndicator('asians')}</th>
          <th style="text-align:center; cursor:pointer; user-select:none" class="mc-sort-header" data-sort="seagames">SEA Games${getMcSortIndicator('seagames')}</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="8" style="text-align:center; color:var(--text3); padding:16px;">No sailors match criteria.</td></tr>'}
      </tbody>
    </table>
  `;
}

function renderHistGoldPanel() {
  const container = document.getElementById('hist-gold-table-container');
  if (!container) return;
  
  const searchVal = (document.getElementById('hg-search')?.value || '').toLowerCase();
  const onlyActive = document.getElementById('hg-only-active')?.checked ?? true;
  const squadPeriodEl = document.getElementById('hg-squad-period');
  const squadFilterEl = document.getElementById('hg-squad-filter');
  const squadPreviewEl = document.getElementById('hg-squad-preview');
  const squadPeriodKey = squadPeriodEl?.value || 'squadJan25';
  const squadFilterValue = squadFilterEl?.value || '';
  const squadPeriodLabel = {
    squadJul24: 'Jul 24',
    squadJan25: 'Jan 25',
    squadJul25: 'Jul 25',
    squadJan26: 'Jan 26',
    squadJul26: 'Jul 26'
  }[squadPeriodKey] || 'Period';
  
  const isEditable = isEditor();

  if (squadPeriodEl && squadFilterEl && !squadPeriodEl.dataset.bound) {
    squadPeriodEl.addEventListener('change', () => renderHistGoldPanel());
    squadFilterEl.addEventListener('change', () => renderHistGoldPanel());
    squadPeriodEl.dataset.bound = '1';
    squadFilterEl.dataset.bound = '1';
  }
  
  // Render the bulk-edit toolbar only once (avoid re-rendering if already present)
  let bulkBar = document.getElementById('hg-bulk-bar');
  if (isEditable && !bulkBar) {
    const filterCard = document.querySelector('#panel-hist-gold .card:nth-child(2)');
    if (filterCard) {
      bulkBar = document.createElement('div');
      bulkBar.id = 'hg-bulk-bar';
      bulkBar.className = 'card';
      bulkBar.style.cssText = 'margin-bottom:18px; padding:12px 16px; display:flex; flex-wrap:wrap; align-items:center; gap:12px;';
      bulkBar.innerHTML = `
        <span style="font-size:12px; font-weight:600; font-family:var(--mono); color:var(--text2);">Bulk Edit:</span>
        <select id="hg-bulk-field" style="height:30px; font-size:12px; background:var(--bg2); border:1px solid var(--border); border-radius:var(--r); color:var(--text); padding:0 8px; cursor:pointer;">
          <option value="enteredGold">Entered Gold</option>
        </select>
        <select id="hg-bulk-value" style="height:30px; font-size:12px; background:var(--bg2); border:1px solid var(--border); border-radius:var(--r); color:var(--text); padding:0 8px; cursor:pointer;"></select>
        <button id="hg-bulk-apply" style="padding:5px 14px; background:var(--accent); color:#fff; border:none; border-radius:var(--r); font-size:11px; font-weight:600; cursor:pointer; font-family:var(--mono); transition:all .15s;">Apply to selected</button>
        <span id="hg-bulk-count" style="font-size:11px; color:var(--text3); font-family:var(--mono);">0 selected</span>
      `;
      filterCard.insertAdjacentElement('afterend', bulkBar);
      const hgBulkValueSelect = document.getElementById('hg-bulk-value');
      if (hgBulkValueSelect) populateGoldEntrySelect(hgBulkValueSelect);

      document.getElementById('hg-bulk-apply')?.addEventListener('click', () => {
        if (!requireEditor()) return;
        const checked = document.querySelectorAll('.hg-row-cb:checked');
        if (checked.length === 0) { alert('No sailors selected.'); return; }
        const field = document.getElementById('hg-bulk-field')?.value;
        const val = document.getElementById('hg-bulk-value')?.value;
        checked.forEach(cb => {
          const name = cb.getAttribute('data-sailor');
          if (!name) return;
          if (!SAILOR_METADATA[name]) SAILOR_METADATA[name] = {};
          if (field === 'enteredGold') SAILOR_METADATA[name].enteredGold = val;
        });
        recomputeSailors();
        saveData();
        renderAll();
      });
    }
  } else if (!isEditable && bulkBar) {
    bulkBar.remove();
  }
  
  const allSystem = getAllSailorsInSystem();
  const allSystemMap = new Map();
  allSystem.forEach(s => {
    allSystemMap.set(normalizeName(s.name), s);
  });
  
  const allNames = new Map();
  const normalizedToOriginal = new Map();
  
  allSystem.forEach(s => {
    const norm = normalizeName(s.name);
    normalizedToOriginal.set(norm, s.name);
    allNames.set(s.name, s.name);
  });
  
  Object.keys(SAILOR_METADATA).forEach(name => {
    const norm = normalizeName(name);
    if (!normalizedToOriginal.has(norm)) {
      normalizedToOriginal.set(norm, name);
      allNames.set(name, name);
    }
  });

  let list = Array.from(allNames.values()).map(name => {
    const meta = SAILOR_METADATA[name] || {};
    const norm = normalizeName(name);
    
    const activeObj = SAILORS.find(x => normalizeName(x.name) === norm);
    const sObj = allSystemMap.get(norm);
    
    const curRank = activeObj ? activeObj.cur : null;
    const gender = activeObj ? (activeObj.g || '—') : (meta.g || sObj?.g || '—');
    const enteredGold = meta.enteredGold || '—';
    
    const valJun24 = meta.histJun24 !== undefined && meta.histJun24 !== null ? meta.histJun24 : '';
    const valDec24 = meta.histDec24 !== undefined && meta.histDec24 !== null ? meta.histDec24 : '';
    const valJun25 = meta.histJun25 !== undefined && meta.histJun25 !== null ? meta.histJun25 : '';
    const valDec25 = meta.histDec25 !== undefined && meta.histDec25 !== null ? meta.histDec25 : '';
    const valJun26 = meta.histJun26 !== undefined && meta.histJun26 !== null ? meta.histJun26 : '';

    return {
      name,
      curRank,
      gender,
      enteredGold,
      valJun24,
      valDec24,
      valJun25,
      valDec25,
      valJun26,
      isActive: !!activeObj
    };
  });

  const allSquadSailors = list.map(item => {
    const meta = SAILOR_METADATA[item.name] || {};
    const squad = meta[squadPeriodKey] || '';
    return { ...item, squad };
  });

  const squadPreview = allSquadSailors.filter(item => {
    if (squadFilterValue) {
      return item.squad === squadFilterValue;
    }
    return item.squad && item.squad !== '—';
  }).sort((a, b) => a.name.localeCompare(b.name));

  list = list.filter(item => {
    if (searchVal && !item.name.toLowerCase().includes(searchVal)) return false;
    if (onlyActive && !item.isActive && (item.enteredGold === '—' || !item.enteredGold)) return false;
    return true;
  });

  if (squadPreviewEl) {
    if (squadPreview.length === 0) {
      squadPreviewEl.innerHTML = `
        <div style="font-size:11px; font-weight:600; color:var(--text2); margin-bottom:4px;">
          ${escapeHtml(squadFilterValue || 'All squads')} in ${squadPeriodLabel} (0)
        </div>
        <div class="squad-preview-empty">No sailors match this squad period.</div>
      `;
    } else {
      const renderItem = item => {
        const sn = escapeHtml(item.name);
        const meta = SAILOR_METADATA[item.name] || {};
        const enteredGold = meta.enteredGold || '—';
        return `
          <div class="squad-preview-item name-c" data-sailor="${sn}" title="Click to view ${sn}'s profile">
            <span style="font-weight: 500;">${sn}</span>
            <span style="font-size: 9px; color: var(--text3); font-family: var(--mono);">${enteredGold}</span>
          </div>
        `;
      };

      if (squadFilterValue) {
        const badgeCls = squadFilterValue === 'Nat A' ? 'nat-a' : squadFilterValue === 'Nat B' ? 'nat-b' : 'ds';
        const displayBadgeCls = squadFilterValue === 'Nat A' ? 'b-a' : squadFilterValue === 'Nat B' ? 'b-b' : 'b-ds';
        const content = squadPreview.map(renderItem).join('');
        squadPreviewEl.innerHTML = `
          <div style="font-size:11px; font-weight:600; color:var(--text2); margin-bottom:4px;">
            ${squadFilterValue} Squad in ${squadPeriodLabel} (${squadPreview.length})
          </div>
          <div class="squad-preview-grid">
            <div class="squad-preview-col" style="grid-column: 1 / -1; background: var(--bg2);">
              <div class="squad-preview-hdr ${badgeCls}">
                <span>${squadFilterValue} Squad Members</span>
                <span class="badge ${displayBadgeCls}">${squadPreview.length}</span>
              </div>
              <div class="squad-preview-list" style="max-height: 350px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
                ${content}
              </div>
            </div>
          </div>
        `;
      } else {
        const natA = squadPreview.filter(s => s.squad === 'Nat A');
        const natB = squadPreview.filter(s => s.squad === 'Nat B');
        const ds = squadPreview.filter(s => s.squad === 'DS');

        const natAContent = natA.length ? natA.map(renderItem).join('') : '<div class="squad-preview-empty">None</div>';
        const natBContent = natB.length ? natB.map(renderItem).join('') : '<div class="squad-preview-empty">None</div>';
        const dsContent = ds.length ? ds.map(renderItem).join('') : '<div class="squad-preview-empty">None</div>';

        squadPreviewEl.innerHTML = `
          <div style="font-size:11px; font-weight:600; color:var(--text2); margin-bottom:4px;">
            Squad Cohorts in ${squadPeriodLabel} (${squadPreview.length})
          </div>
          <div class="squad-preview-grid">
            <div class="squad-preview-col">
              <div class="squad-preview-hdr nat-a">
                <span>National A</span>
                <span class="badge b-a">${natA.length}</span>
              </div>
              <div class="squad-preview-list">${natAContent}</div>
            </div>
            <div class="squad-preview-col">
              <div class="squad-preview-hdr nat-b">
                <span>National B</span>
                <span class="badge b-b">${natB.length}</span>
              </div>
              <div class="squad-preview-list">${natBContent}</div>
            </div>
            <div class="squad-preview-col">
              <div class="squad-preview-hdr ds">
                <span>Development</span>
                <span class="badge b-ds">${ds.length}</span>
              </div>
              <div class="squad-preview-list">${dsContent}</div>
            </div>
          </div>
        `;
      }
    }
  }


  list.sort((a, b) => {
    let valA, valB;
    if (hgSortKey === 'rank') {
      valA = a.curRank !== null && a.curRank !== undefined ? a.curRank : 9999;
      valB = b.curRank !== null && b.curRank !== undefined ? b.curRank : 9999;
    } else if (hgSortKey === 'name') {
      valA = a.name;
      valB = b.name;
    } else if (hgSortKey === 'gender') {
      valA = a.gender;
      valB = b.gender;
    } else if (hgSortKey === 'enteredGold') {
      valA = a.enteredGold === '—' ? 'zzzz' : a.enteredGold;
      valB = b.enteredGold === '—' ? 'zzzz' : b.enteredGold;
    } else if (hgSortKey === 'valJun24') {
      valA = getHistoricalSortValue(a, 'valJun24', '2024-06-30');
      valB = getHistoricalSortValue(b, 'valJun24', '2024-06-30');
    } else if (hgSortKey === 'valDec24') {
      valA = getHistoricalSortValue(a, 'valDec24', '2024-12-31');
      valB = getHistoricalSortValue(b, 'valDec24', '2024-12-31');
    } else if (hgSortKey === 'valJun25') {
      valA = getHistoricalSortValue(a, 'valJun25', '2025-06-30');
      valB = getHistoricalSortValue(b, 'valJun25', '2025-06-30');
    } else if (hgSortKey === 'valDec25') {
      valA = getHistoricalSortValue(a, 'valDec25', '2025-12-31');
      valB = getHistoricalSortValue(b, 'valDec25', '2025-12-31');
    } else if (hgSortKey === 'valJun26') {
      valA = getHistoricalSortValue(a, 'valJun26', '2026-06-30');
      valB = getHistoricalSortValue(b, 'valJun26', '2026-06-30');
    }

    if (valA === valB) {
      const rankA = a.curRank !== null && a.curRank !== undefined ? a.curRank : 9999;
      const rankB = b.curRank !== null && b.curRank !== undefined ? b.curRank : 9999;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    }

    let res = 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      res = valA - valB;
    } else {
      res = String(valA).localeCompare(String(valB));
    }
    return hgSortAsc ? res : -res;
  });

  const rows = list.map(s => {
    function renderCell(field, val, dateStr) {
      if (isEditable) {
        return `<td style="text-align:center; padding:4px;">
          <input type="text" class="hist-direct-input" value="${val !== '' ? '#' + val : ''}" 
            data-sailor="${escapeHtml(s.name)}" data-field="${field}"
            placeholder="-">
        </td>`;
      } else {
        const displayVal = val !== '' ? `#${val}` : getHistoricalRank(s.name, dateStr);
        return `<td style="text-align:center; font-family:var(--mono); font-size:10.5px">${escapeHtml(displayVal)}</td>`;
      }
    }

    const rankStr = s.isActive ? s.curRank : '<span style="color:var(--text3)">—</span>';
    const safeName = escapeHtml(s.name);
    const safeGender = escapeHtml(s.gender);
    const safeEntered = escapeHtml(s.enteredGold);
    const cbCol = isEditable
      ? `<td style="text-align:center; padding:4px;"><input type="checkbox" class="hg-row-cb" data-sailor="${safeName}" style="width:15px; height:15px; cursor:pointer;"></td>`
      : '';

    return `<tr style="${!s.isActive ? 'opacity:0.65; background:var(--bg2);' : ''}">
      ${cbCol}
      <td class="rank-c" style="text-align:center;">${rankStr}</td>
      <td class="name-c" data-sailor="${safeName}" style="cursor:pointer; color:var(--accent); font-weight:600; text-decoration:underline;">${safeName}</td>
      <td class="sub-c" style="text-align:center;">${safeGender}</td>
      <td style="font-family:var(--sans);font-size:11px;color:var(--text2)">${safeEntered}</td>
      ${renderCell('histJun24', s.valJun24, '2024-06-30')}
      ${renderCell('histDec24', s.valDec24, '2024-12-31')}
      ${renderCell('histJun25', s.valJun25, '2025-06-30')}
      ${renderCell('histDec25', s.valDec25, '2025-12-31')}
      ${renderCell('histJun26', s.valJun26, '2026-06-30')}
    </tr>`;
  }).join('');

  const selectAllTh = isEditable
    ? `<th style="width:36px; text-align:center;"><input type="checkbox" id="hg-select-all" title="Select all" style="width:15px;height:15px;cursor:pointer;"></th>`
    : '';
  const colSpan = isEditable ? 10 : 9;

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          ${selectAllTh}
          <th style="width:46px; cursor:pointer; user-select:none" class="hg-sort-header" data-sort="rank">Rank${getHgSortIndicator('rank')}</th>
          <th style="width:180px; cursor:pointer; user-select:none" class="hg-sort-header" data-sort="name">Sailor${getHgSortIndicator('name')}</th>
          <th style="width:32px; text-align:center; cursor:pointer; user-select:none" class="hg-sort-header" data-sort="gender">G${getHgSortIndicator('gender')}</th>
          <th style="width:100px; text-align:center; cursor:pointer; user-select:none" class="hg-sort-header" data-sort="enteredGold">Entered Gold${getHgSortIndicator('enteredGold')}</th>
          <th style="width:70px; text-align:center; cursor:pointer; user-select:none" class="hg-sort-header" data-sort="valJun24">Jun 24${getHgSortIndicator('valJun24')}</th>
          <th style="width:70px; text-align:center; cursor:pointer; user-select:none" class="hg-sort-header" data-sort="valDec24">Dec 24${getHgSortIndicator('valDec24')}</th>
          <th style="width:70px; text-align:center; cursor:pointer; user-select:none" class="hg-sort-header" data-sort="valJun25">Jun 25${getHgSortIndicator('valJun25')}</th>
          <th style="width:70px; text-align:center; cursor:pointer; user-select:none" class="hg-sort-header" data-sort="valDec25">Dec 25${getHgSortIndicator('valDec25')}</th>
          <th style="width:70px; text-align:center; cursor:pointer; user-select:none" class="hg-sort-header" data-sort="valJun26">Jun 26${getHgSortIndicator('valJun26')}</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="${colSpan}" style="text-align:center; color:var(--text3); padding:16px;">No records match criteria.</td></tr>`}
      </tbody>
    </table>
  `;

  // Wire up select-all checkbox
  const selectAll = document.getElementById('hg-select-all');
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      document.querySelectorAll('.hg-row-cb').forEach(cb => { cb.checked = selectAll.checked; });
      updateBulkCount();
    });
  }
  // Wire up individual checkboxes to update count
  container.querySelectorAll('.hg-row-cb').forEach(cb => {
    cb.addEventListener('change', updateBulkCount);
  });
}

function updateBulkCount() {
  const countEl = document.getElementById('hg-bulk-count');
  if (!countEl) return;
  const n = document.querySelectorAll('.hg-row-cb:checked').length;
  countEl.textContent = `${n} selected`;
  const selectAll = document.getElementById('hg-select-all');
  if (selectAll) {
    const total = document.querySelectorAll('.hg-row-cb').length;
    selectAll.indeterminate = n > 0 && n < total;
    selectAll.checked = n > 0 && n === total;
  }
}

function renderFleetPanel() {
  const activeList = document.getElementById('fleet-active-list');
  const droppedList = document.getElementById('fleet-dropped-list');
  if (!activeList || !droppedList) return;
  
  const searchActive = document.getElementById('fleet-search-active').value.toLowerCase();
  const searchDropped = document.getElementById('fleet-search-dropped').value.toLowerCase();
  
  const allSystem = getAllSailorsInSystem();
  
  const activeSailors = allSystem.filter(s => {
    const isAutoDrop = isAgeDropped(s.born);
    const isDropped = isDroppedSailor(s.name) || isAutoDrop;
    return !isDropped && s.name.toLowerCase().includes(searchActive);
  });
  activeSailors.sort((a, b) => {
    const rankA = SAILORS.find(s => isSameSailor(s.name, a.name));
    const rankB = SAILORS.find(s => isSameSailor(s.name, b.name));
    return (rankA ? rankA.cur : 9999) - (rankB ? rankB.cur : 9999);
  });
  
  activeList.innerHTML = activeSailors.map(s => {
    const sailorRank = SAILORS.find(sr => isSameSailor(sr.name, s.name));
    const rankStr = sailorRank ? `#${sailorRank.cur}` : '—';
    const safeName = escapeHtml(s.name);
    const dataName = encodeURIComponent(cleanSailorName(s.name));
    const safeGender = escapeHtml(s.g);
    const safeBorn = escapeHtml(s.born);
    const safeClub = escapeHtml(s.club || 'No Club');

    return `<div class="excl-item" style="margin-bottom:4px;">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-family:var(--mono);font-size:10px;color:var(--text3);min-width:32px">${rankStr}</span>
        <div>
          <div class="excl-name name-c" data-sailor="${dataName}" style="cursor:pointer; color:var(--accent); text-decoration:underline; font-weight:600;">${safeName}</div>
          <div class="excl-reason">${safeGender} · ${safeBorn} · ${safeClub}</div>
        </div>
      </div>
      <button class="excl-rm fleet-drop-btn" data-sailor="${dataName}" style="background:var(--red-l); color:var(--red); border:1px solid rgba(138,28,28,.15); min-width:65px; height:24px; padding:0 8px;">✕ Drop</button>
    </div>`;
  }).join('') || '<div class="excl-empty">No active sailors.</div>';

  const droppedSailors = allSystem.filter(s => {
    const isAutoDrop = isAgeDropped(s.born);
    const isDropped = isDroppedSailor(s.name) || isAutoDrop;
    return isDropped && s.name.toLowerCase().includes(searchDropped);
  });
  
  droppedList.innerHTML = droppedSailors.map(s => {
    const isAutoDrop = isAgeDropped(s.born);
    const isManual = isDroppedSailor(s.name);
    const safeName = escapeHtml(s.name);
    const dataName = encodeURIComponent(cleanSailorName(s.name));
    const safeGender = escapeHtml(s.g);
    const safeBorn = escapeHtml(s.born);
    const safeClub = escapeHtml(s.club || 'No Club');
    let reason = '';
    if (isAutoDrop && isManual) reason = 'Age limit + manually dropped';
    else if (isAutoDrop) reason = 'Age limit (cannot re-promote)';
    else reason = 'Manually dropped';

    // Age-limited sailors stay out of rankings; only manual drops get Re-promote.
    const actionButton = isAutoDrop && !isManual
      ? `<span class="badge b-n" style="background:var(--red-l); color:var(--red); font-size:9px; padding:3px 6px;">Age Limit (>15)</span>`
      : isAutoDrop && isManual
        ? `<button class="excl-rm fleet-promote-btn" data-sailor="${dataName}" title="Clears manual drop only; age limit still applies" style="background:var(--accent-l); color:var(--accent); border:1px solid rgba(26,71,42,.15); min-width:90px; height:24px; padding:0 8px;">Clear manual drop</button>`
        : `<button class="excl-rm fleet-promote-btn" data-sailor="${dataName}" style="background:var(--accent-l); color:var(--accent); border:1px solid rgba(26,71,42,.15); min-width:90px; height:24px; padding:0 8px;">＋ Re-promote</button>`;

    return `<div class="excl-item" style="margin-bottom:4px; opacity:0.8;">
      <div>
        <div class="excl-name name-c" data-sailor="${dataName}" style="cursor:pointer; color:var(--accent); text-decoration:underline; font-weight:600;">${safeName}</div>
        <div class="excl-reason">${safeGender} · ${safeBorn} · ${safeClub} · <span style="color:var(--red)">${escapeHtml(reason)}</span></div>
      </div>
      ${actionButton}
    </div>`;
  }).join('') || '<div class="excl-empty">No dropped sailors.</div>';
}

function dropSailor(name) {
  if (!requireEditor()) return;
  const cleaned = cleanSailorName(name);
  if (!cleaned) {
    alert('Could not drop sailor — missing name.');
    return;
  }
  markSailorDropped(cleaned);
  sanitizeDroppedSailors();
  recomputeSailors();
  saveData();
  renderAll();
  renderFleetPanel();
  updateSailorProfileFleetControls();
}

function promoteSailor(name) {
  if (!requireEditor()) return;
  const cleaned = cleanSailorName(name);
  if (!cleaned) {
    alert('Could not re-promote sailor — missing name.');
    return;
  }
  unmarkSailorDropped(cleaned);
  sanitizeDroppedSailors();
  // If they only appear dropped due to age limit, re-promote cannot override that
  const sys = getAllSailorsInSystem().find(s => isSameSailor(s.name, cleaned));
  if (sys && isAgeDropped(sys.born)) {
    alert(`"${cleaned}" is age-limited (born ${sys.born}) and stays out of active rankings. Only manually dropped sailors can be re-promoted.`);
  }
  recomputeSailors();
  saveData();
  renderAll();
  renderFleetPanel();
  updateSailorProfileFleetControls();
}

/** Sync Drop / Re-promote controls on the sailor profile panel. */
function updateSailorProfileFleetControls() {
  const dropBtn = document.getElementById('sm-drop-btn');
  const promoteBtn = document.getElementById('sm-promote-btn');
  const statusLbl = document.getElementById('sm-fleet-status-lbl');
  if (!dropBtn || !promoteBtn || !statusLbl) return;

  const name = cleanSailorName(document.getElementById('sm-orig-name')?.value || '');
  if (!name) {
    dropBtn.style.display = 'none';
    promoteBtn.style.display = 'none';
    statusLbl.textContent = '';
    return;
  }

  const sys = getAllSailorsInSystem().find(s => isSameSailor(s.name, name));
  const ageDrop = sys ? isAgeDropped(sys.born) : isAgeDropped(document.getElementById('sm-born')?.value);
  const manualDrop = isDroppedSailor(name);

  if (ageDrop) {
    dropBtn.style.display = 'none';
    promoteBtn.style.display = 'none';
    statusLbl.textContent = `Age limit (born ${sys?.born || '—'}) — hidden from rankings`;
    statusLbl.style.color = 'var(--red)';
  } else if (manualDrop) {
    dropBtn.style.display = 'none';
    promoteBtn.style.display = '';
    statusLbl.textContent = 'Dropped — hidden from rankings';
    statusLbl.style.color = 'var(--red)';
  } else {
    dropBtn.style.display = '';
    promoteBtn.style.display = 'none';
    statusLbl.textContent = 'Active fleet';
    statusLbl.style.color = 'var(--accent)';
  }
}

function quickFilter(sq) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-rankings').classList.add('active');
  document.getElementById('view-title').textContent = 'Rankings';
  document.getElementById('topbar-controls').style.display = 'flex';
  document.getElementById('squadFilter').value = sq;
  document.getElementById('top50').checked = false;
  renderRankings();
}

function updateDatabaseSourceTags() {
  const isSeed = !CLOUD_HAS_DATA || !REGATTAS.length;
  
  const sbTag = document.getElementById('sb-tag');
  if (sbTag) {
    sbTag.textContent = SAILORS.length ? SAILORS.length + ' sailors' : 'No file loaded';
    sbTag.className = SAILORS.length ? 'sb-tag ok' : 'sb-tag';
  }
  
  const footer = document.getElementById('sb-footer');
  if (footer) {
    footer.textContent = SAILORS.length 
      ? (isSeed ? 'Seed Dataset loaded · ' : 'Cloud Database loaded · ') + SAILORS.length + ' sailors'
      : 'Ranking Database';
  }
  
  const srcTag = document.getElementById('src-tag');
  if (srcTag) {
    srcTag.textContent = SAILORS.length 
      ? (isSeed ? 'Seed Data' : 'Cloud Database') 
      : 'No file loaded';
    srcTag.className = SAILORS.length ? 'src-tag ok' : 'src-tag';
  }
}

function renderAll() {
  renderRankingsPanel();
  renderRegattasPanel();
  renderExclusions();
  renderMajorCompsPanel();
  renderHistGoldPanel();
  populateTargetDropdown();
  populateSimDropdown('targetSailor');
  populateExclDropdown();
  populateResultsDropdown();
  populateRegattaCheckboxList();
  updateDatabaseSourceTags();
  if (CURRENT_SELECTED_REGATTA) {
    renderSpecificRegattaResults(CURRENT_SELECTED_REGATTA);
  }
}
