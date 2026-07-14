/**
 * Build SailorPath official snapshot from ranking app state.
 * Loaded in the browser; also runnable under Node via vm for seed builds.
 *
 * Snapshot shape (v2 multi-fleet):
 * {
 *   meta: { version, exportedAt, country, classSlug, source, fleets[] },
 *   fleets: {
 *     gold:   { id, label, standings, sailors, regattas, clubs },
 *     silver: { id, label, standings, sailors, regattas, clubs }
 *   },
 *   sailors: [ ...merged profiles across fleets for /s/{slug} ]
 * }
 */
(function (root) {
  'use strict';

  var COUNTRY = 'sg';
  var CLASS_SLUG = 'optimist';
  var WINDOW = 5;
  var BEST_N = 3;
  var FLEET_IDS = ['gold', 'silver'];
  var FLEET_LABELS = { gold: 'Gold Fleet', silver: 'Silver Fleet' };

  function normalizeName(name) {
    return String(name || '')
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function slugify(name) {
    return String(name || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'sailor';
  }

  function ageBand(born, refYear) {
    if (!born) return null;
    var a = refYear - born;
    if (a >= 13) return '13+';
    if (a === 12) return '12';
    if (a === 11) return '11';
    if (a <= 10) return '10 & under';
    return String(a);
  }

  function getRegattaFleet(reg) {
    if (reg && String(reg.fleet).toLowerCase() === 'silver') return 'silver';
    return 'gold';
  }

  function fleetSize(reg) {
    if (reg && reg.dns != null && reg.dns !== '') {
      var n = parseInt(reg.dns, 10);
      if (!isNaN(n) && n > 0) return n;
    }
    return (reg && reg.sailors && reg.sailors.length) || 0;
  }

  function dnsPenalty(reg) {
    var n = fleetSize(reg);
    return n > 0 ? n + 1 : 84;
  }

  function isOverseas(reg) {
    return reg && reg.type === 'overseas';
  }

  function activeRegattasForFleet(allRegs, fleetId) {
    return (allRegs || [])
      .filter(function (r) {
        return (
          r &&
          r.name &&
          !isOverseas(r) &&
          getRegattaFleet(r) === fleetId &&
          Array.isArray(r.sailors) &&
          r.sailors.length > 0
        );
      })
      .slice()
      .sort(function (a, b) {
        return String(a.date || '').localeCompare(String(b.date || ''));
      });
  }

  function currentFleetPeriodKey(refYear) {
    var d = new Date();
    var year = refYear || d.getFullYear();
    // Prefer calendar half-year of "now" when exporting live data
    var month = d.getMonth();
    var kind = month < 6 ? 'jan' : 'jul';
    var yy = String(year).slice(-2);
    // If export year differs from now, use Jul of that year as default window
    if (refYear && refYear !== d.getFullYear()) {
      kind = 'jul';
      yy = String(refYear).slice(-2);
    }
    return (kind === 'jan' ? 'fleetJan' : 'fleetJul') + yy;
  }

  function memberFleet(name, metadata, periodKey) {
    metadata = metadata || {};
    var meta = metadata[name] || {};
    var n = normalizeName(name);
    Object.keys(metadata).forEach(function (k) {
      if (normalizeName(k) === n) meta = metadata[k] || meta;
    });
    // Period-specific membership first
    if (periodKey && meta[periodKey]) {
      return String(meta[periodKey]).toLowerCase() === 'silver' ? 'silver' : 'gold';
    }
    if (String(meta.fleet || '').toLowerCase() === 'silver') return 'silver';
    if (String(meta.fleet || '').toLowerCase() === 'gold') return 'gold';
    return null;
  }

  function computeFleetStandings(allRegs, fleetId, droppedSet, excludedMap, refYear, metadata) {
    metadata = metadata || {};
    var periodKey = currentFleetPeriodKey(refYear);
    var ordered = activeRegattasForFleet(allRegs, fleetId);
    var windowRegs = ordered.slice(-WINDOW);
    var byNorm = new Map();

    windowRegs.forEach(function (reg) {
      (reg.sailors || []).forEach(function (row) {
        var norm = normalizeName(row.name);
        if (!norm || droppedSet.has(norm)) return;
        if (excludedMap.has(row.name) || excludedMap.has(norm)) return;
        // Strict membership for this half-year period
        var mf = memberFleet(row.name, metadata, periodKey);
        if (mf == null) mf = 'gold';
        if (mf !== fleetId) return;
        if (!byNorm.has(norm)) {
          byNorm.set(norm, {
            name: row.name,
            g: row.g || null,
            born: row.born || null,
            club: row.club || '',
            scores: Array(windowRegs.length).fill(null),
            ranks: Array(windowRegs.length).fill(null),
          });
        }
        var s = byNorm.get(norm);
        if (row.g && !s.g) s.g = row.g;
        if (row.born && !s.born) s.born = row.born;
        if (row.club && !s.club) s.club = row.club;
        if (row.name && row.name.length > s.name.length) s.name = row.name;
      });
    });

    windowRegs.forEach(function (reg, idx) {
      var byName = new Map();
      (reg.sailors || []).forEach(function (row) {
        byName.set(normalizeName(row.name), row);
      });
      byNorm.forEach(function (s, norm) {
        var row = byName.get(norm);
        if (row) {
          var place = row.rank != null ? Number(row.rank) : row.nett != null ? Number(row.nett) : null;
          s.ranks[idx] = place;
          s.scores[idx] = place;
        }
      });
    });

    var list = [];
    byNorm.forEach(function (s) {
      var filled = s.scores.map(function (v, i) {
        return v == null ? dnsPenalty(windowRegs[i]) : v;
      });
      var best = filled.slice().sort(function (a, b) { return a - b; }).slice(0, BEST_N);
      var score = best.reduce(function (a, b) { return a + b; }, 0);
      list.push({
        name: s.name,
        g: s.g,
        born: s.born,
        club: s.club,
        score: score,
        ranks: s.ranks,
        filledScores: filled,
      });
    });

    list.sort(function (a, b) {
      return a.score - b.score || a.name.localeCompare(b.name);
    });
    list.forEach(function (s, i) {
      s.rank = i + 1;
    });

    // Approximate squad badges within fleet (Gold uses Nat A/B/DS language)
    var squad = new Map();
    ['M', 'F'].forEach(function (g) {
      var pool = list.filter(function (s) { return s.g === g; });
      pool.slice(0, 8).forEach(function (s) {
        squad.set(normalizeName(s.name), 'Nat A');
      });
      pool.slice(8, 16).forEach(function (s) {
        var n = normalizeName(s.name);
        if (!squad.has(n)) squad.set(n, 'Nat B');
      });
      pool.slice(16).forEach(function (s) {
        var n = normalizeName(s.name);
        if (!squad.has(n)) squad.set(n, fleetId === 'silver' ? 'Silver' : 'DS');
      });
    });

    return { list: list, windowRegs: windowRegs, squad: squad, refYear: refYear };
  }

  function buildTrajectory(allRegs, fleetId, droppedSet, excludedMap, sailorNorm, refYear, metadata) {
    var ordered = activeRegattasForFleet(allRegs, fleetId);
    var points = [];
    for (var end = Math.min(WINDOW, ordered.length); end <= ordered.length; end++) {
      var prefixRegs = ordered.slice(Math.max(0, end - WINDOW), end);
      var nameSet = new Set(prefixRegs.map(function (r) { return r.name; }));
      var subset = (allRegs || []).filter(function (r) {
        return nameSet.has(r.name) && getRegattaFleet(r) === fleetId;
      });
      var sub = computeFleetStandings(subset, fleetId, droppedSet, excludedMap, refYear, metadata || {});
      var me = sub.list.find(function (s) {
        return normalizeName(s.name) === sailorNorm;
      });
      if (!me) continue;
      var lastReg = prefixRegs[prefixRegs.length - 1];
      points.push({
        date: lastReg.date,
        regatta: lastReg.name,
        rank: me.rank,
        score: me.score,
        fleet: fleetId,
      });
    }
    return points;
  }

  /**
   * @param {object} state
   * @param {Array} state.regattas
   * @param {string[]|Set} state.dropped
   * @param {object|Map} state.excluded  name -> reason
   * @param {object} [state.metadata]
   * @param {string} [state.source]
   * @param {number} [state.compYear]
   */
  function buildSailorpathSnapshot(state) {
    state = state || {};
    var regattas = state.regattas || [];
    var droppedArr = state.dropped
      ? Array.isArray(state.dropped)
        ? state.dropped
        : Array.from(state.dropped)
      : [];
    var droppedSet = new Set(droppedArr.map(normalizeName));
    var excludedMap = new Map();
    if (state.excluded) {
      if (state.excluded instanceof Map) {
        state.excluded.forEach(function (v, k) {
          excludedMap.set(k, v);
          excludedMap.set(normalizeName(k), v);
        });
      } else {
        Object.keys(state.excluded).forEach(function (k) {
          excludedMap.set(k, state.excluded[k]);
          excludedMap.set(normalizeName(k), state.excluded[k]);
        });
      }
    }
    var refYear = state.compYear || new Date().getFullYear();
    var source = state.source || 'app';
    var globalSlugCount = new Map();

    function uniqueSlug(name) {
      var base = slugify(name);
      var n = globalSlugCount.get(base) || 0;
      globalSlugCount.set(base, n + 1);
      if (n === 0) return base;
      return base + '-' + (n + 1);
    }

    // Pre-assign stable slugs by first-seen name across all fleets
    var slugByNorm = new Map();
    regattas.forEach(function (reg) {
      (reg.sailors || []).forEach(function (row) {
        var norm = normalizeName(row.name);
        if (!norm || slugByNorm.has(norm)) return;
        slugByNorm.set(norm, uniqueSlug(row.name));
      });
    });

    var fleetsOut = {};
    var mergedSailors = new Map(); // norm -> sailor profile

    FLEET_IDS.forEach(function (fleetId) {
      var computed = computeFleetStandings(
        regattas,
        fleetId,
        droppedSet,
        excludedMap,
        refYear,
        state.metadata || {}
      );
      var list = computed.list;
      var windowRegs = computed.windowRegs;
      var squad = computed.squad;

      var sailors = list.map(function (s) {
        var norm = normalizeName(s.name);
        var id = slugByNorm.get(norm) || uniqueSlug(s.name);
        slugByNorm.set(norm, id);
        var results = windowRegs.map(function (reg, idx) {
          var place = s.ranks[idx];
          return {
            regattaId: slugify(reg.name) + '-' + (reg.date || ''),
            regattaName: reg.name,
            date: reg.date,
            place: place,
            nett: place,
            fleetSize: fleetSize(reg),
            scoredAs: s.filledScores[idx],
            didNotSail: place == null,
            fleet: fleetId,
          };
        });
        var trajectory = buildTrajectory(
          regattas,
          fleetId,
          droppedSet,
          excludedMap,
          norm,
          refYear,
          state.metadata || {}
        );
        return {
          id: id,
          slug: id,
          rankingKey: norm,
          name: s.name,
          gender: s.g,
          club: s.club || '',
          ageBand: ageBand(s.born, refYear),
          rank: s.rank,
          score: s.score,
          squad: squad.get(norm) || null,
          fleet: fleetId,
          results: results,
          trajectory: trajectory,
        };
      });

      var regattaPages = activeRegattasForFleet(regattas, fleetId).map(function (reg) {
        var fs = fleetSize(reg);
        var id = slugify(reg.name) + '-' + (reg.date || '');
        var results = (reg.sailors || [])
          .map(function (row) {
            var slug = slugByNorm.get(normalizeName(row.name)) || null;
            return {
              name: row.name,
              place: row.rank != null ? Number(row.rank) : null,
              nett: row.nett != null ? Number(row.nett) : row.rank != null ? Number(row.rank) : null,
              club: row.club || '',
              gender: row.g || null,
              sailorSlug: slug,
            };
          })
          .sort(function (a, b) {
            return (a.place != null ? a.place : 9999) - (b.place != null ? b.place : 9999);
          });
        return {
          id: id,
          slug: id,
          name: reg.name,
          date: reg.date,
          fleetSize: fs,
          fleet: fleetId,
          country: COUNTRY,
          classSlug: CLASS_SLUG,
          results: results,
        };
      });

      var clubMap = new Map();
      sailors.forEach(function (s) {
        var c = s.club || 'Unknown';
        if (!clubMap.has(c)) clubMap.set(c, []);
        clubMap.get(c).push({
          slug: s.slug,
          name: s.name,
          rank: s.rank,
          score: s.score,
          squad: s.squad,
          ageBand: s.ageBand,
        });
      });
      var clubs = Array.from(clubMap.entries())
        .map(function (entry) {
          return {
            id: slugify(entry[0]),
            slug: slugify(entry[0]),
            name: entry[0],
            country: COUNTRY,
            classSlug: CLASS_SLUG,
            fleet: fleetId,
            members: entry[1].sort(function (a, b) { return a.rank - b.rank; }),
          };
        })
        .sort(function (a, b) { return b.members.length - a.members.length; });

      fleetsOut[fleetId] = {
        id: fleetId,
        label: FLEET_LABELS[fleetId] || fleetId,
        standings: sailors.map(function (s) {
          return {
            rank: s.rank,
            slug: s.slug,
            name: s.name,
            club: s.club,
            score: s.score,
            squad: s.squad,
            ageBand: s.ageBand,
            gender: s.gender,
            fleet: fleetId,
          };
        }),
        sailors: sailors,
        regattas: regattaPages,
        clubs: clubs,
      };

      // Merge into global sailor profiles
      sailors.forEach(function (s) {
        var norm = s.rankingKey;
        if (!mergedSailors.has(norm)) {
          mergedSailors.set(norm, {
            id: s.slug,
            slug: s.slug,
            rankingKey: norm,
            name: s.name,
            gender: s.gender,
            club: s.club,
            ageBand: s.ageBand,
            fleets: {},
            chapters: [],
          });
        }
        var m = mergedSailors.get(norm);
        if (s.club && !m.club) m.club = s.club;
        if (s.gender && !m.gender) m.gender = s.gender;
        if (s.ageBand && !m.ageBand) m.ageBand = s.ageBand;
        m.fleets[fleetId] = {
          rank: s.rank,
          score: s.score,
          squad: s.squad,
          results: s.results,
          trajectory: s.trajectory,
        };
        m.chapters.push({
          country: COUNTRY,
          classSlug: CLASS_SLUG,
          fleet: fleetId,
          label: 'Optimist · Singapore · ' + (FLEET_LABELS[fleetId] || fleetId),
        });
      });
    });

    // Convenience: gold standings at top level for older clients
    var gold = fleetsOut.gold || { standings: [], sailors: [], regattas: [], clubs: [] };

    return {
      meta: {
        version: 2,
        exportedAt: new Date().toISOString(),
        country: COUNTRY,
        classSlug: CLASS_SLUG,
        classLabel: 'Optimist',
        countryLabel: 'Singapore',
        rankingWindow: WINDOW,
        bestOf: BEST_N,
        source: source,
        fleets: FLEET_IDS.slice(),
        note:
          'Multi-fleet snapshot. Gold and Silver series are ranked separately. Membership is per half-year period (Jan–Jun / Jul–Dec). Birth years excluded from public payload.',
        membershipPeriod: currentFleetPeriodKey(refYear),
      },
      fleets: fleetsOut,
      // Flat aliases (default gold) for simpler pages / backward compat
      standings: gold.standings,
      sailors: Array.from(mergedSailors.values()),
      regattas: gold.regattas,
      clubs: gold.clubs,
    };
  }

  root.buildSailorpathSnapshot = buildSailorpathSnapshot;
  root.getRegattaFleet = getRegattaFleet;
  root.SAILORPATH_FLEETS = FLEET_IDS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
