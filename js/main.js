  // Main Application Initialization & Event Listeners

  let dataLoadedPromise = null;

  document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    dataLoadedPromise = loadData();
    setupDropZone();
    bindStaticEventListeners();
    populateGoldEntrySelect(document.getElementById('sm-entered-gold'));
    populateGoldEntrySelect(document.getElementById('sm-entered-silver'));
    populateGoldEntrySelect(document.getElementById('sm-dropped-optimist'));
    const fleetBornInput = document.getElementById('fleet-add-born');
    if (fleetBornInput) {
      // Default to typical Optimist age (~13), always within [COMP_YEAR-20, COMP_YEAR]
      fleetBornInput.value = String(COMP_YEAR - 13);
    }
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
      if (typeof updateDataFreshnessUI === 'function') updateDataFreshnessUI();
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
      const editorOnlyViews = ['simulator', 'target', 'exclusions', 'major-comps', 'hist-gold', 'fleet'];
      if (editorOnlyViews.includes(lastMainView)) {
        switchView('rankings');
      }
      if (BULK_EDIT_MODE) {
        BULK_EDIT_MODE = false;
        BULK_EDIT_SNAPSHOT = null;
      }
    }

    if (typeof renderAll === 'function') {
      renderAll();
    }
    if (typeof renderSpecificRegattaResults === 'function') {
      renderSpecificRegattaResults();
    }
  }

  function openSignInModal() {
    const modal = document.getElementById('signin-modal');
    const passEl = document.getElementById('signin-pass');
    const errEl = document.getElementById('signin-error');
    if (!modal) return;
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.remove('show');
    }
    if (passEl) passEl.value = '';
    modal.classList.add('open');
    setTimeout(() => passEl?.focus(), 30);
  }

  function closeSignInModal() {
    const modal = document.getElementById('signin-modal');
    if (modal) modal.classList.remove('open');
  }

  async function submitSignIn() {
    const passEl = document.getElementById('signin-pass');
    const errEl = document.getElementById('signin-error');
    const submitBtn = document.getElementById('signin-submit-btn');
    const pass = passEl?.value || '';
    if (!pass) {
      if (errEl) {
        errEl.textContent = 'Enter the editor passcode.';
        errEl.classList.add('show');
      }
      passEl?.focus();
      return;
    }
    if (submitBtn) submitBtn.disabled = true;
    try {
      await auth.signInWithEmailAndPassword(ADMIN_EMAIL, pass);
      closeSignInModal();
      toastSuccess('Signed in — you can edit rankings and fleet.');
    } catch (e) {
      if (errEl) {
        errEl.textContent = 'Incorrect passcode — still in view-only mode.';
        errEl.classList.add('show');
      }
      toastError('Incorrect passcode — still in view-only mode.');
      passEl?.select();
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function signInEditor() {
    openSignInModal();
  }

  function signOutEditor() {
    auth.signOut();
    toastInfo('Signed out — back to view-only.');
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
    if (state === 'error' && detail && typeof toastError === 'function') {
      toastError(detail, { title: 'Not saved' });
    }
    updateDataFreshnessUI();
  }

  /** Show when data was last saved and which regatta ends the ranking window. */
  function updateDataFreshnessUI() {
    const el = document.getElementById('data-freshness');
    if (!el) return;
    const parts = [];
    if (LAST_DATA_UPDATED_AT && !Number.isNaN(LAST_DATA_UPDATED_AT.getTime())) {
      const d = LAST_DATA_UPDATED_AT;
      const sameDay = new Date().toDateString() === d.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = sameDay ? timeStr : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + timeStr;
      parts.push('Updated ' + dateStr);
    }
    try {
      const regs = typeof getActiveRegattas === 'function' ? getActiveRegattas() : [];
      if (regs.length) {
        const last = regs[regs.length - 1];
        parts.push('after ' + (last.name || last.date || 'latest regatta'));
      }
    } catch (_) { /* ignore */ }
    if (!parts.length) {
      el.textContent = CLOUD_HAS_DATA ? 'Cloud data' : '—';
      el.title = 'No update timestamp yet';
      return;
    }
    el.textContent = parts.join(' · ');
    el.title = parts.join('\n');
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
      toastWarn('Please drop an Excel file (.xlsx, .xlsm, or .xls).');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sn = wb.SheetNames.find(n => /sheet1/i.test(n)) || wb.SheetNames[0];
        parseSheet(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null }), file.name);
      } catch (err) {
        toastError('Could not read file: ' + err.message);
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

    const activeFleet = (typeof ACTIVE_FLEET === 'string' && ACTIVE_FLEET === 'silver') ? 'silver' : 'gold';
    PENDING_IMPORT_DATA.forEach(col => {
      col.sailors.forEach(s => {
        if (nameMap.has(s.name)) {
          s.name = nameMap.get(s.name);
        }
      });

      const existing = REGATTAS.find(r => r.name.toLowerCase() === col.name.toLowerCase());
      if (existing) {
        // Keep existing fleet tag; ensure fleet is set
        if (!existing.fleet) existing.fleet = activeFleet;
        const regFleet = existing.fleet === 'silver' ? 'silver' : 'gold';
        col.sailors.forEach(newSailor => {
          if (typeof setSailorFleet === 'function') setSailorFleet(newSailor.name, regFleet);
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
        // Refresh fleet size if dns missing or smaller than row count
        if (existing.dns == null || existing.dns < existing.sailors.length) {
          existing.dns = Math.max(existing.sailors.length, existing.dns || 0);
        }
      } else {
        col.sailors.forEach(s => {
          if (typeof setSailorFleet === 'function') setSailorFleet(s.name, activeFleet);
        });
        REGATTAS.push({
          name: col.name,
          date: col.date,
          fleet: activeFleet,
          type: 'selection',
          dns: col.sailors.length,
          sailors: col.sailors
        });
      }
    });

    recomputeSailors();
    saveData();
    renderAll();
    closeImportModal();
    const fl = activeFleet === 'silver' ? 'Silver' : 'Gold';
    toastSuccess(`Spreadsheet imported into ${fl} series successfully.`);
  }

  /**
   * Upload a roster list for the ACTIVE fleet (Gold or Silver).
   * Columns: Name | Gender | Born | Club | School (headers flexible).
   * Sailors are added to the latest regatta of that fleet (or a new roster event).
   */
  function uploadFleetExcel(input) {
    const file = input.files[0];
    if (!file) return;
    if (!requireEditor()) return;
    
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

        const fleet = (typeof ACTIVE_FLEET === 'string' && ACTIVE_FLEET === 'silver') ? 'silver' : 'gold';
        const fleetFn = typeof getRegattaFleet === 'function'
          ? getRegattaFleet
          : (r) => (r && r.fleet === 'silver' ? 'silver' : 'gold');

        // Target: latest selection regatta in this fleet, or create a roster shell
        let targetReg = [...REGATTAS]
          .filter(r => r && fleetFn(r) === fleet && r.type !== 'overseas')
          .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
          .pop();

        if (!targetReg) {
          const label = fleet === 'silver' ? 'Silver' : 'Gold';
          targetReg = {
            name: `${label} Fleet Roster`,
            date: new Date().toISOString().slice(0, 10),
            fleet,
            type: 'selection',
            dns: 1,
            sailors: []
          };
          REGATTAS.push(targetReg);
        }

        let importedCount = 0;
        let addedCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[nameIdx]) continue;
          const name = String(r[nameIdx]).trim();
          if (!name || name.toLowerCase() === 'name') continue;

          const genderRaw = String(r[genderIdx] || 'M').trim().toUpperCase();
          const gender = genderRaw.startsWith('F') ? 'F' : 'M';
          const born = parseInt(r[bornIdx], 10) || 0;
          const club = String(r[clubIdx] || '').trim();
          const school = String(r[schoolIdx] || '').trim();

          unmarkSailorDropped(name);

          // Upsert metadata + assign to active Gold/Silver membership pool
          const metaKey = (typeof resolveSailorMetadataKey === 'function')
            ? resolveSailorMetadataKey(name)
            : name;
          SAILOR_METADATA[metaKey] = Object.assign({}, SAILOR_METADATA[metaKey] || {}, {
            g: gender,
            born: born || (SAILOR_METADATA[metaKey] && SAILOR_METADATA[metaKey].born) || null,
            club: club || (SAILOR_METADATA[metaKey] && SAILOR_METADATA[metaKey].club) || '',
            school: school || (SAILOR_METADATA[metaKey] && SAILOR_METADATA[metaKey].school) || '',
            fleet
          });
          if (typeof setSailorFleet === 'function') setSailorFleet(name, fleet);

          const sIdx = targetReg.sailors.findIndex(x => isSameSailor(x.name, name));
          if (sIdx === -1) {
            targetReg.sailors.push({
              name,
              g: gender,
              born: born || null,
              club,
              school,
              nett: null,
              rank: null
            });
            addedCount++;
          } else {
            const row = targetReg.sailors[sIdx];
            row.name = name;
            if (gender) row.g = gender;
            if (born) row.born = born;
            if (club) row.club = club;
            if (school) row.school = school;
          }
          importedCount++;
        }

        if (targetReg.dns == null || targetReg.dns < targetReg.sailors.length) {
          targetReg.dns = Math.max(targetReg.sailors.length, 1);
        }

        recomputeSailors();
        saveData();
        renderAll();
        renderFleetPanel();
        const fl = fleet === 'silver' ? 'Silver' : 'Gold';
        toastSuccess(
          `${fl} roster upload: ${importedCount} sailors processed (${addedCount} new) → “${targetReg.name}”.`
        );
      } catch (err) {
        toastError('Could not read fleet Excel file: ' + err.message);
      }
      input.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * Upload scores for the currently open regatta only.
   * Columns: Name | Rank | Nett (or Points). Headers flexible.
   */
  function uploadRegattaScoresExcel(input) {
    const file = input.files[0];
    if (!file) return;
    if (!requireEditor()) return;
    const regName = CURRENT_SELECTED_REGATTA;
    const reg = REGATTAS.find(r => r.name === regName);
    if (!reg) {
      toastWarn('Open a regatta first, then upload scores for that event.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sn = wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
        const headers = rows[0] || [];
        let nameIdx = -1, rankIdx = -1, nettIdx = -1, genderIdx = -1, bornIdx = -1, clubIdx = -1;

        for (let c = 0; c < headers.length; c++) {
          const h = String(headers[c] || '').toLowerCase().trim();
          if (h === 'name' || h === 'sailor') nameIdx = c;
          else if (h === 'rank' || h === 'pos' || h === 'position' || h === 'placing') rankIdx = c;
          else if (h === 'nett' || h === 'points' || h === 'pts' || h === 'score' || h === 'nett points') nettIdx = c;
          else if (h === 'gender' || h === 'g' || h === 'sex') genderIdx = c;
          else if (h === 'born' || h === 'birth year' || h === 'year') bornIdx = c;
          else if (h === 'club') clubIdx = c;
        }
        if (nameIdx === -1) nameIdx = 0;
        if (rankIdx === -1) {
          for (let c = 0; c < headers.length; c++) {
            if (/rank|pos|place/i.test(String(headers[c] || ''))) { rankIdx = c; break; }
          }
        }
        if (nettIdx === -1) {
          for (let c = 0; c < headers.length; c++) {
            if (/nett|point|score|pts/i.test(String(headers[c] || ''))) { nettIdx = c; break; }
          }
        }
        if (rankIdx === -1 && nettIdx !== -1) rankIdx = nettIdx;
        if (nettIdx === -1 && rankIdx !== -1) nettIdx = rankIdx;

        let updated = 0;
        let added = 0;
        const regFleet = reg.fleet === 'silver' ? 'silver' : 'gold';
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[nameIdx]) continue;
          const name = String(r[nameIdx]).trim();
          if (!name || name.toLowerCase() === 'name') continue;
          const rank = rankIdx !== -1 ? parseVal(r[rankIdx]) : null;
          const nett = nettIdx !== -1 ? parseVal(r[nettIdx]) : null;
          if (rank == null && nett == null) continue;

          const finalRank = rank != null ? rank : nett;
          const finalNett = nett != null ? nett : rank;
          const g = genderIdx !== -1 ? String(r[genderIdx] || '').trim().toUpperCase() : '';
          const born = bornIdx !== -1 ? parseInt(r[bornIdx], 10) || null : null;
          const club = clubIdx !== -1 ? String(r[clubIdx] || '').trim() : '';

          unmarkSailorDropped(name);
          // Scores on a Silver regatta assign Silver membership (and Gold → Gold)
          if (typeof setSailorFleet === 'function') setSailorFleet(name, regFleet);

          const sIdx = reg.sailors.findIndex(x => isSameSailor(x.name, name));
          if (sIdx !== -1) {
            reg.sailors[sIdx].rank = finalRank;
            reg.sailors[sIdx].nett = finalNett;
            if (g) reg.sailors[sIdx].g = g.startsWith('F') ? 'F' : 'M';
            if (born) reg.sailors[sIdx].born = born;
            if (club) reg.sailors[sIdx].club = club;
            updated++;
          } else {
            reg.sailors.push({
              name,
              g: g ? (g.startsWith('F') ? 'F' : 'M') : 'M',
              born: born || null,
              club: club || '',
              school: '',
              rank: finalRank,
              nett: finalNett
            });
            added++;
          }
        }

        if (reg.dns == null || reg.dns < reg.sailors.length) {
          reg.dns = Math.max(reg.sailors.length, reg.dns || 0, 1);
        }

        recomputeSailors();
        saveData();
        renderAll();
        renderSpecificRegattaResults(reg.name);
        toastSuccess(
          `Scores for “${reg.name}”: ${updated} updated, ${added} new (${regFleet} membership).`
        );
      } catch (err) {
        toastError('Could not read scores Excel: ' + err.message);
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
    const fleet = (typeof ACTIVE_FLEET === 'string' && ACTIVE_FLEET === 'silver') ? 'silver' : 'gold';
    const fleetFn = typeof getRegattaFleet === 'function'
      ? getRegattaFleet
      : (r) => (r && r.fleet === 'silver' ? 'silver' : 'gold');
    // Ranking series only: exclude overseas / invitation; filter Gold vs Silver
    let selectionRegs = REGATTAS.filter(r => {
      if (!r) return false;
      if (r.type === 'overseas') return false;
      return fleetFn(r) === fleet;
    });
    if (SELECTED_REGATTA_NAMES === null) {
      const regWithResults = selectionRegs.filter(r => r.sailors && r.sailors.length > 0);
      return regWithResults.slice(-5);
    }
    return selectionRegs.filter(r => SELECTED_REGATTA_NAMES.includes(r.name));
  }

  function setActiveFleet(fleet) {
    ACTIVE_FLEET = fleet === 'silver' ? 'silver' : 'gold';
    SELECTED_REGATTA_NAMES = null; // reset window when switching fleets
    document.querySelectorAll('[data-fleet-pill]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-fleet-pill') === ACTIVE_FLEET);
    });
    const h1 = document.getElementById('sidebar-h1');
    if (h1) {
      h1.innerHTML = ACTIVE_FLEET === 'silver'
        ? 'OP Silver<br>Ranking'
        : 'OP Gold<br>Ranking';
    }
    updateSquadUiForFleet();
    recomputeSailors();
    renderAll();
    if (typeof updateDataFreshnessUI === 'function') updateDataFreshnessUI();
  }

  function setActiveFleetPeriodFromKey(periodKey) {
    const opts = typeof getFleetPeriodOptions === 'function' ? getFleetPeriodOptions() : [];
    const found = opts.find(o => o.periodKey === periodKey);
    ACTIVE_FLEET_PERIOD = found || (typeof getCurrentFleetPeriod === 'function' ? getCurrentFleetPeriod() : null);
    const sel = document.getElementById('fleet-period-select');
    if (sel && ACTIVE_FLEET_PERIOD) sel.value = ACTIVE_FLEET_PERIOD.periodKey;
    const lbl = document.getElementById('fleet-period-label');
    if (lbl && ACTIVE_FLEET_PERIOD) lbl.textContent = ACTIVE_FLEET_PERIOD.rangeLabel;
    SELECTED_REGATTA_NAMES = null;
    recomputeSailors();
    renderAll();
    if (typeof updateDataFreshnessUI === 'function') updateDataFreshnessUI();
  }

  function populateFleetPeriodSelect() {
    const sel = document.getElementById('fleet-period-select');
    if (!sel || typeof getFleetPeriodOptions !== 'function') return;
    const cur = typeof getActiveFleetPeriod === 'function' ? getActiveFleetPeriod() : null;
    if (!ACTIVE_FLEET_PERIOD && cur) ACTIVE_FLEET_PERIOD = cur;
    const activeKey = (ACTIVE_FLEET_PERIOD && ACTIVE_FLEET_PERIOD.periodKey) || (cur && cur.periodKey);
    sel.innerHTML = getFleetPeriodOptions().map(o =>
      `<option value="${o.periodKey}" ${o.periodKey === activeKey ? 'selected' : ''}>${escapeHtml(o.rangeLabel)}</option>`
    ).join('');
    const lbl = document.getElementById('fleet-period-label');
    if (lbl && ACTIVE_FLEET_PERIOD) lbl.textContent = ACTIVE_FLEET_PERIOD.rangeLabel;
  }

  /** Squad (Nat A/B/DS) only applies to Gold — hide on Silver board. */
  function updateSquadUiForFleet() {
    const isSilver = ACTIVE_FLEET === 'silver';
    const squadFilter = document.getElementById('squadFilter');
    if (squadFilter) {
      squadFilter.style.display = isSilver ? 'none' : '';
      if (isSilver) squadFilter.value = '';
    }
    const qfSec = document.getElementById('quick-filter-sec');
    if (qfSec) qfSec.style.display = isSilver ? 'none' : '';
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
      btn.style.display = isSilver ? 'none' : '';
      if (isSilver) btn.classList.remove('active');
    });
  }

  function getAllSailorsInSystem() {
    const allNames = new Map();
    const normalizedToOriginal = new Map();

    function upsertSailor(s) {
      if (!s || !s.name) return;
      const norm = normalizeName(s.name);
      if (!norm) return;
      let matchedKey = normalizedToOriginal.get(norm);
      if (!matchedKey) {
        matchedKey = s.name;
        normalizedToOriginal.set(norm, matchedKey);
        allNames.set(matchedKey, {
          name: s.name,
          g: s.g || s.gender || null,
          born: s.born || null,
          club: s.club || '',
          school: s.school || ''
        });
        return;
      }
      const obj = allNames.get(matchedKey);
      if ((s.g || s.gender) && !obj.g) obj.g = s.g || s.gender;
      if (s.born && !obj.born) obj.born = s.born;
      if (s.club && !obj.club) obj.club = s.club;
      if (s.school && !obj.school) obj.school = s.school;
    }

    // 1) Anyone who appears on any regatta entry (including null rank = DNS)
    REGATTAS.forEach(reg => {
      (reg.sailors || []).forEach(upsertSailor);
    });

    // 2) Gold/Silver fleet via Entered Gold/Silver only (no auto-DNS regatta rows).
    //    First time Entered Gold or Silver is set, they join rankings with DNS for missed events.
    Object.keys(SAILOR_METADATA || {}).forEach(name => {
      const meta = SAILOR_METADATA[name] || {};
      const enteredGold = meta.enteredGold && meta.enteredGold !== '—';
      const enteredSilver = meta.enteredSilver && meta.enteredSilver !== '—';
      if (!enteredGold && !enteredSilver) return;
      upsertSailor({
        name,
        g: meta.g,
        born: meta.born,
        club: meta.club,
        school: meta.school
      });
    });

    return Array.from(allNames.values());
  }

  function addNewFleetSailor() {
    if (!requireEditor()) return;
    const name = document.getElementById('fleet-add-name').value.trim();
    const gender = document.getElementById('fleet-add-gender').value;
    const bornRaw = document.getElementById('fleet-add-born').value.trim();
    const born = parseBirthYearInput(bornRaw);
    if (born === null || Number.isNaN(born)) {
      toastError(`Please enter a valid Birth Year (between ${COMP_YEAR - 20} and ${COMP_YEAR}).`);
      return;
    }
    const club = document.getElementById('fleet-add-club').value.trim();
    const school = document.getElementById('fleet-add-school').value.trim();
    
    if (!name) {
      toastError('Please enter a sailor name.');
      return;
    }
    
    const currentSystemSailors = getAllSailorsInSystem();
    const existing = currentSystemSailors.find(s => isSameSailor(s.name, name));
    
    const fleet = (typeof ACTIVE_FLEET === 'string' && ACTIVE_FLEET === 'silver') ? 'silver' : 'gold';
    if (existing) {
      if (typeof setSailorFleet === 'function') setSailorFleet(existing.name, fleet);
      if (isDroppedSailor(existing.name)) {
        unmarkSailorDropped(existing.name);
        toastSuccess(`"${name}" re-promoted into ${fleet === 'silver' ? 'Silver' : 'Gold'} fleet.`);
      } else {
        toastSuccess(`"${name}" assigned to ${fleet === 'silver' ? 'Silver' : 'Gold'} fleet.`);
      }
    } else {
      // Prefer latest regatta in the active fleet
      const fleetFn = typeof getRegattaFleet === 'function'
        ? getRegattaFleet
        : (r) => (r && r.fleet === 'silver' ? 'silver' : 'gold');
      let latestReg = [...REGATTAS]
        .filter(r => r && fleetFn(r) === fleet && r.type !== 'overseas')
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
        .pop();
      if (!latestReg) {
        const label = fleet === 'silver' ? 'Silver' : 'Gold';
        latestReg = {
          name: `${label} Fleet Roster`,
          date: new Date().toISOString().slice(0, 10),
          fleet,
          type: 'selection',
          dns: 1,
          sailors: []
        };
        REGATTAS.push(latestReg);
      }
      latestReg.sailors.push({
        name,
        g: gender,
        born,
        club,
        school,
        nett: null,
        rank: null
      });
      if (typeof setSailorFleet === 'function') setSailorFleet(name, fleet);
    }
    
    document.getElementById('fleet-add-name').value = '';
    document.getElementById('fleet-add-club').value = '';
    document.getElementById('fleet-add-school').value = '';
    
    recomputeSailors();
    saveData();
    renderAll();
    renderFleetPanel();
    toastSuccess(`Added "${name}" to the active fleet.`);
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
    if (sortKey !== key) {
      return ' <span class="sort-ind sort-ind-idle" aria-hidden="true">↕</span>';
    }
    return sortAsc
      ? ' <span class="sort-ind sort-ind-active" aria-hidden="true">▲</span>'
      : ' <span class="sort-ind sort-ind-active" aria-hidden="true">▼</span>';
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
    if (mcSortKey !== key) {
      return ' <span class="sort-ind sort-ind-idle" aria-hidden="true">↕</span>';
    }
    return mcSortAsc
      ? ' <span class="sort-ind sort-ind-active" aria-hidden="true">▲</span>'
      : ' <span class="sort-ind sort-ind-active" aria-hidden="true">▼</span>';
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
    if (hgSortKey !== key) {
      return ' <span class="sort-ind sort-ind-idle" aria-hidden="true">↕</span>';
    }
    return hgSortAsc
      ? ' <span class="sort-ind sort-ind-active" aria-hidden="true">▲</span>'
      : ' <span class="sort-ind sort-ind-active" aria-hidden="true">▼</span>';
  }

  function openAddRegattaModal() {
    if (!requireEditor()) return;
    document.getElementById('ar-name').value = '';
    document.getElementById('ar-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('ar-dns').value = '100';
    const fleetSel = document.getElementById('ar-fleet');
    if (fleetSel) fleetSel.value = (typeof ACTIVE_FLEET === 'string' && ACTIVE_FLEET === 'silver') ? 'silver' : 'gold';
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
      toastWarn('Please fill in both name and date.');
      return;
    }
    if (isNaN(dns) || dns < 1) {
      toastWarn('Please enter the total number of sailors in the regatta (positive integer).');
      return;
    }

    if (REGATTAS.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      toastWarn('A regatta with this name already exists.');
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

        // Exclude manually dropped sailors (normalized name match)
        if (isDroppedSailor(canonicalName)) return;

        // Only populate with sailors who belong to this regatta's fleet
        const memberFleet = (typeof getSailorFleet === 'function')
          ? getSailorFleet(sysObj?.name || canonicalName)
          : 'gold';
        if (memberFleet !== fleet) return;

        sailors.push({
          name: sysObj?.name || canonicalName,
          g, born, club, school,
          nett: null,
          rank: null
        });
      });
    }

    const fleetSel = document.getElementById('ar-fleet');
    const fleet = (fleetSel && fleetSel.value === 'silver') ? 'silver' : 'gold';
    const typeSel = document.getElementById('ar-type');
    const regType = (typeSel && typeSel.value === 'overseas') ? 'overseas' : 'selection';

    REGATTAS.push({
      name: name,
      date: date,
      dns: dns,
      fleet: fleet,
      type: regType,
      sailors: sailors
    });

    // Switch board to the fleet you just added
    if (typeof setActiveFleet === 'function') setActiveFleet(fleet);
    else {
      recomputeSailors();
      renderAll();
    }
    saveData();
    closeAddRegattaModal();
    const fleetLabel = fleet === 'silver' ? 'Silver' : 'Gold';
    if (addGold) {
      toastSuccess(`Added ${fleetLabel} regatta "${name}" with ${sailors.length} fleet sailors.`);
    } else {
      toastSuccess(`Added ${fleetLabel} regatta "${name}".`);
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
      const hash = window.location.hash || '';
      if (hash.startsWith('#sailor/')) {
        openSailorModal(decodeURIComponent(hash.slice('#sailor/'.length)), /*skipHash=*/true);
        return;
      }
      const viewId = (e.state && e.state.viewId) || viewIdFromHash(hash) || 'rankings';
      switchView(viewId, null, /*skipHash=*/true);
    });

    // On first load, navigate to the tab or sailor profile in the URL hash (if any)
    const initialHash = window.location.hash || '';
    if (initialHash.startsWith('#sailor/')) {
      const sailorName = decodeURIComponent(initialHash.slice('#sailor/'.length));
      // Defer until after data has loaded so the profile has results to show
      dataLoadedPromise.then(() => openSailorModal(sailorName, /*skipHash=*/true));
    } else {
      const initialView = viewIdFromHash(initialHash);
      if (initialView && initialView !== 'rankings') {
        dataLoadedPromise.then(() => switchView(initialView, null, /*skipHash=*/true));
      }
    }

    // Sidebar Logo view trigger
    document.querySelector('.sb-logo')?.addEventListener('click', () => switchView('rankings'));

    // Gold / Silver fleet switcher
    document.querySelectorAll('[data-fleet-pill]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // logo click also switches to rankings
        setActiveFleet(btn.getAttribute('data-fleet-pill'));
      });
    });
    populateFleetPeriodSelect();
    updateSquadUiForFleet();
    document.getElementById('fleet-period-select')?.addEventListener('change', (e) => {
      setActiveFleetPeriodFromKey(e.target.value);
    });

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
    document.getElementById('regatta-scores-upload-trigger')?.addEventListener('click', () => {
      if (!requireEditor()) return;
      if (!CURRENT_SELECTED_REGATTA) {
        toastWarn('Open a regatta first, then upload scores.');
        return;
      }
      document.getElementById('regattaScoresFileInput')?.click();
    });
    document.getElementById('regattaScoresFileInput')?.addEventListener('change', e => {
      if (e.target.files[0]) uploadRegattaScoresExcel(e.target);
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
    document.getElementById('signin-cancel-btn')?.addEventListener('click', () => closeSignInModal());
    document.getElementById('signin-submit-btn')?.addEventListener('click', () => submitSignIn());
    document.getElementById('signin-modal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeSignInModal();
    });
    document.getElementById('signin-pass')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitSignIn();
      } else if (e.key === 'Escape') {
        closeSignInModal();
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('signin-modal')?.classList.contains('open')) {
        closeSignInModal();
      }
    });

    // Mobile sidebar menu
    document.getElementById('sb-menu-toggle')?.addEventListener('click', e => {
      e.stopPropagation();
      const sidebar = document.getElementById('app-sidebar');
      const btn = document.getElementById('sb-menu-toggle');
      if (!sidebar) return;
      const open = sidebar.classList.toggle('nav-open');
      if (btn) {
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      }
    });
    document.querySelectorAll('.sb-nav .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const sidebar = document.getElementById('app-sidebar');
        const btn = document.getElementById('sb-menu-toggle');
        if (sidebar?.classList.contains('nav-open')) {
          sidebar.classList.remove('nav-open');
          if (btn) {
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-label', 'Open menu');
          }
        }
      });
    });

    // Rankings Panel Filter and Search elements
    document.getElementById('nameSearch')?.addEventListener('input', () => {
      renderRankings();
      if (lastMainView === 'charts') renderComparisonChart();
    });
    document.getElementById('squadFilter')?.addEventListener('change', () => {
      renderRankings();
      if (lastMainView === 'charts') renderComparisonChart();
    });
    document.getElementById('top50')?.addEventListener('change', () => renderRankings());
    
    // Gender Filter Pills (All / Boys / Girls)
    document.querySelectorAll('.pill[data-gender]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.pill[data-gender]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        genderFilter = pill.getAttribute('data-gender');
        renderRankings();
        if (lastMainView === 'charts') renderComparisonChart();
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
      const moveBtn = e.target.closest('.fleet-move-btn');
      if (moveBtn) {
        e.preventDefault();
        e.stopPropagation();
        const nm = sailorNameFromDataAttr(moveBtn.getAttribute('data-sailor'));
        const fl = moveBtn.getAttribute('data-fleet');
        if (nm && typeof moveSailorToFleet === 'function') moveSailorToFleet(nm, fl);
        return;
      }
      const btn = e.target.closest('.fleet-drop-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        dropSailor(sailorNameFromDataAttr(btn.getAttribute('data-sailor')));
      }
    });
    document.getElementById('fleet-dropped-list')?.addEventListener('click', e => {
      const btn = e.target.closest('.fleet-promote-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        promoteSailor(sailorNameFromDataAttr(btn.getAttribute('data-sailor')));
      }
    });

    // Sailor profile: drop / re-promote
    document.getElementById('sm-drop-btn')?.addEventListener('click', () => {
      const name = cleanSailorName(document.getElementById('sm-orig-name')?.value || '');
      if (!name) return;
      if (!confirm(`Drop "${name}" from the active fleet? They will be hidden from rankings (history kept).`)) return;
      dropSailor(name);
    });
    document.getElementById('sm-promote-btn')?.addEventListener('click', () => {
      const name = cleanSailorName(document.getElementById('sm-orig-name')?.value || '');
      if (!name) return;
      promoteSailor(name);
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

    // Chart sailors list modal (opened by clicking a bar in the Analysis charts)
    document.getElementById('chart-modal-close-btn')?.addEventListener('click', () => closeChartSailorsModal());
    document.getElementById('chartSailorsModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeChartSailorsModal();
    });
    document.getElementById('chart-sailors-body')?.addEventListener('click', e => {
      // The global .name-c delegation opens the profile; also dismiss the modal
      if (e.target.closest('.name-c')) closeChartSailorsModal();
    });

    // Historical gold panel elements
    document.getElementById('hg-search')?.addEventListener('input', () => renderHistGoldPanel());
    document.getElementById('hg-only-active')?.addEventListener('change', () => renderHistGoldPanel());

    // Dynamic dialog modals controls
    document.getElementById('ar-modal-open-btn')?.addEventListener('click', () => openAddRegattaModal());
    document.getElementById('ar-modal-close-btn')?.addEventListener('click', () => closeAddRegattaModal());
    document.getElementById('ar-modal-close-btn-cancel')?.addEventListener('click', () => closeAddRegattaModal());
    document.getElementById('ar-modal-submit-btn')?.addEventListener('click', () => submitAddRegatta());

    // Add Sailor Result Modal controls
    document.getElementById('asr-modal-close-btn')?.addEventListener('click', () => closeAddSailorResultModal());
    document.getElementById('asr-modal-cancel-btn')?.addEventListener('click', () => closeAddSailorResultModal());
    document.getElementById('asr-modal-submit-btn')?.addEventListener('click', () => submitAddSailorResult());
    document.querySelectorAll('.asr-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setAsrMode(btn.getAttribute('data-mode')));
    });

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
        openSailorModal(sailorNameFromDataAttr(nameCell.getAttribute('data-sailor')));
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
        const name = sailorNameFromDataAttr(input.getAttribute('data-sailor'));
        const field = input.getAttribute('data-field');
        let val = input.value.trim().replace('#', '');
        let num = null;
        if (val !== '') {
          const n = Number(val);
          if (!Number.isInteger(n) || n < 1) {
            toastWarn('Please enter a valid rank (positive integer).');
            input.value = input.defaultValue || '';
            return;
          }
          num = n;
        }
        
        const key = typeof resolveSailorMetadataKey === 'function' ? resolveSailorMetadataKey(name) : name;
        if (!SAILOR_METADATA[key]) SAILOR_METADATA[key] = {};
        SAILOR_METADATA[key][field] = num;
        
        recomputeSailors();
        saveData();
        renderAll();
        return;
      }

      // Historical & Gold: per-row squad status
      const hgSquad = e.target.closest('.hg-squad-select');
      if (hgSquad) {
        if (!requireEditor()) {
          hgSquad.value = hgSquad.defaultValue || '';
          return;
        }
        const name = sailorNameFromDataAttr(hgSquad.getAttribute('data-sailor'));
        const field = hgSquad.getAttribute('data-field');
        if (!name || !field) return;
        setSquadStatus(name, field, hgSquad.value || '');
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

      // Squad status lock selects on the rankings table (same keys as Historical & Gold)
      const squadSel = e.target.closest('.squad-lock-select');
      if (squadSel) {
        if (!requireEditor()) {
          renderRankings();
          return;
        }
        const name = sailorNameFromDataAttr(squadSel.getAttribute('data-sailor'));
        const field = squadSel.getAttribute('data-field');
        const val = squadSel.value;
        setSquadStatus(name, field, val || '');
        saveData();
        recomputeSailors();
        renderRankings();
        if (lastMainView === 'hist-gold') renderHistGoldPanel();
        return;
      }
    });

    // Regatta results select change listener
    document.getElementById('resultsRegattaSelect')?.addEventListener('change', e => {
      if (BULK_EDIT_MODE) {
        if (!confirm("Discard unsaved bulk edits for this regatta?")) {
          e.target.value = CURRENT_SELECTED_REGATTA || '';
          return;
        }
        cancelBulkEdit();
      }
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
          if (BULK_EDIT_MODE) {
            if (!confirm("Discard unsaved bulk edits for this regatta?")) return;
            cancelBulkEdit();
          }
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
          openAddSailorResultModal();
          return;
        }

        const bulkEditToggleBtn = e.target.closest('#bulk-edit-toggle-btn');
        if (bulkEditToggleBtn) {
          enableBulkEdit();
          return;
        }

        const bulkEditSaveBtn = e.target.closest('#bulk-edit-save-btn');
        if (bulkEditSaveBtn) {
          saveBulkEditChanges();
          return;
        }

        const bulkEditCancelBtn = e.target.closest('#bulk-edit-cancel-btn');
        if (bulkEditCancelBtn) {
          if (confirm("Discard unsaved bulk edits for this regatta?")) {
            cancelBulkEdit();
          }
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

  function openAddSailorResultModal() {
    if (!requireEditor()) return;
    if (!CURRENT_SELECTED_REGATTA) return;
    const reg = REGATTAS.find(r => r.name === CURRENT_SELECTED_REGATTA);
    if (!reg) return;

    const nameEl = document.getElementById('asr-regatta-name');
    if (nameEl) nameEl.textContent = `Adding a result to "${reg.name}"`;

    const inRegatta = new Set(reg.sailors.map(s => normalizeName(s.name)));
    const candidates = getAllSailorsInSystem()
      .filter(s => !inRegatta.has(normalizeName(s.name)))
      .sort((a, b) => a.name.localeCompare(b.name));

    const select = document.getElementById('asr-existing-select');
    if (select) {
      select.replaceChildren(createSelectOption('', '— choose sailor —'));
      candidates.forEach(s => {
        select.appendChild(createSelectOption(s.name, s.name));
      });
    }

    document.getElementById('asr-new-name').value = '';
    document.getElementById('asr-new-gender').value = 'M';
    document.getElementById('asr-new-born').value = '';
    document.getElementById('asr-new-club').value = '';
    document.getElementById('asr-new-school').value = '';
    document.getElementById('asr-rank').value = '';
    document.getElementById('asr-points').value = '';

    setAsrMode(candidates.length > 0 ? 'existing' : 'new');
    document.getElementById('addSailorResultModal').style.display = 'flex';
  }

  function closeAddSailorResultModal() {
    document.getElementById('addSailorResultModal').style.display = 'none';
  }

  function setAsrMode(mode) {
    document.querySelectorAll('.asr-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    document.getElementById('asr-existing-wrap').style.display = mode === 'existing' ? 'flex' : 'none';
    document.getElementById('asr-new-wrap').style.display = mode === 'new' ? 'flex' : 'none';
  }

  function getAsrMode() {
    const active = document.querySelector('.asr-mode-btn.active');
    return active ? active.getAttribute('data-mode') : 'existing';
  }

  function submitAddSailorResult() {
    if (!requireEditor()) return;
    if (!CURRENT_SELECTED_REGATTA) return;
    const reg = REGATTAS.find(r => r.name === CURRENT_SELECTED_REGATTA);
    if (!reg) return;

    const mode = getAsrMode();
    let name, gender, born, club, school;

    if (mode === 'existing') {
      name = document.getElementById('asr-existing-select').value;
      if (!name) {
        toastWarn('Please select a sailor.');
        return;
      }
      const info = getAllSailorsInSystem().find(s => s.name === name);
      gender = info ? info.g : null;
      born = info ? info.born : null;
      club = info ? info.club : '';
      school = info ? info.school : '';
    } else {
      name = document.getElementById('asr-new-name').value.trim();
      if (!name) {
        toastWarn('Sailor name cannot be empty.');
        return;
      }
      if (getAllSailorsInSystem().some(s => isSameSailor(s.name, name))) {
        toastWarn('A sailor with this name already exists — use "Existing Sailor" instead.');
        return;
      }
      gender = document.getElementById('asr-new-gender').value;
      const minBirthYear = COMP_YEAR - 20;
      const maxBirthYear = COMP_YEAR;
      const bornRaw = document.getElementById('asr-new-born').value;
      born = parseBirthYearInput(bornRaw);
      if (born === null || Number.isNaN(born)) {
        toastWarn(`Please enter a valid Birth Year (between ${minBirthYear} and ${maxBirthYear}).`);
        return;
      }
      club = document.getElementById('asr-new-club').value.trim();
      school = document.getElementById('asr-new-school').value.trim();
    }

    if (reg.sailors.some(s => isSameSailor(s.name, name))) {
      toastWarn('This sailor already has a result in this regatta.');
      return;
    }

    const rank = parseInt(document.getElementById('asr-rank').value);
    if (isNaN(rank) || rank < 1) {
      toastWarn('Please enter a valid Rank (positive integer).');
      return;
    }

    const pointsRaw = document.getElementById('asr-points').value.trim();
    let pointsVal = null;
    if (pointsRaw !== '') {
      pointsVal = parseFloat(pointsRaw);
      if (isNaN(pointsVal) || pointsVal < 0) {
        toastWarn('Nett points must be a non-negative number.');
        return;
      }
    }

    reg.sailors.push({
      name,
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
    closeAddSailorResultModal();
  }

  // Bulk edit mode: defer recompute/save/re-render until the editor explicitly
  // saves, so editing many rank/points fields in sequence doesn't re-sort the
  // table or round-trip to Firestore on every keystroke.
  function enableBulkEdit() {
    if (!requireEditor()) return;
    if (!CURRENT_SELECTED_REGATTA) return;
    const reg = REGATTAS.find(r => r.name === CURRENT_SELECTED_REGATTA);
    if (!reg) return;
    BULK_EDIT_MODE = true;
    BULK_EDIT_SNAPSHOT = JSON.parse(JSON.stringify(reg.sailors));
    updateBulkEditUI();
    // Re-render so rank/nett inputs become enabled
    renderSpecificRegattaResults();
    toastInfo('Bulk edit on — edit ranks and nett points, then Save All Changes.');
  }

  function saveBulkEditChanges() {
    BULK_EDIT_MODE = false;
    BULK_EDIT_SNAPSHOT = null;
    recomputeSailors();
    saveData();
    renderAll();
    renderSpecificRegattaResults();
    updateBulkEditUI();
    toastSuccess('Regatta scores saved.');
  }

  function cancelBulkEdit() {
    if (BULK_EDIT_SNAPSHOT && CURRENT_SELECTED_REGATTA) {
      const reg = REGATTAS.find(r => r.name === CURRENT_SELECTED_REGATTA);
      if (reg) reg.sailors = BULK_EDIT_SNAPSHOT;
    }
    BULK_EDIT_MODE = false;
    BULK_EDIT_SNAPSHOT = null;
    recomputeSailors();
    renderAll();
    renderSpecificRegattaResults();
    updateBulkEditUI();
    toastInfo('Bulk edits discarded.');
  }

  function updateBulkEditUI() {
    // toggle/add/delete carry the CSS "editor-only" class (display:inline-flex !important
    // for editors), so they're hidden during bulk edit via the higher-specificity
    // ".editor-only.bulk-edit-hidden" rule rather than inline styles, which the
    // "editor-only" rule's !important would otherwise override.
    const toggleBtn = document.getElementById('bulk-edit-toggle-btn');
    const addBtn = document.getElementById('add-sailor-result-trigger');
    const deleteBtn = document.querySelector('.regatta-delete-btn-detail');
    [toggleBtn, addBtn, deleteBtn].forEach(btn => {
      if (btn) btn.classList.toggle('bulk-edit-hidden', BULK_EDIT_MODE);
    });

    const saveBtn = document.getElementById('bulk-edit-save-btn');
    const cancelBtn = document.getElementById('bulk-edit-cancel-btn');
    if (saveBtn) saveBtn.style.display = BULK_EDIT_MODE ? 'inline-flex' : 'none';
    if (cancelBtn) cancelBtn.style.display = BULK_EDIT_MODE ? 'inline-flex' : 'none';

    const hint = document.getElementById('bulk-edit-hint');
    const activeBanner = document.getElementById('bulk-edit-active-banner');
    const showResults = !!CURRENT_SELECTED_REGATTA;
    if (hint) {
      // CSS editor-only uses display:inline-flex !important; override carefully
      if (isEditor() && showResults && !BULK_EDIT_MODE) {
        hint.style.setProperty('display', 'flex', 'important');
      } else {
        hint.style.setProperty('display', 'none', 'important');
      }
    }
    if (activeBanner) {
      activeBanner.style.display = (isEditor() && showResults && BULK_EDIT_MODE) ? 'flex' : 'none';
    }

    // Rank / nett points: only interactive during bulk edit
    document.querySelectorAll('.reg-rank-input, .reg-points-input').forEach(inp => {
      const allow = isEditor() && BULK_EDIT_MODE;
      inp.disabled = !allow;
      inp.tabIndex = allow ? (inp.tabIndex > 0 ? inp.tabIndex : 0) : -1;
      inp.style.cursor = allow ? '' : 'not-allowed';
      inp.style.background = allow ? '' : 'var(--bg2)';
      inp.style.color = allow ? '' : 'var(--text3)';
    });
  }

  function updateRegattaSailorRank(regName, sailorName, val) {
    if (!requireEditor()) return;
    if (!BULK_EDIT_MODE) {
      toastWarn('Click Bulk Edit to change ranks and nett points.');
      renderSpecificRegattaResults();
      return;
    }
    const reg = REGATTAS.find(r => r.name === regName);
    if (!reg) return;
    const s = reg.sailors.find(x => isSameSailor(x.name, sailorName));
    if (s) {
      const parsed = parseOptionalPositiveInt(val);
      if (Number.isNaN(parsed)) {
        toastWarn('Rank must be a positive integer.');
        renderSpecificRegattaResults();
        return;
      }
      s.rank = parsed;
      // Defer recompute/save until "Save All Changes"
    }
  }

  function updateRegattaSailorPoints(regName, sailorName, val) {
    if (!requireEditor()) return;
    if (!BULK_EDIT_MODE) {
      toastWarn('Click Bulk Edit to change ranks and nett points.');
      renderSpecificRegattaResults();
      return;
    }
    const reg = REGATTAS.find(r => r.name === regName);
    if (!reg) return;
    const s = reg.sailors.find(x => isSameSailor(x.name, sailorName));
    if (s) {
      const parsed = val.trim() !== '' ? parseFloat(val.trim()) : null;
      if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
        toastWarn('Nett points must be a non-negative number.');
        renderSpecificRegattaResults();
        return;
      }
      s.nett = parsed;
      // Defer recompute/save until "Save All Changes"
    }
  }

  /** Update rankings and related views without re-rendering the results editor table. */
  function refreshViewsAfterInlineRegattaEdit() {
    renderRankingsPanel();
    renderRegattasPanel();
    populateResultsDropdown();
    populateRegattaCheckboxList();
    updateDatabaseSourceTags();
  }

  function updateRegattaDns(regName, val) {
    if (!requireEditor()) return;
    const reg = REGATTAS.find(r => r.name === regName);
    if (!reg) return;
    const parsed = parseInt(val);
    if (isNaN(parsed) || parsed < 1) {
      toastWarn('Total sailors in regatta must be a positive integer.');
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
    if (!confirm(`Delete regatta "${regName}" and all sailor results in it?\n\nYou can Undo for 10 seconds after deleting.`)) return;

    const snapshot = JSON.parse(JSON.stringify(REGATTAS[idx]));
    const insertAt = idx;
    REGATTAS.splice(idx, 1);
    if (SELECTED_REGATTA_NAMES && Array.isArray(SELECTED_REGATTA_NAMES)) {
      SELECTED_REGATTA_NAMES = SELECTED_REGATTA_NAMES.filter(n => n !== regName);
      if (SELECTED_REGATTA_NAMES.length === 0) SELECTED_REGATTA_NAMES = null;
    }
    recomputeSailors();
    saveData();
    renderAll();
    renderSpecificRegattaResults(null);

    PENDING_REGATTA_UNDO = { snapshot, insertAt, name: regName };
    const host = document.getElementById('toast-host');
    if (!host) {
      toastSuccess(`Deleted "${regName}".`);
      return;
    }
    const el = document.createElement('div');
    el.className = 'toast toast-warn';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span class="toast-icon">⚠</span>
      <div class="toast-body">
        <div class="toast-title">Regatta deleted</div>
        <div class="toast-msg">${escapeHtml(regName)} — undo within 10s</div>
      </div>
      <button type="button" class="btn-secondary toast-undo-btn" style="padding:4px 10px; font-size:10px; flex-shrink:0;">Undo</button>
      <button type="button" class="toast-close" aria-label="Dismiss">×</button>
    `;
    let settled = false;
    const finish = () => {
      if (el._gone) return;
      el._gone = true;
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 180);
    };
    el.querySelector('.toast-close')?.addEventListener('click', finish);
    el.querySelector('.toast-undo-btn')?.addEventListener('click', () => {
      if (settled) return;
      settled = true;
      if (PENDING_REGATTA_UNDO && PENDING_REGATTA_UNDO.name === regName) {
        const { snapshot: snap, insertAt: at } = PENDING_REGATTA_UNDO;
        const pos = Math.min(at, REGATTAS.length);
        REGATTAS.splice(pos, 0, snap);
        PENDING_REGATTA_UNDO = null;
        recomputeSailors();
        saveData();
        renderAll();
        renderSpecificRegattaResults(snap.name);
        toastSuccess(`Restored "${snap.name}".`);
      }
      finish();
    });
    host.appendChild(el);
    setTimeout(() => {
      if (!settled) {
        settled = true;
        if (PENDING_REGATTA_UNDO && PENDING_REGATTA_UNDO.name === regName) {
          PENDING_REGATTA_UNDO = null;
        }
        finish();
      }
    }, 10000);
  }

  async function uploadRegattaDocument(regName, file) {
    if (!requireEditor()) return;
    if (!storage) {
      toastError('Document uploads are unavailable right now (storage failed to load). Please refresh the page and try again.');
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
        toastSuccess('Document uploaded.');
      }
    } catch (err) {
      console.error("Upload error:", err);
      setSyncStatus('error', err.message);
      toastError('Failed to upload document: ' + err.message);
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
      toastSuccess('Document removed.');
    } catch (err) {
      console.error("Removal error:", err);
      setSyncStatus('error', err.message);
      toastError('Failed to remove document: ' + err.message);
    }
  }

  function handleRegattaDocUpload(inputEl, regName) {
    const file = inputEl.files[0];
    if (!file) return;
    uploadRegattaDocument(regName, file);
  }

  // Redeploy trigger to resolve transient Pages deployment artifact collision

