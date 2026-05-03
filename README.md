# batchrender-site

Marketing website for [BatchRender](https://batchrender.com) — local batch video processing for editors.

## Stack
- **Single-page HTML** — `index.html` contains all markup, inline CSS, inline JS, and inline `T = {en, ru, zh}` translations
- **Vercel** for hosting and CDN
- **Vercel Edge Function** (`api/release.js`) for fetching the latest BatchRender app version
- **LemonSqueezy** for checkout
- **Cloudflare Web Analytics** for stats

## Deployment
Push to `main` → Vercel auto-deploys in ~30 seconds.
PR branches get preview deployments at `batchrender-{hash}.vercel.app`.

## Editing content

The site translations are stored as a `const T = {...}` object inline in `index.html`.
Editing this directly is fragile — use the local site-editor tool instead:

```bash
~/Desktop/site-editor/start.sh
```

Open <http://localhost:8766>, pick a key from the tree (or use Pick mode to click
elements directly in preview), edit, Save, Publish. Publish does git commit + push.

The site-editor handles:
- Visual / HTML mode for rich text
- Cross-language editing (EN / RU / ZH tabs)
- Live preview with device toggle (Desktop / Tablet / Mobile)
- Schema parity validation between languages
- Backups before every save
- Undo / redo

## Files

| File | Purpose |
|------|---------|
| `index.html` | The whole site |
| `eula.html`, `privacy.html`, `terms.html`, `refund.html` | Legal pages, linked from footer |
| `api/release.js` | Vercel Edge Function — returns latest BatchRender release info from GitHub |
| `img/` | Logos |
| `sitemap.xml`, `robots.txt` | SEO |
| `vercel.json` | Vercel config (currently empty `rewrites: []`) |

## Local preview

```bash
python3 -m http.server 8001
```

Then open <http://localhost:8001>. Note: `/api/release` only works when deployed on Vercel.
