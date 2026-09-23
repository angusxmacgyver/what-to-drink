# What To Drink

Laptop-first cellar app. See [PROJECT.md](PROJECT.md) for the full brief.

```bash
export PATH="/tmp/node-v22.22.1-darwin-arm64/bin:$PATH"  # if Node is not on PATH
npm install
npm run ingest   # from the Sept 22 workbook
npm run dev
```

Owner PIN defaults to `cellar` (`.env`).

Cloudflare Pages: `npm run build` then `npx wrangler pages deploy dist --project-name=what-to-drink`. Bind D1 from `schema.sql` when the app should be source of truth.
