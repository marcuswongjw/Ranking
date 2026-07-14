# SailorPath + Gold / Silver fleets

## Phase 1b — live data

On every **editor save** in the ranking tool, the app writes:

`opRanking/sailorpathSnapshot` → `{ json: "<snapshot>", version, updatedAt }`

SailorPath (Vercel) loads that document via Firestore REST (revalidate ~60s). If missing, falls back to seed file.

**After deploying the ranking SPA**, open the tool, sign in, make any save (or re-save) so the snapshot document is created.

## Gold vs Silver

Two independent dimensions:

1. **Regatta series** — each event is Gold or Silver (scores stay in that series).  
2. **Sailor membership by period** — half-year keys on the sailor:
   - `fleetJan26` → Jan–Jun 2026  
   - `fleetJul26` → Jul–Dec 2026  

   So a sailor can be **Silver in H1 2026** and **Gold in H2 2026** (promotion).

| Concept | How it works |
|---------|----------------|
| **Period selector** | Sidebar **Period** (e.g. Jan–Jun 2026 / Jul–Dec 2026) |
| **Membership** | Per period; board only includes members of active fleet **for that period** |
| **Regatta.fleet** | Event is Gold or Silver (scores stay in that series) |
| **Squad columns** | **Gold only** — hidden on Silver board |
| **Move / assign** | → Gold / → Silver for the **selected period**; profile fleet dropdown same |
| **SailorPath** | `/sg/optimist/gold` · `/sg/optimist/silver` |

### Adding Silver (Excel uploads)

1. Deploy ranking SPA, **Sign in**, switch sidebar to **Silver**.
2. **Roster list** — Manage Fleet → **Upload roster Excel (active fleet)**  
   Columns: `Name | Gender | Born | Club | School`  
   Adds sailors to the latest Silver regatta (or creates “Silver Fleet Roster”).
3. **Regatta scores** — open a regatta → **Upload scores Excel**  
   Columns: `Name | Rank | Nett` (or Points)  
   Merges into **that** regatta only.
4. **Bulk multi-regatta sheet** — top bar **Load scores .xlsx** (consolidated OP-style sheet).  
   New regattas are tagged with the **active** Gold/Silver pill.
5. Save — SailorPath snapshot republishes automatically.

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
