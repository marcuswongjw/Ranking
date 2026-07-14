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
