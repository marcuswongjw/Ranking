# SailorPath + Gold / Silver fleets

## Phase 1b — live data

On every **editor save** in the ranking tool, the app writes:

`opRanking/sailorpathSnapshot` → `{ json: "<snapshot>", version, updatedAt }`

SailorPath (Vercel) loads that document via Firestore REST (revalidate ~60s). If missing, falls back to seed file.

**After deploying the ranking SPA**, open the tool, sign in, make any save (or re-save) so the snapshot document is created.

## Gold vs Silver

| Concept | How it works |
|---------|----------------|
| **Regatta.fleet** | `"gold"` or `"silver"` (default gold for legacy) |
| **Separate series** | Best 3 of last 5 **per fleet** — silver results never mix into gold rank |
| **Ranking tool UI** | Sidebar **Gold / Silver** pills switch the board |
| **Add regatta** | Choose **Fleet (series)** + optional populate sailors |
| **SailorPath URLs** | `/sg/optimist/gold`, `/sg/optimist/silver`, …/regattas, …/clubs |
| **Sailor profile** | One person page; sections for each fleet they sailed |

### Adding Silver soon

1. Deploy ranking SPA (GitHub Pages + SailorPath `/ranking-app/` sync).
2. Sign in → switch to **Silver** pill.
3. **Add regatta** → Fleet = Silver Fleet → enter results / fleet size (DNS).
4. Save — snapshot republishes; SailorPath Silver pages fill in within ~1 minute.

Optional: populate with fleet sailors checkbox seeds DNS rows for everyone currently known (same as Gold populate).

## URLs

| Path | Purpose |
|------|---------|
| `/sg/optimist` | Fleet hub |
| `/sg/optimist/gold` | Gold standings |
| `/sg/optimist/silver` | Silver standings |
| `/sg/optimist/{fleet}/regattas` | Fleet regattas |
| `/sg/optimist/rankings` | Live ranking tool embed |
| `/ranking-app/` | Ranking SPA (same origin) |
| `/s/{slug}` | Sailor profile (multi-fleet) |
| `/demo` | Sample claimed profile |

## Local

```bash
cd web && npm run dev
```
