// Main Application Initialization & Event Listeners

let dataLoadedPromise = null;

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  dataLoadedPromise = loadData();
  setupDropZone();
  bindStaticEventListeners();
});

// Real-time viewer synchronization
function subscribeRealtime() {
  CLOUD_DOC().onSnapshot(snap => {
    if (!snap.exists) return;
    if (snap.metadata.hasPendingWrites) return; // our own optimistic echo
    if (SUPPRESS_SNAPSHOT) return;
    if (isEditor()) return;                      // don't clobber an editor's in-progress work
    
    const data = snap.data();
    if (data && Array.isArray(data.regattas)) {
      CLOUD_HAS_DATA = true;
      applyState(data);
    } else {
      CLOUD_HAS_DATA = false;
      applyStateFromSeed();
    }
    recomputeSailors();
    renderAll();
  }, err => console.error('Realtime listener error:', err));
}

// Authentication
function initAuth() {
  auth.onAuthStateChanged(async user => {
    CURRENT_USER = (user && user.email === ADMIN_EMAIL) ? user : null;
    applyEditorUI();
    if (CURRENT_USER) {
      if (dataLoadedPromise) await dataLoadedPromise;
      await maybeMigrate();
      backfillRegattaTotalSailors();
    }
    // Subscribe to updates in real-time
    subscribeRealtime();
  });
}

// One-time migration: legacy regattas created before "Total Sailors" was a
// mandatory field don't have reg.dns set. Backfill it with the number of
// sailor results currently entered (i.e. the fallback DNS score - 1) so the
// editor can review/correct each regatta's true fleet size in the UI.
function backfillRegattaTotalSailors() {
  if (!isEditor()) return;
  let changed = false;
  REGATTAS.forEach(reg => {
    if (reg.dns === undefined || reg.dns === null) {
      reg.dns = Math.max(reg.sailors ? reg.sailors.length : 0, 1);
      changed = true;
    }
  });
  if (changed) {
    recomputeSailors();
    saveData();
    renderAll();
    renderSpecificRegattaResults();
  }
}

function applyEditorUI() {
  document.body.classList.toggle('is-editor', isEditor());
  const btn = document.getElementById('auth-btn');
  if (btn) {
    btn.textContent = isEditor() ? '✓ Editing — sign out' : '🔒 Sign in to edit';
  }
  setSyncStatus(isEditor() ? (CLOUD_HAS_DATA ? 'saved' : 'unpublished') : 'view');
  
  if (!isEditor()) {
    const editorOnlyViews = ['simulator', 'target', 'exclusions', 'charts', 'major-comps', 'hist-gold', 'fleet'];
    if (editorOnlyViews.includes(lastMainView)) {
      switchView('rankings');
    }
  }

  if (typeof renderAll === 'function') {
    renderAll();
  }
  if (typeof renderSpecificRegattaResults === 'function') {
    renderSpecificRegattaResults();
  }
}

async function signInEditor() {
  const pass = prompt('Enter the editor passcode:');
  if (!pass) return;
  try {
    await auth.signInWithEmailAndPassword(ADMIN_EMAIL, pass);
  } catch (e) {
    alert('Incorrect passcode — still in view-only mode.');
  }
}

function signOutEditor() {
  auth.signOut();
}

function setSyncStatus(state, detail) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const map = {
    view:   ['View-only',    'var(--text3)', 'var(--bg2)'],
    locked: ['🔒 View-only', 'var(--red)',   'var(--red-l)'],
    saving: ['Saving…',      'var(--accent2)','var(--accent2-l)'],
    saved:  ['✓ Synced',     'var(--accent)','var(--accent-l)'],
    unpublished: ['⚠ Not on cloud', 'var(--accent3)','var(--accent3-l)'],
    error:  ['⚠ Not saved',  'var(--red)',   'var(--red-l)']
  };
  const [label, color, bg] = map[state] || map.view;
  el.textContent = label;
  el.style.color = color;
  el.style.background = bg;
  el.title = state === 'error' && detail ? ('Save failed: ' + detail) : '';
}

// Excel drop zone setup
function setupDropZone() {
  const ov = document.getElementById('dropOverlay');
  const dz = document.getElementById('main-dz');
  
  if (ov) {
    document.addEventListener('dragover', e => {
      e.preventDefault();
      ov.classList.add('show');
    });
    document.addEventListener('dragleave', e => {
      if (!e.relatedTarget) ov.classList.remove('show');
    });
    document.addEventListener('drop', e => {
      e.preventDefault();
      ov.classList.remove('show');
      const f = e.dataTransfer?.files[0];
      if (f) loadFile(f);
    });
  }
  if (dz) {
    dz.addEventListener('click', () => document.getElementById('fileInput')?.click());
    dz.addEventListener('dragover', e => {
      e.preventDefault();
      dz.classList.add('over');
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('over');
      const f = e.dataTransfer?.files[0];
      if (f) loadFile(f);
    });
  }
  
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) loadFile(e.target.files[0]);
      e.target.value = '';
    });
  }
}

