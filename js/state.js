const LOCAL_DATA_KEY = 'op_ranking_regattas_v3';

// Global application state variables
let REGATTAS = [];
let SAILORS = [];
let DROPPED_SAILORS = new Set();
let EXCLUDED = new Map();
let SELECTED_REGATTA_NAMES = null;
let selectedReason = 'Declined';
let genderFilter = 'all';
let simCount = 0;
let chartObjs = {};
let SAILOR_METADATA = {};
let sortKey = 'score';
let sortAsc = true;
let lastMainView = 'rankings';
let targetCachedData = null;
const MAX_CHART_SAILORS = 20;
let mcSortKey = 'rank';
let mcSortAsc = true;
let hgSortKey = 'rank';
let hgSortAsc = true;
// Historical & Gold table column visibility (persists for the session)
let hgColumnVisibility = null;
let BULK_EDIT_MODE = false;
let BULK_EDIT_SNAPSHOT = null;
/** @type {Date|null} last known cloud/local data update */
let LAST_DATA_UPDATED_AT = null;
/** Pending regatta soft-delete for undo */
let PENDING_REGATTA_UNDO = null;

// Firestore collection hook
const CLOUD_DOC = () => db.collection('opRanking').doc('state');
let CURRENT_USER = null;          // set by auth listener; non-null = editor
let PENDING_LOCAL_MIGRATION = null; // legacy localStorage backup
let SUPPRESS_SNAPSHOT = false;     // suppress snapshot echo when saving
let CLOUD_HAS_DATA = false;        // true if doc exists with data

function isEditor() { 
  return !!CURRENT_USER; 
}

function requireEditor() {
  if (isEditor()) return true;
  setSyncStatus('locked');
  if (typeof toastWarn === 'function') {
    toastWarn('View-only mode. Sign in to edit rankings and fleet.');
  }
  return false;
}

// Serialise the app state to save to Cloud Firestore
function serializeState() {
  if (typeof sanitizeDroppedSailors === 'function') sanitizeDroppedSailors();
  return JSON.parse(JSON.stringify({
    regattas: REGATTAS,
    dropped: Array.from(DROPPED_SAILORS),
    excluded: Object.fromEntries(EXCLUDED),
    metadata: SAILOR_METADATA,
    selectedRegattas: SELECTED_REGATTA_NAMES === undefined ? null : SELECTED_REGATTA_NAMES
  }));
}

// Load state into the global variables
function applyState(s) {
  REGATTAS = Array.isArray(s.regattas) ? s.regattas : [];
  DROPPED_SAILORS = new Set(Array.isArray(s.dropped) ? s.dropped : []);
  // Clean HTML-entity / URI-mangled names so re-promote and rankings agree
  if (typeof sanitizeDroppedSailors === 'function') {
    applyState._droppedWasDirty = sanitizeDroppedSailors();
  } else {
    applyState._droppedWasDirty = false;
  }
  if (s.excluded && typeof s.excluded === 'object' && !Array.isArray(s.excluded)) {
    EXCLUDED = new Map(Object.entries(s.excluded));
  } else {
    EXCLUDED = new Map(Array.isArray(s.excluded) ? s.excluded : []);
  }
  SAILOR_METADATA = (s.metadata && typeof s.metadata === 'object') ? s.metadata : {};
  SELECTED_REGATTA_NAMES = (s.selectedRegattas === undefined) ? null : s.selectedRegattas;
  // Firestore Timestamp or ISO / millis
  if (s.updatedAt) {
    if (typeof s.updatedAt.toDate === 'function') LAST_DATA_UPDATED_AT = s.updatedAt.toDate();
    else if (s.updatedAt instanceof Date) LAST_DATA_UPDATED_AT = s.updatedAt;
    else if (typeof s.updatedAt === 'number') LAST_DATA_UPDATED_AT = new Date(s.updatedAt);
    else if (typeof s.updatedAt === 'string') {
      const d = new Date(s.updatedAt);
      LAST_DATA_UPDATED_AT = Number.isNaN(d.getTime()) ? null : d;
    }
  }
}

