# BatchRender Website

Static HTML website for [batchrender.com](https://batchrender.com)

## Structure

- `index.html` — main landing page
- `js/main.js` — translations (EN/RU/ZH) and interactive features  
- `img/logo.png` — BatchRender logo
- `pages/` — additional pages (admin, docs, checkout, etc.)
- `terms.html`, `privacy.html`, `refund.html`, `eula.html` — legal pages

## Deployment

Deploys automatically to Vercel on push to `main` branch.

## Localization

All text content is in `js/main.js` under the `T` object:
- `T.en` — English
- `T.ru` — Russian 
- `T.zh` — Chinese

## Admin Panel

Decap CMS admin panel at `/admin` for content editing without touching code.