function loadFile(file) {
  if (!requireEditor()) return;
  const n = file.name.toLowerCase();
  if (!n.endsWith('.xlsx') && !n.endsWith('.xlsm') && !n.endsWith('.xls')) {
    alert('Please drop an Excel file (.xlsx, .xlsm, or .xls).');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sn = wb.SheetNames.find(n => /sheet1/i.test(n)) || wb.SheetNames[0];
      parseSheet(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null }), file.name);
    } catch (err) {
      alert('Could not read file: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseVal(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '' || isNaN(s)) return null;
  return parseFloat(s);
}

function getRegattaDateByName(name) {
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const clean = name.toLowerCase().replace(/_/g, ' ');
  const regex = /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[^0-9]*(\d{2,4})/i;
  const match = clean.match(regex);
  if (match) {
    const mName = match[1];
    let yStr = match[2];
    const mVal = months[mName];
    if (yStr.length === 2) {
      yStr = '20' + yStr;
    }
    return `${yStr}-${mVal}-15`;
  }
  
  if (clean.includes('pesta sukan')) return '2025-08-10';
  if (clean.includes('rsyc')) return '2025-08-25';
  if (clean.includes('snsc')) return '2025-09-15';
  if (clean.includes('csc gold') || clean.includes('csc')) return '2026-01-26';
  if (clean.includes('pulau ujong')) return '2026-02-26';
  if (clean.includes('sysc')) return '2026-03-05';
  if (clean.includes('safyc') && clean.includes('26')) return '2026-03-20';
  if (clean.includes('temasek')) return '2026-06-20';
  
  return new Date().toISOString().split('T')[0];
}

function parseSheet(data, filename) {
  const headers = data[0] || [];
  let hasConsolidated = false;
  const col0 = String(headers[0] || '').toLowerCase();
  const col1 = String(headers[1] || '').toLowerCase();
  if (col0.includes('name') && (col1.includes('gender') || col1.includes('g') || col1.includes('sex'))) {
    if (headers.length > 6) {
      hasConsolidated = true;
    }
  }

  const parsedRegs = [];

  if (hasConsolidated) {
    const isProfileHeader = (header) => {
      const h = String(header || '').toLowerCase().trim();
      if (!h) return false;
      const exacts = ['name', 'sailor', 'gender', 'g', 'sex', 'born', 'birth year', 'year', 'club', 'school', 'sch', 'squad', 'group', 'age', 'sail no', 'sail number', 'sailno', 'no', 'no.'];
      if (exacts.includes(h)) return true;
      if (h.startsWith('name') || h.startsWith('sailor') || h.startsWith('gender') || h.startsWith('club') || h.startsWith('school')) return true;
      return false;
    };

    let startCol = 6;
    for (let c = 0; c < headers.length; c++) {
      const h = String(headers[c] || '').toLowerCase().trim();
      if (!h) continue;
      const isProfile = isProfileHeader(h);
      if (!isProfile && c >= 5) {
        startCol = c;
        break;
      }
    }

    let col = startCol;
    const regColumns = [];
    while (col < headers.length) {
      const headerText = String(headers[col] || '').trim();
      if (!headerText) {
        col++;
        continue;
      }
      
      const cleanName = headerText.replace(/\b(ranking|points|pts|rank)\b/gi, '').trim();
      const nextHeader = col + 1 < headers.length ? String(headers[col + 1] || '').toLowerCase() : '';
      const isNextPoints = nextHeader.includes('points') || nextHeader.includes('pts');
      
      if (isNextPoints) {
        regColumns.push({
          name: cleanName,
          idx: col,
          hasPoints: true,
          date: getRegattaDateByName(cleanName)
        });
        col += 2;
      } else {
        regColumns.push({
          name: cleanName,
          idx: col,
          hasPoints: false,
          date: getRegattaDateByName(cleanName)
        });
        col += 1;
      }
    }

    regColumns.forEach(colObj => {
      const sailors = [];
      for (let i = 1; i < data.length; i++) {
        const r = data[i];
        if (!r || !r[0]) continue;
        const name = String(r[0]).trim();
        if (!name || name.toLowerCase() === 'name') continue;
        const g = String(r[1] || '').trim().toUpperCase();
        const born = parseInt(r[2]) || 0;
        const club = String(r[4] || '').trim();
        const school = String(r[5] || '').trim();
        
        let finalNett = null;
        let finalRank = null;
        
        if (!colObj.hasPoints) {
          const val = parseVal(r[colObj.idx]);
          finalNett = null;
          finalRank = val;
        } else {
          finalRank = parseVal(r[colObj.idx]);
          finalNett = parseVal(r[colObj.idx + 1]);
          if (finalNett === null) finalNett = finalRank;
          if (finalRank === null) finalRank = finalNett;
        }
        
        if (finalRank !== null) {
          sailors.push({ 
            name, 
            g, 
            born, 
            club, 
            school,
            nett: finalNett, 
            rank: finalRank 
          });
        }
      }
      if (sailors.length > 0) {
        parsedRegs.push({
          name: colObj.name,
          date: colObj.date,
          sailors: sailors
        });
      }
    });
  } else {
    let nameIdx = -1, genderIdx = -1, bornIdx = -1, clubIdx = -1, nettIdx = -1, rankIdx = -1;
    for (let c = 0; c < headers.length; c++) {
      const h = String(headers[c] || '').toLowerCase().trim();
      if (h === 'name' || h === 'sailor') nameIdx = c;
      else if (h === 'gender' || h === 'g' || h === 'sex') genderIdx = c;
      else if (h === 'born' || h === 'birth year' || h === 'year') bornIdx = c;
      else if (h === 'club') clubIdx = c;
      else if (h === 'points' || h === 'nett' || h === 'score') nettIdx = c;
      else if (h === 'rank' || h === 'pos' || h === 'position') rankIdx = c;
    }
    if (nameIdx === -1) nameIdx = 0;
    if (genderIdx === -1) genderIdx = 1;
    if (bornIdx === -1) bornIdx = 2;
    if (clubIdx === -1) clubIdx = 4;
    
    if (nettIdx === -1) {
      for (let c = 0; c < headers.length; c++) {
        const h = String(headers[c] || '').toLowerCase();
        if (h.includes('nett') || h.includes('points') || h.includes('score')) { nettIdx = c; break; }
      }
    }
    if (rankIdx === -1) {
      for (let c = 0; c < headers.length; c++) {
        const h = String(headers[c] || '').toLowerCase();
        if (h.includes('rank') || h.includes('pos') || h.includes('position')) { rankIdx = c; break; }
      }
    }
    
    if (nettIdx === -1 && rankIdx !== -1) nettIdx = rankIdx;
    if (rankIdx === -1 && nettIdx !== -1) rankIdx = nettIdx;
    if (nettIdx === -1) nettIdx = headers.length - 1;
    if (rankIdx === -1) rankIdx = headers.length - 1;

    let schoolIdx = headers.findIndex(h => /school|sch/i.test(String(h)));
    if (schoolIdx === -1) schoolIdx = 5;

    const sailors = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r || !r[nameIdx]) continue;
      const name = String(r[nameIdx]).trim();
      if (!name || name.toLowerCase() === 'name') continue;
      const g = String(r[genderIdx] || '').trim().toUpperCase();
      const born = parseInt(r[bornIdx]) || 0;
      const club = String(r[clubIdx] || '').trim();
      const school = schoolIdx !== -1 ? String(r[schoolIdx] || '').trim() : '';
      const nett = parseVal(r[nettIdx]);
      const rank = parseVal(r[rankIdx]);
      if (nett !== null || rank !== null) {
        sailors.push({ 
          name, 
          g, 
          born, 
          club, 
          school,
          nett: nett !== null ? nett : rank, 
          rank: rank !== null ? rank : nett 
        });
      }
    }
    if (sailors.length > 0) {
      const cleanName = filename.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
      parsedRegs.push({
        name: cleanName,
        date: getRegattaDateByName(cleanName),
        sailors: sailors
      });
    }
  }
  
  if (parsedRegs.length > 0) {
    showImportConfirmation(parsedRegs);
  }
}

let PENDING_IMPORT_DATA = null;