function applyStateFromSeed() {
  REGATTAS = getSeedRegattas();
  DROPPED_SAILORS = getDefaultDroppedSailors();
  EXCLUDED = getDefaultExcludedSailors();
  SAILOR_METADATA = getDefaultSailorMetadata();
  SELECTED_REGATTA_NAMES = null;
}

// Legacy local storage state backup read
function readLegacyLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY);
    if (!raw) return null;
    const regattas = JSON.parse(raw);
    if (!Array.isArray(regattas) || regattas.length === 0) return null;
    return {
      regattas,
      dropped: JSON.parse(localStorage.getItem('op_ranking_dropped_v3') || '[]'),
      excluded: JSON.parse(localStorage.getItem('op_ranking_excluded_v3') || '[]'),
      metadata: JSON.parse(localStorage.getItem('op_ranking_sailor_metadata_v3') || '{}'),
      selectedRegattas: JSON.parse(localStorage.getItem('op_ranking_selected_regattas_v3') || 'null')
    };
  } catch (e) {
    console.error('Could not read legacy local data:', e);
    return null;
  }
}

// Save state to the cloud database (Firestore)
async function saveData() {
  if (!isEditor()) { setSyncStatus('locked'); return; }
  setSyncStatus('saving');
  SUPPRESS_SNAPSHOT = true;
  try {
    const payload = serializeState();
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await CLOUD_DOC().set(payload);
    CLOUD_HAS_DATA = true;
    LAST_DATA_UPDATED_AT = new Date();
    setSyncStatus('saved');
    if (typeof updateDataFreshnessUI === 'function') updateDataFreshnessUI();
  } catch (e) {
    console.error('Cloud save failed:', e);
    setSyncStatus('error', e && e.message);
  } finally {
    SUPPRESS_SNAPSHOT = false;
  }
}

// Load state from the cloud database (Firestore)
async function loadData() {
  let cloud = null;
  try {
    const snap = await CLOUD_DOC().get();
    if (snap.exists) cloud = snap.data();
  } catch (e) {
    console.error('Cloud load failed:', e);
    setSyncStatus('error', e && e.message);
  }

  if (cloud && Array.isArray(cloud.regattas)) {
    CLOUD_HAS_DATA = true;
    applyState(cloud);
  } else {
    CLOUD_HAS_DATA = false;
    const legacy = readLegacyLocalState();
    if (legacy) {
      applyState(legacy);
      PENDING_LOCAL_MIGRATION = legacy;
    } else {
      applyStateFromSeed();
    }
  }
  recomputeSailors();
  applyEditorUI();
  // Persist cleaned dropped names so re-promote works after entity/URI corruption
  if (applyState._droppedWasDirty && isEditor()) {
    applyState._droppedWasDirty = false;
    await saveData();
  }
}

async function maybeMigrate() {
  if (!isEditor()) return;
  let cloudHasData = false;
  try {
    const snap = await CLOUD_DOC().get();
    cloudHasData = snap.exists && snap.data() && Array.isArray(snap.data().regattas);
  } catch (e) { return; }
  if (cloudHasData) { CLOUD_HAS_DATA = true; PENDING_LOCAL_MIGRATION = null; return; }
  
  const msg = PENDING_LOCAL_MIGRATION
    ? "The cloud database is empty. Publish this browser's existing data to the cloud as the starting point?"
    : "The cloud database is empty. Publish the data currently shown to the cloud now so all viewers share it?";
  if (confirm(msg)) {
    await saveData();
    PENDING_LOCAL_MIGRATION = null;
    toastSuccess('Data published to the cloud — all viewers now share this copy.');
  }
}

async function forceMigrateLocalToCloud() {
  if (!requireEditor()) return;
  const legacy = readLegacyLocalState();
  if (!legacy) {
    toastWarn('No legacy browser cache found in this browser.');
    return;
  }
  const msg = "Are you sure you want to overwrite the Firestore cloud database with this browser's local cache? This will replace whatever is currently in the cloud database.";
  if (confirm(msg)) {
    try {
      applyState(legacy);
      recomputeSailors();
      await saveData();
      renderAll();
      toastSuccess('Cloud database overwritten with this browser’s local cache.');
    } catch (e) {
      toastError('Failed to migrate: ' + e.message);
    }
  }
}
