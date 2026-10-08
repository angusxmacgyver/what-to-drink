# What To Drink

A laptop-first web app for a personal whisky cellar. Guests can browse what is still in stock, look at the cellar as a whole, and ask for a pour. The owner can import a workbook, add or edit bottles, and send finished ones to the Graveyard.

Scotch Malt Whisky Society bottles live in the same cellar as everything else. The SMWS tab in Excel is only a capture format. After import they show up in The Library and in Pick a Dram like any other bottle.

Live at https://what-to-drink.max-krueger.workers.dev/. A push to `main` deploys.

## The screens

**The Library** is the book of every bottle that is still available. Search and filters apply here. Bottles of the same expression are grouped, in distillery then expression order, with a stock count (five Ardbeg Cask Strength 10s appear as one row, ×5). The panel header toggles a list and a grid. List is the default. The choice is remembered on this device, the same way the theme is.

A list row shows distillery, expression, age, ABV, theme, stock, and flavor tags. A card shows the distillery on one line and the expression on at most two, then an ellipsis, plus region and country (once, when they are the same), flavor-family swatches, age, ABV, and ×N when stock is more than one. Society and distillery codes stay off the card. The full name stays in the hover text, the accessible name, and the detail.

Selecting a row or a card opens one detail under that row. Later cards move down. Selecting it again, or Escape, closes it. The detail uses one field block for the expression: the first bottle whose status is Open, or the first bottle if none are Open. When there is more than one physical bottle, each extra line is status and location only, with Mark open, Edit, and Kill on that line.

**Pick a Dram** is a randomizer, not a second list. You say whether you are at the house or the apartment, optionally narrow the pool, then pour one. The default pool is open bottles at that place. You can include closed bottles. Chance is per physical bottle, so a stock of five is five tickets. The result names the bottle and where it sits. Graveyard bottles never come up. If nothing is tagged for the apartment, the app says so instead of rolling the house by accident.

**Graveyard** is killed bottles only. Browse-only. They are not in The Library and not in the randomizer.

**Analytics** is a picture of the cellar, counted by physical bottle: headline numbers, open vs closed, where it's from, top producers, age and ABV, how much of it is smoky, a flavor fingerprint that lays the open bottles over the whole cellar, and a palate cloud of sub-characteristics grouped by flavor family. Each graphic has a one-line takeaway worked out from the numbers. It updates with every import or edit and never changes bottles.

Owner tools are behind the lock glyph next to the theme switch. A correct PIN opens Bottle Management for the rest of the browser tab: workbook replace-import, merge-import, adding a bottle, editing, marking a bottle open, and killing it into the Graveyard. Kill, a merge-import, a full replace, and overwriting a bottle's details each ask for confirmation. Adding a bottle and marking one open stay a single click.

## Filters

The Library and Pick a Dram share the same filter bar.

You can search distillery, expression, or Society code. Distillery, theme, country, region, flavor families, and sub-characteristics are multi-select. Distillery is a type-to-search box that shows how many bottles each producer has. Flavor families and sub-characteristics are color-coded. Sub-characteristics appear once you pick a flavor family, and only list the ones that family owns, on bottles that have every family you picked. A filter only applies once you set it. Untagged bottles still appear when that filter is idle.

Age and ABV are range histograms, not sliders. Each one is a bar chart of the cellar, a brush you can drag, and From and To fields that stay in step with the brush. Values snap to whole years or whole percents. NAS is a toggle beside the Age From and To fields, on by default. It is not a stop on the age axis. Blank ages count as NAS. A blank ABV stays in the results.

The Library also has a Status filter (Open, Closed). It applies only to The Library; Pick a Dram keeps its own include-closed switch.

Pick a Dram also has the place question, include-closed, and country/region. Country and region are not on The Library bar.

## Data

The catalog lives in Cloudflare D1, one row per bottle, served by a small Worker API. `data/bottles.json` in this repo is the seed and the offline fallback. Each physical bottle has its own id. Expressions group by a `bottleKey` (distillery plus bottling, or Society full code plus US name). Country is derived from region for filters. Apartment vs house comes from an apartment flag or location; with an empty apartment sheet, the live cellar is the house.

