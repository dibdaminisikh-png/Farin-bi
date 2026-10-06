# Farin BI — پیش‌نمایش هوش تجاری فرین روشان طب

Persian RTL static dashboard. **All orders, clinics, opportunities and financial figures are fictional.** No patient information or actual company performance is represented.

Live site: https://dibdaminisikh-png.github.io/Farin-bi/

## Deployment and local preview

GitHub Pages publishes `main`, `/` (existing settings preserved). Lowercase `index.html`, relative assets and hash navigation support `/Farin-bi/`. No build step or runtime dependencies.

Serve this directory with any static HTTP server; ES modules require HTTP. For example: `python -m http.server 8000 --bind 127.0.0.1 --directory .`.

## Structure

- `index.html`: accessible shell and representative static fallback when JavaScript is unavailable.
- `assets/dashboard.css`: existing neumorphic design, responsive RTL layouts, fixed Vazirmatn typography.
- `assets/app.js`: views, filters, search, dialogs and CSV downloads.
- `assets/demo-data.js`: deterministic, explicitly fictional fixtures; integer financial values in **millions of tomans**.
- `assets/metrics.js`: shared selection and aggregation logic. All period/service filters use dated records. The comparison is the corresponding period in 1404. Revenue is order value, not accounting revenue recognition. Active centers mean distinct centers with selected orders. Conversion is won / (won + lost). Open opportunity value excludes won/lost. Displayed service shares use largest-remainder rounding to sum to exactly 100%.
- `assets/data-adapter.js`: asynchronous demo source and disconnected report provider, separate from UI.

Customer search narrows the orders table and its export; KPIs remain period/service summaries. CSV includes Persian numerals, explicit units, a fictional-data notice, escaped cells and a UTF-8 BOM. Pipeline shows its own opportunities list; order export is hidden there.

## Future authenticated integrations

Replace `demoAdapter.load()` with an adapter calling an authenticated backend that returns the same validated contract. Implement authorization and access control on that backend; do not put CRM credentials or secrets in this public repository. Report provider currently returns `connected: false` and the UI honestly displays that state. Private Power BI reports require authenticated embedding, a backend issuing short-lived access and the official embedding SDK. Do not put access tokens in static files or use Publish to web for private business data. No integration is currently connected.

## Brand and font sources

Official logo preserved unmodified from https://farinroshaan.com/wp-content/uploads/2021/09/logo.svg. Company service categories reviewed at https://farinroshaan.com/ . Locally hosted variable Vazirmatn from https://github.com/rastikerdar/vazirmatn (SIL Open Font License included at `assets/fonts/OFL.txt`). Headings 700; KPI values 800; navigation, controls and labels 500; body and table values 400.

## Verification

`npm test` runs data consistency tests with Node's built-in test runner. No installation required.

Chromium testing covered `/Farin-bi/` asset/font loading, all five routes, period/service filters, customer search including no results, dialogs and Escape/focus restoration, downloaded CSV contents, disabled-JavaScript fallback and no document overflow at 1440×1000, 768×1024, 390×844 and 320×700. Desktop and iPhone screenshots were inspected. Tables intentionally scroll inside their own containers. Production integrations require a separate authenticated backend and are not implemented in this prototype.

## Payam Gostar backend API

A separate, protected read API is now implemented in `server/`. It uses the company's documented SOAP service shapes for organizations, sale invoices and opportunities. See [Persian setup and API documentation](docs/payamgostar-api.md) and `.env.example`. Run `npm ci --ignore-scripts`, configure server-only environment variables and start with `npm run start:api`. Node.js 22.9+ is required. The single XML parsing dependency belongs to the backend; GitHub Pages needs no build step.

**The backend is not deployed or connected to real CRM data.** GitHub Pages continues to show the tested fictional demo. The API currently supports trusted server clients via a private bearer token; browser user login must be implemented before connecting the public dashboard to private data. Never copy the backend token into frontend assets. No credentials have been added to this repository. `npm test` now includes backend security, SOAP, normalization and HTTP tests using fictional fixtures.