function showImportConfirmation(parsedRegs) {
  PENDING_IMPORT_DATA = parsedRegs;
  
  const regattaStatuses = [];
  const newSailors = [];
  const scoreUpdates = [];
  const currentSailors = getAllSailorsInSystem();
  const sortedCurrentSailors = [...currentSailors].sort((a, b) => a.name.localeCompare(b.name));
  
  parsedRegs.forEach(parsedReg => {
    const existingReg = REGATTAS.find(r => r.name.toLowerCase() === parsedReg.name.toLowerCase());
    if (!existingReg) {
      regattaStatuses.push({ name: parsedReg.name, status: 'New', sailorsCount: parsedReg.sailors.length });
    } else {
      regattaStatuses.push({ name: parsedReg.name, status: 'Existing', sailorsCount: parsedReg.sailors.length });
    }
    
    parsedReg.sailors.forEach(parsedSailor => {
      const isSystemNew = !currentSailors.some(s => isSameSailor(s.name, parsedSailor.name));
      if (isSystemNew && !newSailors.some(s => isSameSailor(s.name, parsedSailor.name))) {
        newSailors.push(parsedSailor);
      }
      
      if (existingReg) {
        const existingSailor = existingReg.sailors.find(x => isSameSailor(x.name, parsedSailor.name));
        if (existingSailor) {
          const rankChanged = existingSailor.rank !== parsedSailor.rank;
          const nettChanged = existingSailor.nett !== parsedSailor.nett;
          if (rankChanged || nettChanged) {
            scoreUpdates.push({
              sailorName: parsedSailor.name,
              regattaName: existingReg.name,
              oldRank: existingSailor.rank,
              newRank: parsedSailor.rank,
              oldNett: existingSailor.nett,
              newNett: parsedSailor.nett
            });
          }
        } else {
          scoreUpdates.push({
            sailorName: parsedSailor.name,
            regattaName: existingReg.name,
            oldRank: null,
            newRank: parsedSailor.rank,
            oldNett: null,
            newNett: parsedSailor.nett,
            isNewEntry: true
          });
        }
      }
    });
  });

  regattaStatuses.sort((a, b) => {
    if (a.status === 'New' && b.status !== 'New') return -1;
    if (a.status !== 'New' && b.status === 'New') return 1;
    return a.name.localeCompare(b.name);
  });

  const container = document.getElementById('import-changes-container');
  if (!container) return;
  
  let col1Html = `<div class="card" style="display:flex; flex-direction:column; height:100%; overflow:hidden; padding:18px;">
    <div style="font-weight:600; font-family:var(--mono); font-size:12px; color:var(--accent); margin-bottom:12px; display:flex; align-items:center; gap:6px; border-bottom:1px solid var(--border); padding-bottom:8px; flex-shrink:0;">
      🟩 PART 1: CONFIRM REGATTAS (${regattaStatuses.length})
    </div>
    <div style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;">
      ${regattaStatuses.map(r => {
        const badgeClass = r.status === 'New' ? 'badge b-a' : 'badge b-ds';
        const badgeLabel = r.status === 'New' ? 'New Regatta' : 'Existing (Merge)';
        const styleText = r.status === 'New' ? 'font-weight:600; color:var(--accent);' : 'color:var(--text);';
        return `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--bg2); padding:6px 0;">
          <div>
            <div style="${styleText} font-size:12px;">${escapeHtml(r.name)}</div>
            <div style="font-size:10px; color:var(--text3);">${r.sailorsCount} sailors in sheet</div>
          </div>
          <span class="${badgeClass}" style="font-size:9px; padding:2px 6px;">${badgeLabel}</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  let col2Html = `<div class="card" style="display:flex; flex-direction:column; height:100%; overflow:hidden; padding:18px;">
    <div style="font-weight:600; font-family:var(--mono); font-size:12px; color:var(--accent2); margin-bottom:12px; display:flex; align-items:center; gap:6px; border-bottom:1px solid var(--border); padding-bottom:8px; flex-shrink:0;">
      🟦 PART 2: SAILOR RECONCILIATION (${newSailors.length})
    </div>
    <div style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;">
      ${newSailors.length === 0 ? '<div style="text-align:center; padding:32px; color:var(--text3); font-size:11px; font-family:var(--mono);">✓ All sailors matched to existing profiles.</div>' : 
      newSailors.map(s => {
        const options = [`<option value="">No, create as new sailor</option>`];
        sortedCurrentSailors.forEach(curr => {
          options.push(`<option value="${escapeHtml(curr.name)}">Merge with ${escapeHtml(curr.name)}</option>`);
        });
        
        return `<div style="border-bottom:1px dashed var(--border); padding:8px 0; display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:11.5px; font-weight:600;">• ${escapeHtml(s.name)} <span style="font-weight:normal; font-size:10px; color:var(--text3);">(${escapeHtml(s.g || 'M')}, Born ${escapeHtml(s.born || '—')})</span></div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <span style="font-size:9.5px; color:var(--text3);">Action:</span>
            <select class="sailor-merge-select" data-new-name="${s.name.replace(/"/g, '&quot;')}" style="height:24px; font-size:10.5px; font-family:var(--sans); width:190px; border:1px solid var(--border); border-radius:4px;">
              ${options.join('')}
            </select>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  let col3Html = `<div class="card" style="display:flex; flex-direction:column; height:100%; overflow:hidden; padding:18px;">
    <div style="font-weight:600; font-family:var(--mono); font-size:12px; color:var(--accent3); margin-bottom:12px; display:flex; align-items:center; gap:6px; border-bottom:1px solid var(--border); padding-bottom:8px; flex-shrink:0;">
      🟧 PART 3: REVISED SCORES & RANKS (${scoreUpdates.length})
    </div>
    <div style="flex:1; overflow-y:auto; padding-right:4px;">
      ${scoreUpdates.length === 0 ? '<div style="text-align:center; padding:32px; color:var(--text3); font-size:11px; font-family:var(--mono);">✓ No score or rank changes detected.</div>' : `
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead>
            <tr style="background:var(--bg2); font-family:var(--mono); font-size:10px; text-transform:uppercase; color:var(--text2); height:28px;">
              <th style="text-align:left; padding-left:6px;">Sailor</th>
              <th style="text-align:left;">Regatta</th>
              <th style="text-align:center; width:80px;">Rank</th>
              <th style="text-align:center; width:80px;">Points</th>
              <th style="text-align:center; width:70px;">Type</th>
            </tr>
          </thead>
          <tbody>
            ${scoreUpdates.map(u => {
              const rankCell = u.oldRank === u.newRank 
                ? `<span>${u.newRank || '—'}</span>`
                : `<span style="color:var(--text3); text-decoration:line-through; font-size:9.5px; margin-right:4px;">${u.oldRank || '—'}</span>➔<strong style="color:var(--accent); margin-left:4px;">${u.newRank || '—'}</strong>`;
              
              const nettCell = u.oldNett === u.newNett
                ? `<span>${u.newNett || '—'}</span>`
                : `<span style="color:var(--text3); text-decoration:line-through; font-size:9.5px; margin-right:4px;">${u.oldNett || '—'}</span>➔<strong style="color:var(--accent2); margin-left:4px;">${u.newNett || '—'}</strong>`;
                
              const statusLabel = u.isNewEntry 
                ? '<span class="badge b-a" style="font-size:8px; padding:1px 4px;">New</span>'
                : '<span class="badge b-ds" style="font-size:8px; padding:1px 4px; background:var(--accent3-l); color:var(--accent3);">Diff</span>';

              return `<tr style="border-bottom:1px solid var(--border); height:32px;">
                <td style="font-weight:600; padding-left:6px;">${escapeHtml(u.sailorName)}</td>
                <td>${escapeHtml(u.regattaName)}</td>
                <td style="text-align:center;">${rankCell}</td>
                <td style="text-align:center;">${nettCell}</td>
                <td style="text-align:center;">${statusLabel}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
  </div>`;

  container.innerHTML = col1Html + col2Html + col3Html;
  document.getElementById('importConfirmModal').style.display = 'flex';
}

function closeImportModal() {
  document.getElementById('importConfirmModal').style.display = 'none';
  PENDING_IMPORT_DATA = null;
}

function confirmPendingImport() {
  if (!requireEditor()) return;
  if (!PENDING_IMPORT_DATA) return;
  
  const mergeSelects = document.querySelectorAll('.sailor-merge-select');
  const nameMap = new Map();
  mergeSelects.forEach(sel => {
    const newName = sel.getAttribute('data-new-name');
    const existingName = sel.value;
    if (existingName) {
      nameMap.set(newName, existingName);
    }
  });

  PENDING_IMPORT_DATA.forEach(col => {
    col.sailors.forEach(s => {
      if (nameMap.has(s.name)) {
        s.name = nameMap.get(s.name);
      }
    });

    const existing = REGATTAS.find(r => r.name.toLowerCase() === col.name.toLowerCase());
    if (existing) {
      col.sailors.forEach(newSailor => {
        const sIdx = existing.sailors.findIndex(x => isSameSailor(x.name, newSailor.name));
        if (sIdx !== -1) {
          existing.sailors[sIdx].nett = newSailor.nett;
          existing.sailors[sIdx].rank = newSailor.rank;
          if (newSailor.g) existing.sailors[sIdx].g = newSailor.g;
          if (newSailor.born) existing.sailors[sIdx].born = newSailor.born;
          if (newSailor.club) existing.sailors[sIdx].club = newSailor.club;
          if (newSailor.school) existing.sailors[sIdx].school = newSailor.school;
        } else {
          existing.sailors.push(newSailor);
        }
      });
    } else {
      REGATTAS.push({
        name: col.name,
        date: col.date,
        sailors: col.sailors
      });
    }
  });

  recomputeSailors();
  saveData();
  renderAll();
  closeImportModal();
  alert("Spreadsheet imported successfully!");
}

function uploadFleetExcel(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sn = wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
      
      const headers = rows[0] || [];
      let nameIdx = -1, genderIdx = -1, bornIdx = -1, clubIdx = -1, schoolIdx = -1;
      
      for (let c = 0; c < headers.length; c++) {
        const h = String(headers[c] || '').toLowerCase().trim();
        if (h === 'name' || h === 'sailor') nameIdx = c;
        else if (h === 'gender' || h === 'g' || h === 'sex') genderIdx = c;
        else if (h === 'born' || h === 'birth year' || h === 'year') bornIdx = c;
        else if (h === 'club') clubIdx = c;
        else if (h === 'school' || h === 'sch') schoolIdx = c;
      }
      
      if (nameIdx === -1) nameIdx = 0;
      if (genderIdx === -1) genderIdx = 1;
      if (bornIdx === -1) bornIdx = 2;
      if (clubIdx === -1) clubIdx = 4;
      if (schoolIdx === -1) schoolIdx = 5;
      
      let importedCount = 0;
      const currentSystemSailors = getAllSailorsInSystem();
      
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[nameIdx]) continue;
        const name = String(r[nameIdx]).trim();
        if (!name || name.toLowerCase() === 'name') continue;
        
        const gender = String(r[genderIdx] || 'M').trim().toUpperCase();
        const born = parseInt(r[bornIdx]) || 2013;
        const club = String(r[clubIdx] || '').trim();
        const school = String(r[schoolIdx] || '').trim();
        
        DROPPED_SAILORS.delete(name);
        
        const existing = currentSystemSailors.find(s => isSameSailor(s.name, name));
        if (!existing) {
          if (REGATTAS.length > 0) {
            const latestReg = REGATTAS[REGATTAS.length - 1];
            latestReg.sailors.push({
              name,
              g: gender,
              born,
              club,
              school,
              nett: null,
              rank: null
            });
          }
        }
        importedCount++;
      }
      
      recomputeSailors();
      saveData();
      renderAll();
      renderFleetPanel();
      alert(`Successfully processed fleet Excel. Activated / Promoted ${importedCount} sailors!`);
    } catch (err) {
      alert('Could not read fleet Excel file: ' + err.message);
    }
    input.value = '';
  };
  reader.readAsArrayBuffer(file);
}