Owner edits, merge-imports, and replace-imports write to D1, so a guest sees them on the next load with no git push. Each edit writes only the bottle it changes. The CLI ingest still writes `data/bottles.json` and keeps one backup (`data/bottles.backup.json`); loading that file into D1 is a separate seed step (see below).

The Excel sheets that ingest are Open Bottles, Closed Bottles, SMWS, Fallen soldiers (Graveyard), and Apartment (mapper ready, currently empty). On the Society sheet the expression is Name (Bottling). Written Notes are kept when that cell is filled; otherwise notes stay SMWS Cask plus Secondary Maturation. Draft Participants is contacts and is skipped.

Flavor families and sub-characteristics in the sheet are pipe-delimited (` | `).

## Run it

```bash
npm install
npm run dev
```

`npm run dev` has no API, so it shows the bundled catalog and owner edits fail. To run with the API, use `npm run build && npx wrangler dev` (a local D1 copy) or add `--remote` to work against the real database.

The owner PIN is the Worker secret `OWNER_PIN` (see `.dev.vars.example`). The local default is `cellar`. It is not compiled into the client. The browser keeps an accepted PIN in `sessionStorage` for the tab and sends it as `X-Owner-Pin`. Copy `.dev.vars.example` to `.dev.vars` for `wrangler dev`. Production needs `npx wrangler secret put OWNER_PIN`, or owner requests are rejected.

Tests:

```bash
npm test
```

To rebuild the JSON from an Excel export:

```bash
npm run ingest
```

You can also upload xlsx or csv in Bottle Management. A replace-import overwrites the cellar. A merge-import adds rows and previews matches against existing expressions before anything is written.

To load `data/bottles.json` into D1 (this replaces every bottle in the database):

```bash
npm run seed:sql
npx wrangler d1 execute what-to-drink --remote --file=./data/seed.sql
```

## What's been built, and the decisions behind it

The first version of the app. The roadmap below starts again at 1.

**Scaffold.** React 19, TypeScript, Vite. The app is a single-page site. Product copy lives in this README; the agent brief is PROJECT.md.

**Ingest.** Excel is the capture format, not the runtime. Open, Closed, and SMWS map into one canonical bottle shape. Fallen soldiers become Graveyard. Draft Participants (contacts) is skipped and never copied into git. Flavor families and sub-characteristics split on ` | `. Each physical bottle gets a UUID. Expressions group with a `bottleKey` (distillery plus bottling, or Society full code plus US name).

**The Library.** Named "The Library" rather than Collection. Live bottles only, grouped by expression, with a stock badge. Society bottles are in this list. Killed bottles are not. List and grid share that grouping. The grid does not have its own sort.

**Search, filters, detail.** Expanding row, not a new page. The same detail opens under a grid card. Search hits identity only: distillery, expression, Society code, and international name. Notes and tasting notes are not searched. Filters start unset so untagged bottles still appear. Distillery, theme, country, and region are multi-select (any of the picks). Flavor families and sub-characteristics are also multi-select, but a bottle must have every selected tag. Age and ABV are range histograms with From and To fields. NAS is a toggle beside those fields, on by default, not a point on the age axis. Flavor families and sub-characteristics show as chips on the list row, not only in the expanded dump. Notes and tasting notes are featured cards in the detail.

**Graveyard.** Its own screen. Same fields as a live bottle, plus date finished. Not in Library or Dram.

**Pick a Dram.** House or apartment first. Default pool is open bottles at that place. Include-closed is a control, not the default. Random among physical bottles, so stock of five is five chances. Result leads with the bottle, then "Bottle is at:" and the location (blank allowed). Flavor chips appear on the result. Society bottles can be poured. Graveyard cannot. Empty apartment inventory has an explicit empty state.

**Dram filters.** Same shared bar as The Library, plus country (derived from region) and region. Country is stored as derived; region stays as authored.

