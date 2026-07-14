# SailorPath (in this monorepo)

Public sailor career site + Singapore Optimist discovery pages. The ranking SPA is synced into the Next app at build time and served under `/ranking-app/`.

## URLs

| Path | Purpose |
|------|---------|
| `/` | SailorPath home |
| `/demo` | **Sample claimed profile** (full feature mock) |
| `/s/{slug}` | Live sailor profile from official snapshot |
| `/sg/optimist` | Series standings table |
| `/sg/optimist/rankings` | Ranking tool (iframe + links to `/ranking-app/`) |
| `/ranking-app/` | Same-origin ranking SPA (Firebase editor) |
| `/sg/optimist/regattas` | Regatta list + detail |
| `/sg/optimist/clubs` | Club rosters |
| `/privacy` | Privacy notes |

Future vanity: `sailorpath.com/{username}` after claim.

## Why fleet size can disagree with the ranking tool

| Source | Used by | Fleet size |
|--------|---------|------------|
| **Firestore** (live) | `github.io/Ranking` and `/ranking-app/` | Editor-set **DNS / fleet** (e.g. 90) |
| **Seed JSON** in `js/seed.js` | SailorPath snapshot today | Count of rows if `dns` missing (e.g. 100) |

Until SailorPath builds its snapshot from a **live export** of Firestore, public regatta pages can show a different fleet size than the editor tool.

## Local dev

```bash
cd web
npm install
npm run dev
```

## Deploy (Vercel)

- Root Directory: `web`
- Domain: `sailorpath.com`
- Build: `npm run build` (runs snapshot + sync ranking SPA)

## Implementation roadmap

### Done (Phase 1 foundation)
- Next.js SailorPath UI
- Snapshot profiles, standings, regattas, clubs
- Trajectory chart
- Ranking SPA hosted under SailorPath (`/ranking-app/`)
- Sample `/demo` profile for product vision

### Phase 1b — Data integrity
1. **Export live snapshot from Firestore** on ranking save (or nightly)
2. Include `dns` / fleet size and locked squads in export
3. Stable `sailor_id` (not name-only)
4. Silver fleet + silver regattas in ranking data

### Phase 2 — Claim
1. Supabase Auth (magic link) + guardian checkbox
2. Parent multi-sailor dashboard
3. Claim flow + admin approve
4. Vanity username → `sailorpath.com/mikaela`
5. Bio, avatar, goals (user-editable)

### Phase 3 — Enrichment
1. Self-reported overseas results (badged)
2. Photos / certificates (privacy controls)
3. Auto milestones
4. Training log + upcoming races (mostly private)
5. PDF / share card

### Phase 4 — Expand
1. Second class (`/sg/ilca4/...`)
2. Optional other countries (`/my/...`)
3. Optional H2H (careful for youth sport)