function exportDataToCode() {
  const exportPayload = {
    REGATTAS,
    DROPPED_SAILORS: Array.from(DROPPED_SAILORS),
    EXCLUDED: Array.from(EXCLUDED.entries()),
    SAILOR_METADATA
  };
  const codeBlock = JSON.stringify(exportPayload);
  
  const tempTextArea = document.createElement("textarea");
  tempTextArea.value = codeBlock;
  document.body.appendChild(tempTextArea);
  tempTextArea.select();
  document.execCommand("copy");
  document.body.removeChild(tempTextArea);
  
  alert("Database code copied to clipboard! Please paste this block back into the chat window so I can permanently bake it into the website.");
}

function getActiveRegattas() {
  const selectionRegs = [...REGATTAS];
  if (SELECTED_REGATTA_NAMES === null) {
    const regWithResults = selectionRegs.filter(r => r.sailors && r.sailors.length > 0);
    return regWithResults.slice(-5);
  }
  return selectionRegs.filter(r => SELECTED_REGATTA_NAMES.includes(r.name));
}

function getAllSailorsInSystem() {
  const allNames = new Map();
  const normalizedToOriginal = new Map();
  
  REGATTAS.forEach(reg => {
    reg.sailors.forEach(s => {
      const norm = normalizeName(s.name);
      let matchedKey = normalizedToOriginal.get(norm);
      if (!matchedKey) {
        matchedKey = s.name;
        normalizedToOriginal.set(norm, matchedKey);
        allNames.set(matchedKey, {
          name: s.name,
          g: s.g,
          born: s.born,
          club: s.club,
          school: s.school || ''
        });
      } else {
        const obj = allNames.get(matchedKey);
        if (s.g && !obj.g) obj.g = s.g;
        if (s.born && !obj.born) obj.born = s.born;
        if (s.club && !obj.club) obj.club = s.club;
        if (s.school && !obj.school) obj.school = s.school;
      }
    });
  });
  return Array.from(allNames.values());
}