**Replace import.** A new ingest replaces the catalog after copying the previous file to one backup. The UI shows when it was last imported. Git history is the longer backup.

**Import UI.** Owner can upload xlsx or csv in the app. Open/Closed headers are the default map; SMWS mapping is built into ingest. No CLI required for a refresh on that machine. Merge-import is the additive path: preview first, then insert new stock or skip each row that matches an existing expression.

**Owner edit.** The lock glyph asks for `OWNER_PIN` (local default `cellar`). The Worker checks it on each owner request. Edits write to D1. The browser also keeps a local copy so the app can show something before the catalog loads, and so a rejected write stays on that device.

**Filter redesign and theme.** Chips replace dropdowns for theme, country, region, and flavor. Distillery is a typeahead with bottle counts. Sub-characteristics are scoped to the picked flavor families. A light/dark toggle in the header remembers your choice. Each flavor family has its own accent, and a sub-characteristic takes the color of the family it belongs to.

Decisions that cut across milestones: guests get Library, Dram, Graveyard, and Analytics; owner gets ingest and edit. Hosting and data stay on Cloudflare: Workers static assets for the app, D1 for the catalog.

## Stack and what's next

React 19, TypeScript, and Vite, plus a Cloudflare Worker (`worker/index.ts`) over D1.

Roadmap:

1. Land the filter and theme work. Done.
2. Test setup with `vitest` for the library helpers. Done.
3. Host on Cloudflare so the cellar has a public URL and does not depend on `npm run dev`. Done: https://what-to-drink.max-krueger.workers.dev/, redeployed on every push to `main`.
4. Analytics screen: statistics and views over the ingested cellar. Done.
5. Color-coded flavor families, with sub-characteristics taking their family's color. Done.
6. Remote editing: the catalog is in Cloudflare D1, so an owner edit is visible to a guest without a git push, and owner routes check `OWNER_PIN`. Storage, merge-import, the server PIN check, the header lock glyph, and the confirm steps are done. Paused before export and backups.

### Still to do

Finish Milestone 6. Both pieces are owner-gated, same PIN as the other owner routes.

- **Export database.** A manual action that reads the live catalog from D1, in the same spirit as today's Download bottles.json.
- **Backups.** A weekly Cloudflare Worker cron, and the same write when someone exports by hand. Each run stores a timestamped snapshot in Cloudflare R2. Keep the last 10 and drop the oldest on write. R2 is the store because a scheduled commit to `main` would redeploy the app for no code change.

### Next

Not scheduled. The range histograms are already in the filter bar, so they are not in this list.

- **Pick a Dram refactor.** Filters move into a drawer. Options become grids that show a live count and stay selectable even at zero. Results become a card grid, with the poured bottle marked separately from the card you are reading. Theme stays a normal facet. The full requirement, including its open questions, is in [PROJECT.md](PROJECT.md).
- **Pour tracking.** After remote editing, so a pour is shared across devices. Owner-only actions use the same lock glyph. A last-third flag, a Just poured button on The Library and on the Pick a Dram result, and a rotating list of the last 25 pours.
- **Apartment inventory.** The Apartment sheet mapper exists. The sheet is empty, so Pick a Dram at the apartment has nothing to roll.
- **Sheet hygiene.** Theme spelling, SMWS location, and status case. Fix those in Excel. The next import picks them up.
- **Quick Pours.** Named starting points, such as Heavily Peated or Sweet & Mellow, applied as presets you can then change. Not part of the Pick a Dram refactor.
- **Origin imagery.** A picture of each bottle's region of Scotland, or its country.
- **Analytics.** A flavor-by-region heatmap, a click from a bar through to a filtered Library, and Graveyard trends were left out of the first Analytics screen. Broader ideas are still open.
- **Whisky Draft.** Not scoped. If it uses the workbook's Draft Participants sheet, decide what happens to contact data first. That sheet is skipped today and stays out of the app and git.

The agent-facing brief, including schema mapping and milestone "done when" checks, is in [PROJECT.md](PROJECT.md).
