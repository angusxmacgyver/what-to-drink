# What To Drink

A laptop-first web app for a personal whisky cellar. Guests can browse what is still in stock and ask for a pour. The owner can import a workbook, add or edit bottles, and send finished ones to the Graveyard.

Scotch Malt Whisky Society bottles live in the same cellar as everything else. The SMWS tab in Excel is only a capture format. After import they show up in The Library and in Pick a Dram like any other bottle.

## The three screens

**The Library** is the book of every bottle that is still available. Search and filters apply here. Bottles of the same expression are grouped, with a stock count (five Ardbeg Cask Strength 10s appear as one row, ×5). Open a row to see the full record: notes, tasting notes, flavor families, sub-characteristics, location, and Society extras when they exist.

**Pick a Dram** is a randomizer, not a second list. You say whether you are at the house or the apartment, optionally narrow the pool, then pour one. The default pool is open bottles at that place. You can include closed bottles. Chance is per physical bottle, so a stock of five is five tickets. The result names the bottle and where it sits. Graveyard bottles never come up. If nothing is tagged for the apartment, the app says so instead of rolling the house by accident.

**Graveyard** is killed bottles only. Browse-only. They are not in The Library and not in the randomizer.

Owner tools (PIN-gated) cover workbook import, adding a bottle, editing, marking a bottle open, and killing it into the Graveyard.

## Filters

The Library and Pick a Dram share the same filter bar.

You can search distillery, expression, or Society code. Distillery, theme, country, region, flavor families, and sub-characteristics are multi-select. Distillery is a type-to-search box that shows how many bottles each producer has. Sub-characteristics appear once you pick a flavor family, and only list the ones found on bottles with every family you picked. Age and ABV are range sliders. NAS sits at the left of the age slider: leave the min thumb there to include NAS bottles, or park both thumbs on NAS for NAS only. A filter only applies once you set it. Untagged bottles still appear when that filter is idle.

The Library also has a Status filter (Open, Closed). It applies only to The Library; Pick a Dram keeps its own include-closed switch.

Pick a Dram also has the place question, include-closed, and country/region.

## Data

The catalog is JSON in this repo (`data/bottles.json`). Each physical bottle has its own id. Expressions group by a `bottleKey` (distillery plus bottling, or Society full code plus US name). Country is derived from region for filters. Apartment vs house comes from an apartment flag or location; with an empty apartment sheet, the live cellar is the house.

Importing a workbook replaces the catalog and keeps one backup (`data/bottles.backup.json`). Git history is the longer record. Owner edits in the browser also save to local storage. They try to write a remote catalog API when a database is bound; that is not live yet.

The Excel sheets that ingest are Open Bottles, Closed Bottles, SMWS, Fallen soldiers (Graveyard), and Apartment (mapper ready, currently empty). Draft Participants is contacts and is skipped.

Flavor families and sub-characteristics in the sheet are pipe-delimited (` | `).

## Run it

```bash
npm install
npm run dev
```

The owner PIN is `VITE_OWNER_PIN` (see `.env.example`). The local default is `cellar`. That value is compiled into the client, so it is a speed bump rather than real authentication.

To rebuild the JSON from an Excel export:

```bash
npm run ingest
```

You can also upload xlsx or csv in the owner screen.

## What's been built, and the decisions behind it

The first version of the app. The roadmap below starts again at 1.

**Scaffold.** React 19, TypeScript, Vite. The app is a single-page site. Product copy lives in this README; the agent brief is PROJECT.md.

**Ingest.** Excel is the capture format, not the runtime. Open, Closed, and SMWS map into one canonical bottle shape. Fallen soldiers become Graveyard. Draft Participants (contacts) is skipped and never copied into git. Flavor families and sub-characteristics split on ` | `. Each physical bottle gets a UUID. Expressions group with a `bottleKey` (distillery plus bottling, or Society full code plus US name).

**The Library.** Named “The Library” rather than Collection. Live bottles only, grouped by expression, with a stock badge. Society bottles are in this list. Killed bottles are not.

**Search, filters, detail.** Expanding row, not a new page. Search hits identity only: distillery, expression, Society code, and international name. Notes and tasting notes are not searched. Filters start unset so untagged bottles still appear. Distillery, theme, country, and region are multi-select (any of the picks). Flavor families and sub-characteristics are also multi-select, but a bottle must have every selected tag. Age and ABV are dual-thumb sliders, not min/max fields. NAS is the left stop on age: include it with the min thumb, or pin both thumbs for NAS only. Flavor families and sub-characteristics show as chips on the list row, not only in the expanded dump. Notes and tasting notes are featured cards in the detail.

**Graveyard.** Its own screen. Same fields as a live bottle, plus date finished. Not in Library or Dram.

**Pick a Dram.** House or apartment first. Default pool is open bottles at that place. Include-closed is a control, not the default. Random among physical bottles, so stock of five is five chances. Result leads with the bottle, then “Bottle is at:” and the location (blank allowed). Flavor chips appear on the result. Society bottles can be poured. Graveyard cannot. Empty apartment inventory has an explicit empty state.

**Dram filters.** Same shared bar as The Library, plus country (derived from region) and region. Country is stored as derived; region stays as authored.

**Replace import.** A new ingest replaces the catalog after copying the previous file to one backup. The UI shows when it was last imported. Git history is the longer backup.

**Import UI.** Owner can upload xlsx or csv in the app. Open/Closed headers are the default map; SMWS mapping is built into ingest. No CLI required for a refresh on that machine.

**Owner edit.** PIN-gated add (sparse fields allowed), edit, mark open, kill to Graveyard. The PIN is `VITE_OWNER_PIN` (local default `cellar`) and is compiled into the client. Edits save to the browser and try a remote catalog API when a database exists.

**Filter redesign and theme.** Chips replace dropdowns for theme, country, region, and flavor. Distillery is a typeahead with bottle counts. Sub-characteristics are scoped to the picked flavor families. A light/dark toggle in the header remembers your choice.

Decisions that cut across milestones: guests get Library, Dram, and Graveyard; owner gets ingest and edit. Until a database is bound, git JSON is the durable catalog and laptop edits can sit only in that browser. Hosting and data stay on Cloudflare: Pages now, D1 later.

## Stack and what’s next

React 19, TypeScript, and Vite. Static app for now.

Roadmap:

1. Land the filter and theme work. Done.
2. Test setup with `vitest` for the library helpers.
3. Host on Cloudflare Pages so the cellar has a public URL and does not depend on `npm run dev`.
4. Analytics screen: statistics and views over the ingested cellar.
5. Color-coded flavor families, with sub-characteristics taking their family's color.
6. Remote editing (deferred): move the catalog into Cloudflare D1 so an owner edit is visible to a guest without a git push, with real owner login.

```bash
npm run build
npx wrangler pages deploy dist --project-name=what-to-drink
```

When the app should be the source of truth:

```bash
npx wrangler d1 create what-to-drink
npx wrangler d1 execute what-to-drink --file=./schema.sql
```

Then bind `database_id` in `wrangler.toml` and redeploy.

The agent-facing brief, including schema mapping and milestone “done when” checks, is in [PROJECT.md](PROJECT.md).