function addNewFleetSailor() {
  if (!requireEditor()) return;
  const name = document.getElementById('fleet-add-name').value.trim();
  const gender = document.getElementById('fleet-add-gender').value;
  const born = parseInt(document.getElementById('fleet-add-born').value) || 2013;
  const club = document.getElementById('fleet-add-club').value.trim();
  const school = document.getElementById('fleet-add-school').value.trim();
  
  if (!name) {
    alert("Please enter a sailor name.");
    return;
  }
  
  const currentSystemSailors = getAllSailorsInSystem();
  const existing = currentSystemSailors.find(s => isSameSailor(s.name, name));
  
  if (existing) {
    if (DROPPED_SAILORS.has(existing.name)) {
      DROPPED_SAILORS.delete(existing.name);
      alert(`"${name}" was already in the database and has been re-promoted to active fleet.`);
    } else {
      alert(`"${name}" is already an active sailor.`);
      return;
    }
  } else {
    if (REGATTAS.length > 0) {
      const latestReg = REGATTAS[REGATTAS.length - 1];
      latestReg.sailors.push({
        name,
        g: gender,
        born,
        club,
        school,
        nett: null,
        rank: null
      });
    } else {
      alert("No regattas loaded yet. Please drop an Excel file to initialize the system first.");
      return;
    }
  }
  
  document.getElementById('fleet-add-name').value = '';
  document.getElementById('fleet-add-club').value = '';
  document.getElementById('fleet-add-school').value = '';
  
  recomputeSailors();
  saveData();
  renderAll();
  renderFleetPanel();
  alert(`Successfully added "${name}" to the active fleet.`);
}

function clearAllData() {
  if (!requireEditor()) return;
  if (confirm("Clear ALL shared cloud data (regattas, exclusions, drops, metadata)? Everyone will see an empty database until a new sheet is uploaded.")) {
    REGATTAS = [];
    SAILORS = [];
    DROPPED_SAILORS = new Set();
    EXCLUDED = new Map();
    SAILOR_METADATA = {};
    SELECTED_REGATTA_NAMES = null;
    saveData();

    const tag = document.getElementById('sb-tag');
    if (tag) {
      tag.textContent = 'No file loaded';
      tag.className = 'sb-tag';
    }
    const footer = document.getElementById('sb-footer');
    if (footer) footer.textContent = 'Ranking Database';
    
    const srcTag = document.getElementById('src-tag');
    if (srcTag) {
      srcTag.textContent = 'No file loaded';
      srcTag.className = 'src-tag';
    }
    
    renderAll();
    alert("Platform cleared successfully. Ready for your Excel upload!");
  }
}

function handleSort(key) {
  if (sortKey === key) {
    sortAsc = !sortAsc;
  } else {
    sortKey = key;
    sortAsc = true;
  }
  renderRankings();
}

function getSortIndicator(key) {
  if (sortKey !== key) return ' <span style="font-size:8px;color:var(--text3);opacity:0.3;">↕</span>';
  return sortAsc ? ' <span style="font-size:9px;color:var(--accent);font-weight:bold">▲</span>' : ' <span style="font-size:9px;color:var(--accent);font-weight:bold">▼</span>';
}

function handleMcSort(key) {
  if (mcSortKey === key) {
    mcSortAsc = !mcSortAsc;
  } else {
    mcSortKey = key;
    mcSortAsc = true;
  }
  renderMajorCompsPanel();
}

function getMcSortIndicator(key) {
  if (mcSortKey !== key) return '';
  return mcSortAsc ? ' ▲' : ' ▼';
}

function handleHgSort(key) {
  if (hgSortKey === key) {
    hgSortAsc = !hgSortAsc;
  } else {
    hgSortKey = key;
    hgSortAsc = true;
  }
  renderHistGoldPanel();
}

function getHgSortIndicator(key) {
  if (hgSortKey !== key) return '';
  return hgSortAsc ? ' ▲' : ' ▼';
}

function openAddRegattaModal() {
  if (!requireEditor()) return;
  document.getElementById('ar-name').value = '';
  document.getElementById('ar-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('ar-dns').value = '100';
  const cb = document.getElementById('ar-add-gold-sailors');
  if (cb) cb.checked = false;
  document.getElementById('addRegattaModal').style.display = 'flex';
}

function closeAddRegattaModal() {
  document.getElementById('addRegattaModal').style.display = 'none';
}

function submitAddRegatta() {
  if (!requireEditor()) return;
  const name = document.getElementById('ar-name').value.trim();
  const date = document.getElementById('ar-date').value;
  const dns = parseInt(document.getElementById('ar-dns').value);
  if (!name || !date) {
    alert("Please fill in both name and date.");
    return;
  }
  if (isNaN(dns) || dns < 1) {
    alert("Please enter the total number of sailors in the regatta (positive integer).");
    return;
  }

  if (REGATTAS.some(r => r.name.toLowerCase() === name.toLowerCase())) {
    alert("A regatta with this name already exists.");
    return;
  }

  const addGold = document.getElementById('ar-add-gold-sailors')?.checked ?? false;
  const sailors = [];
  if (addGold) {
    // Build a map from normalised name → canonical name for every known sailor,
    // so we can look up SAILOR_METADATA regardless of minor name-casing differences.
    const normToCanonical = new Map(); // normalised → canonical name used as SAILOR_METADATA key
    const normToSysObj  = new Map();  // normalised → object with g/born/club/school

    // 1. Start with SAILOR_METADATA keys (these may include sailors not yet in any regatta)
    Object.keys(SAILOR_METADATA).forEach(n => {
      const norm = normalizeName(n);
      if (!normToCanonical.has(norm)) normToCanonical.set(norm, n);
    });

    // 2. Layer in allSystem sailors (gives us the g/born/club/school profile)
    const allSystem = getAllSailorsInSystem();
    allSystem.forEach(s => {
      const norm = normalizeName(s.name);
      normToSysObj.set(norm, s);
      // If this name wasn't in SAILOR_METADATA yet, record it as canonical too
      if (!normToCanonical.has(norm)) normToCanonical.set(norm, s.name);
    });

    normToCanonical.forEach((canonicalName, norm) => {
      const meta = SAILOR_METADATA[canonicalName] || {};

      // Resolve profile data from allSystem (for g/born/club/school)
      const sysObj = normToSysObj.get(norm);
      const born   = sysObj?.born   || meta.born   || 0;
      const g      = sysObj?.g      || meta.g      || 'M';
      const club   = sysObj?.club   || meta.club   || '';
      const school = sysObj?.school || meta.school || '';

      // Exclude age-limit-dropped sailors (born too early for Optimist class)
      if (isAgeDropped(born)) return;

      // Exclude manually dropped sailors
      if (DROPPED_SAILORS.has(canonicalName)) return;
      // Also check by normalised name in case casing differs
      let isDropped = false;
      DROPPED_SAILORS.forEach(d => { if (normalizeName(d) === norm) isDropped = true; });
      if (isDropped) return;

      sailors.push({
        name: sysObj?.name || canonicalName,
        g, born, club, school,
        nett: null,
        rank: null
      });
    });
  }

  REGATTAS.push({
    name: name,
    date: date,
    dns: dns,
    sailors: sailors
  });

  recomputeSailors();
  saveData();
  renderAll();
  closeAddRegattaModal();
  if (addGold) {
    alert(`Added upcoming regatta "${name}" and populated with ${sailors.length} Gold Fleet sailors.`);
  } else {
    alert(`Added upcoming regatta "${name}". You can now add sailor scores in their profiles.`);
  }
}

function toggleRegattaDropdown() {
  const dropdown = document.getElementById('regatta-select-dropdown');
  if (dropdown) {
    const isHidden = dropdown.style.display === 'none';
    dropdown.style.display = isHidden ? 'block' : 'none';
  }
}

function onRegattaCheckboxChange() {
  const checkboxes = document.querySelectorAll('#regatta-checkboxes-list input[type="checkbox"]');
  const selected = [];
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selected.push(cb.value);
    }
  });
  if (!requireEditor()) return;
  SELECTED_REGATTA_NAMES = selected;
  recomputeSailors();
  saveData();
  renderAll();
}

