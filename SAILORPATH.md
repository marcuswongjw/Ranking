# SailorPath (in this monorepo)

Public sailor career site + Singapore Optimist discovery pages, with the existing ranking SPA linked under the SailorPath URL scheme.

## URLs

| Path | Purpose |
|------|---------|
| `/` | SailorPath home |
| `/s/{slug}` | Sailor profile (trajectory, race history, PBs) |
| `/sg/optimist` | Series standings table |
| `/sg/optimist/rankings` | Embed / link to live ranking tool |
| `/sg/optimist/regattas` | Regatta list + detail |
| `/sg/optimist/clubs` | Club rosters |
| `/privacy` | Privacy notes |

Future: `sailorpath.com/{username}` after claim; `/sg/ilca4/...` for more classes.

## Local dev

```bash
cd web
npm install
npm run dev
```

Opens Next.js on port 3000. Snapshot is built from `js/seed.js` via `scripts/build-snapshot.mjs`.

## Deploy SailorPath → sailorpath.com (Vercel)

1. Import GitHub repo `marcuswongjw/Ranking` in Vercel.
2. **Root Directory:** `web`
3. **Domain:** add `sailorpath.com` (and `www`) in Vercel.
4. Optional env: `NEXT_PUBLIC_RANKING_SPA_URL` (defaults to `https://marcuswongjw.github.io/Ranking/`).

Build runs `prebuild` → snapshot → `next build`.

## Ranking SPA (unchanged)

- Still deploys to **GitHub Pages** from repo root (`index.html`, `css/`, `js/`).
- Editor + Firestore remain the source of truth for live rankings.
- SailorPath currently uses **seed snapshot** until a live export job is wired from Firestore.

## Next phases

1. Export live snapshot from Firestore on ranking save  
2. Supabase claim + magic link + username URLs  
3. Self-reported overseas results + media  