function resetRegattasToDefault(event) {
  if (event) event.preventDefault();
  if (!requireEditor()) return;
  SELECTED_REGATTA_NAMES = null;
  recomputeSailors();
  saveData();
  renderAll();
}

// Resolve a view ID from the current URL hash; returns null if not a known tab.
const VALID_VIEWS = ['rankings', 'regattas', 'simulator', 'target', 'exclusions', 'charts', 'major-comps', 'hist-gold', 'fleet'];
function viewIdFromHash(hash) {
  const id = (hash || '').replace(/^#/, '');
  return VALID_VIEWS.includes(id) ? id : null;
}

// Bind all page events programmatically (replaces inline elements)
function bindStaticEventListeners() {
  // Navigation sidebar buttons (using data-view attribute)
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.getAttribute('data-view');
      if (viewId) switchView(viewId, btn);
    });
  });

  // Handle browser back/forward navigation via popstate
  window.addEventListener('popstate', e => {
    const viewId = (e.state && e.state.viewId) || viewIdFromHash(window.location.hash) || 'rankings';
    switchView(viewId, null, /*skipHash=*/true);
  });

  // On first load, navigate to the tab indicated by the URL hash (if any)
  const initialView = viewIdFromHash(window.location.hash);
  if (initialView && initialView !== 'rankings') {
    // Defer until after data has loaded so renders work correctly
    dataLoadedPromise.then(() => switchView(initialView, null, /*skipHash=*/true));
  }

  // Sidebar Logo view trigger
  document.querySelector('.sb-logo')?.addEventListener('click', () => switchView('rankings'));

  // Quick Squad Filters
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const squad = btn.getAttribute('data-squad');
      if (squad) quickFilter(squad);
    });
  });

  // Excel Upload buttons triggers
  document.getElementById('load-xlsx-trigger')?.addEventListener('click', () => {
    document.getElementById('fileInput')?.click();
  });
  document.getElementById('fleet-excel-upload-trigger')?.addEventListener('click', () => {
    document.getElementById('fleetFileInput')?.click();
  });
  document.getElementById('overwrite-cloud-btn')?.addEventListener('click', () => {
    forceMigrateLocalToCloud();
  });

  // Auth Button
  const authBtn = document.getElementById('auth-btn');
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      if (isEditor()) signOutEditor();
      else signInEditor();
    });
  }

  // Rankings Panel Filter and Search elements
  document.getElementById('nameSearch')?.addEventListener('input', () => renderRankings());
  document.getElementById('squadFilter')?.addEventListener('change', () => {
    renderRankings();
    renderComparisonChart();
  });
  document.getElementById('top50')?.addEventListener('change', () => renderRankings());
  
  // Gender Filter Pills (All / Boys / Girls)
  document.querySelectorAll('.pill[data-gender]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill[data-gender]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      genderFilter = pill.getAttribute('data-gender');
      renderRankings();
    });
  });

  // Exclusions panel controls
  document.getElementById('add-excl-btn')?.addEventListener('click', () => addExcl());
  
  // Exclusions reason buttons
  document.querySelectorAll('.reason-btn[data-reason]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.reason-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedReason = btn.getAttribute('data-reason');
    });
  });

  // Exclusions List delegation
  document.getElementById('excl-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.excl-remove-btn');
    if (btn) removeExcl(btn.getAttribute('data-name'));
  });

  // Regatta list landing view clicks
  document.getElementById('regatta-list')?.addEventListener('click', e => {
    const deleteBtn = e.target.closest('.regatta-delete-btn');
    if (deleteBtn) {
      e.stopPropagation();
      deleteRegattaEntirely(deleteBtn.getAttribute('data-name'));
      return;
    }

    const card = e.target.closest('.regatta-card');
    if (card) {
      const regName = card.getAttribute('data-name');
      renderSpecificRegattaResults(regName);
    }
  });

  // Fleet list active/dropped delegation
  document.getElementById('fleet-active-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.fleet-drop-btn');
    if (btn) dropSailor(btn.getAttribute('data-sailor'));
  });
  document.getElementById('fleet-dropped-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.fleet-promote-btn');
    if (btn) promoteSailor(btn.getAttribute('data-sailor'));
  });

  // Manage Fleet panel inputs/buttons
  document.getElementById('fleet-search-active')?.addEventListener('input', () => renderFleetPanel());
  document.getElementById('fleet-search-dropped')?.addEventListener('input', () => renderFleetPanel());
  document.getElementById('sim-add-sailor-btn')?.addEventListener('click', () => addSailorInput());
  document.getElementById('fleet-add-sailor-btn')?.addEventListener('click', () => addNewFleetSailor());
  document.getElementById('fleetFileInput')?.addEventListener('change', e => {
    if (e.target.files[0]) uploadFleetExcel(e.target);
  });

  
  // Major Competitions Panel elements
  document.getElementById('mc-only-participants')?.addEventListener('change', () => renderMajorCompsPanel());
  document.getElementById('mc-search')?.addEventListener('input', () => renderMajorCompsPanel());

  // Dominance chart filters click delegator
  document.getElementById('dominance-filters')?.addEventListener('click', e => {
    const btn = e.target.closest('.dominance-filter-btn');
    if (btn) {
      const squad = btn.getAttribute('data-squad');
      filterDominanceChart(squad, btn);
    }
  });

  // Historical gold panel elements
  document.getElementById('hg-search')?.addEventListener('input', () => renderHistGoldPanel());
  document.getElementById('hg-only-active')?.addEventListener('change', () => renderHistGoldPanel());

  // Dynamic dialog modals controls
  document.getElementById('ar-modal-open-btn')?.addEventListener('click', () => openAddRegattaModal());
  document.getElementById('ar-modal-close-btn')?.addEventListener('click', () => closeAddRegattaModal());
  document.getElementById('ar-modal-submit-btn')?.addEventListener('click', () => submitAddRegatta());
  
  // Sailor Profile Modal buttons
  document.getElementById('sm-save-btn')?.addEventListener('click', () => saveSailorProfile());
  document.querySelectorAll('.back-to-rankings-btn').forEach(btn => {
    btn.addEventListener('click', () => closeSailorModal());
  });

  // Spreadsheet import verification modal buttons
  document.getElementById('import-modal-confirm-btn')?.addEventListener('click', () => confirmPendingImport());
  document.getElementById('import-modal-close-btn')?.addEventListener('click', () => closeImportModal());
  document.getElementById('import-modal-close-x')?.addEventListener('click', () => closeImportModal());

  // Regatta selection dropdown checklist
  document.getElementById('regatta-select-trigger')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleRegattaDropdown();
  });
  document.getElementById('regatta-select-reset')?.addEventListener('click', (e) => {
    resetRegattasToDefault(e);
  });
  document.getElementById('regatta-checkboxes-list')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('regatta-select-cb')) {
      onRegattaCheckboxChange();
    }
  });

  // Global click event to close dropdown when clicking outside
  document.addEventListener('click', (event) => {
    const container = document.getElementById('regatta-select-container');
    const dropdown = document.getElementById('regatta-select-dropdown');
    if (container && dropdown && !container.contains(event.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Event delegation for opening sailor profile modal
  // Event delegation for opening sailor profile modal
  document.addEventListener('click', e => {
    const nameCell = e.target.closest('.name-c');
    if (nameCell && nameCell.hasAttribute('data-sailor')) {
      openSailorModal(nameCell.getAttribute('data-sailor'));
    }
    
    // Delete sailor from specific regatta delegation
    const delBtn = e.target.closest('.reg-sailor-delete-btn');
    if (delBtn) {
      removeSailorFromSpecificRegatta(delBtn.getAttribute('data-reg'), delBtn.getAttribute('data-sailor'));
    }
    
    // Sort columns click events
    const sortHdr = e.target.closest('.sort-header');
    if (sortHdr) {
      handleSort(sortHdr.getAttribute('data-sort'));
    }
    
    const mcSortHdr = e.target.closest('.mc-sort-header');
    if (mcSortHdr) {
      handleMcSort(mcSortHdr.getAttribute('data-sort'));
    }
    
    const hgSortHdr = e.target.closest('.hg-sort-header');
    if (hgSortHdr) {
      handleHgSort(hgSortHdr.getAttribute('data-sort'));
    }
  });

  // Event delegation for historical rank input saves and results rank/points saves
  document.addEventListener('change', e => {
    const input = e.target.closest('.hist-direct-input');
    if (input) {
      if (!requireEditor()) {
        input.value = input.defaultValue || '';
        return;
      }
      const name = input.getAttribute('data-sailor');
      const field = input.getAttribute('data-field');
      let val = input.value.trim().replace('#', '');
      const num = val !== '' ? parseInt(val) : null;
      
      if (num !== null && (isNaN(num) || num < 1)) {
        alert('Please enter a valid rank (positive integer).');
        input.value = input.defaultValue || '';
        return;
      }
      
      if (!SAILOR_METADATA[name]) SAILOR_METADATA[name] = {};
      SAILOR_METADATA[name][field] = num;
      
      recomputeSailors();
      saveData();
      renderAll();
      return;
    }

    const rankInput = e.target.closest('.reg-rank-input');
    if (rankInput) {
      updateRegattaSailorRank(rankInput.getAttribute('data-reg'), rankInput.getAttribute('data-sailor'), e.target.value);
      return;
    }

    const pointsInput = e.target.closest('.reg-points-input');
    if (pointsInput) {
      updateRegattaSailorPoints(pointsInput.getAttribute('data-reg'), pointsInput.getAttribute('data-sailor'), e.target.value);
      return;
    }
  });

  // Regatta results select change listener
  document.getElementById('resultsRegattaSelect')?.addEventListener('change', e => {
    renderSpecificRegattaResults(e.target.value);
  });
  document.getElementById('specific-regatta-dns')?.addEventListener('change', e => {
    if (CURRENT_SELECTED_REGATTA) {
      updateRegattaDns(CURRENT_SELECTED_REGATTA, e.target.value);
    }
  });

  // Regatta details view delegation
  const regResultsWrap = document.getElementById('specific-regatta-results-wrap');
  if (regResultsWrap) {
    regResultsWrap.addEventListener('click', e => {
      const backBtn = e.target.closest('#regatta-back-btn');
      if (backBtn) {
        renderSpecificRegattaResults(null);
        return;
      }

      const delDetailBtn = e.target.closest('.regatta-delete-btn-detail');
      if (delDetailBtn) {
        if (CURRENT_SELECTED_REGATTA) {
          deleteRegattaEntirely(CURRENT_SELECTED_REGATTA);
        }
        return;
      }

      const addSailorBtn = e.target.closest('#add-sailor-result-trigger');
      if (addSailorBtn) {
        addSailorToSpecificRegatta();
        return;
      }

      const uploadBtn = e.target.closest('#upload-regatta-doc-btn');
      if (uploadBtn) {
        document.getElementById('regattaDocFileInput')?.click();
        return;
      }

      const deleteDocBtn = e.target.closest('#delete-regatta-doc-btn');
      if (deleteDocBtn) {
        if (CURRENT_SELECTED_REGATTA) {
          deleteRegattaDocument(CURRENT_SELECTED_REGATTA);
        }
        return;
      }
    });

    regResultsWrap.addEventListener('change', e => {
      const dateInput = e.target.closest('#specific-regatta-date-input');
      if (dateInput) {
        updateRegattaDate(CURRENT_SELECTED_REGATTA, dateInput.value);
        return;
      }

      const fileInput = e.target.closest('#regattaDocFileInput');
      if (fileInput) {
        handleRegattaDocUpload(fileInput, CURRENT_SELECTED_REGATTA);
        return;
      }
    });
  }

  // Target Simulator UI elements
  document.getElementById('targetSailor')?.addEventListener('change', () => runTarget());
  document.getElementById('targetGoal')?.addEventListener('change', () => runTarget());
  document.getElementById('targetSlider')?.addEventListener('input', e => {
    updateTargetSliderVal(e.target.value);
  });
  document.getElementById('target-run-btn')?.addEventListener('click', () => runSimulation());

  // Simulator dynamic inputs container removal delegator
  document.getElementById('sailor-inputs')?.addEventListener('click', e => {
    const btn = e.target.closest('.rm-btn');
    if (btn) {
      const row = btn.closest('.sailor-row');
      if (row) row.remove();
    }
  });
}

function addSailorToSpecificRegatta() {
  if (!requireEditor()) return;
  const sel = document.getElementById('resultsRegattaSelect');
  if (!sel) return;
  const regName = sel.value;
  if (!regName) return;
  const reg = REGATTAS.find(r => r.name === regName);
  if (!reg) return;
  
  const name = prompt("Enter sailor name to add to this regatta:");
  if (name === null) return; // cancelled
  const nameTrimmed = name.trim();
  if (!nameTrimmed) {
    alert("Sailor name cannot be empty.");
    return;
  }
  
  const existing = SAILORS.find(s => isSameSailor(s.name, nameTrimmed));
  let gender = existing ? existing.g : null;
  let born = existing ? existing.born : null;
  let club = existing ? existing.club : "";
  let school = existing ? existing.school : "";
  
  if (!existing) {
    // Prompt and validate gender for new sailor
    let gInput = null;
    while (true) {
      gInput = prompt("This is a new sailor. Enter Gender (M or F):");
      if (gInput === null) return; // cancelled
      gInput = gInput.trim().toUpperCase();
      if (gInput === 'M' || gInput === 'F') {
        gender = gInput;
        break;
      }
      alert("Invalid input. Gender must be strictly 'M' or 'F'.");
    }
    
    // Prompt and validate birth year for new sailor
    let bornInput = null;
    const minBirthYear = COMP_YEAR - 20;
    const maxBirthYear = COMP_YEAR;
    while (true) {
      bornInput = prompt(`Enter Birth Year (4-digit year between ${minBirthYear} and ${maxBirthYear}):`);
      if (bornInput === null) return; // cancelled
      const year = parseInt(bornInput.trim());
      if (!isNaN(year) && year >= minBirthYear && year <= maxBirthYear) {
        born = year;
        break;
      }
      alert(`Invalid input. Birth year must be a 4-digit number between ${minBirthYear} and ${maxBirthYear}.`);
    }
    
    // Optional prompts for club and school
    const clubInput = prompt("Enter Club (optional):");
    if (clubInput !== null) club = clubInput.trim();
    const schoolInput = prompt("Enter School (optional):");
    if (schoolInput !== null) school = schoolInput.trim();
  }
  
  const rankStr = prompt("Enter Rank in Regatta:", "1");
  if (rankStr === null) return; // cancelled
  const rank = parseInt(rankStr.trim());
  if (isNaN(rank) || rank < 1) {
    alert("Invalid rank. Rank must be a positive integer greater than or equal to 1.");
    return;
  }
  
  const pointsStr = prompt("Enter Points (leave blank if none):");
  if (pointsStr === null) return; // cancelled
  let pointsVal = null;
  if (pointsStr.trim() !== '') {
    pointsVal = parseFloat(pointsStr.trim());
    if (isNaN(pointsVal) || pointsVal < 0) {
      alert("Invalid points. Points must be a non-negative number.");
      return;
    }
  }
  
  reg.sailors.push({
    name: nameTrimmed,
    g: gender,
    born: born,
    club: club,
    school: school,
    rank: rank,
    nett: pointsVal
  });
  
  recomputeSailors();
  saveData();
  renderAll();
  renderSpecificRegattaResults();
}

function updateRegattaSailorRank(regName, sailorName, val) {
  if (!requireEditor()) return;
  const reg = REGATTAS.find(r => r.name === regName);
  if (!reg) return;
  const s = reg.sailors.find(x => isSameSailor(x.name, sailorName));
  if (s) {
    const parsed = val.trim() !== '' ? parseInt(val.trim()) : null;
    if (parsed !== null && (isNaN(parsed) || parsed < 1)) {
      alert("Rank must be a positive integer.");
      renderSpecificRegattaResults();
      return;
    }
    s.rank = parsed;
    recomputeSailors();
    saveData();
    renderAll();
    renderSpecificRegattaResults();
  }
}

function updateRegattaSailorPoints(regName, sailorName, val) {
  if (!requireEditor()) return;
  const reg = REGATTAS.find(r => r.name === regName);
  if (!reg) return;
  const s = reg.sailors.find(x => isSameSailor(x.name, sailorName));
  if (s) {
    const parsed = val.trim() !== '' ? parseFloat(val.trim()) : null;
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      alert("Points must be a non-negative number.");
      renderSpecificRegattaResults();
      return;
    }
    s.nett = parsed;
    recomputeSailors();
    saveData();
    renderAll();
    renderSpecificRegattaResults();
  }
}

function updateRegattaDns(regName, val) {
  if (!requireEditor()) return;
  const reg = REGATTAS.find(r => r.name === regName);
  if (!reg) return;
  const parsed = parseInt(val);
  if (isNaN(parsed) || parsed < 1) {
    alert("Total sailors in regatta must be a positive integer.");
    renderSpecificRegattaResults();
    return;
  }
  reg.dns = parsed;
  recomputeSailors();
  saveData();
  renderAll();
  renderSpecificRegattaResults();
}

function removeSailorFromSpecificRegatta(regName, sailorName) {
  if (!requireEditor()) return;
  if (!confirm(`Are you sure you want to remove ${sailorName} from ${regName}?`)) return;
  const reg = REGATTAS.find(r => r.name === regName);
  if (!reg) return;
  reg.sailors = reg.sailors.filter(x => !isSameSailor(x.name, sailorName));
  recomputeSailors();
  saveData();
  renderAll();
  renderSpecificRegattaResults();
}

function updateRegattaDate(regName, dateString) {
  if (!requireEditor()) return;
  const reg = REGATTAS.find(r => r.name === regName);
  if (!reg) return;
  reg.date = dateString;
  recomputeSailors();
  saveData();
  renderAll();
  renderSpecificRegattaResults(regName);
}

function deleteRegattaEntirely(regName) {
  if (!requireEditor()) return;
  const idx = REGATTAS.findIndex(r => r.name === regName);
  if (idx === -1) return;
  if (!confirm(`Are you sure you want to delete the regatta "${regName}"? This will delete all sailor results inside it.`)) return;
  
  REGATTAS.splice(idx, 1);
  recomputeSailors();
  saveData();
  renderAll();
  renderSpecificRegattaResults(null);
}

async function uploadRegattaDocument(regName, file) {
  if (!requireEditor()) return;
  if (!storage) {
    alert("Document uploads are unavailable right now (storage failed to load). Please refresh the page and try again.");
    return;
  }
  try {
    setSyncStatus('saving');
    const ref = storage.ref().child(`regattas/${regName}/${file.name}`);
    const snapshot = await ref.put(file);
    const url = await snapshot.ref.getDownloadURL();
    
    const reg = REGATTAS.find(r => r.name === regName);
    if (reg) {
      reg.documentUrl = url;
      reg.documentName = file.name;
      
      saveData();
      renderSpecificRegattaResults(regName);
      alert("Document uploaded successfully!");
    }
  } catch (err) {
    console.error("Upload error:", err);
    setSyncStatus('error', err.message);
    alert("Failed to upload document: " + err.message);
  }
}

async function deleteRegattaDocument(regName) {
  if (!requireEditor()) return;
  const reg = REGATTAS.find(r => r.name === regName);
  if (!reg) return;
  if (!reg.documentUrl) return;
  
  if (!confirm("Are you sure you want to remove the document for this regatta?")) return;
  
  try {
    setSyncStatus('saving');
    if (!storage) {
      console.warn("Storage unavailable; skipping remote file deletion, removing reference only.");
    } else {
      try {
        const ref = storage.refFromURL(reg.documentUrl);
        await ref.delete();
      } catch (storageErr) {
        console.warn("Storage deletion warning (might already be deleted or permission denied):", storageErr);
      }
    }
    
    delete reg.documentUrl;
    delete reg.documentName;
    
    saveData();
    renderSpecificRegattaResults(regName);
    alert("Document removed successfully!");
  } catch (err) {
    console.error("Removal error:", err);
    setSyncStatus('error', err.message);
    alert("Failed to remove document: " + err.message);
  }
}

function handleRegattaDocUpload(inputEl, regName) {
  const file = inputEl.files[0];
  if (!file) return;
  uploadRegattaDocument(regName, file);
}
