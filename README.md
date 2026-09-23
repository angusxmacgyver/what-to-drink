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

You can search distillery, expression, or Society code. Distillery, theme, country, region, flavor families, and sub-characteristics are multi-select. Age and ABV are range sliders. NAS sits at the left of the age slider: leave the min thumb there to include NAS bottles, or park both thumbs on NAS for NAS only. A filter only applies once you set it. Untagged bottles still appear when that filter is idle.

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

## Stack and what’s next

React 19, TypeScript, and Vite. Static app for now.

Milestones 1 through 8, 10, and 11 are in the app: ingest, Library, Dram, Graveyard, in-app import, and owner add/edit/kill.

Still open:

- **9.** Host on Cloudflare Pages so the cellar has a public URL and does not depend on `npm run dev`.
- **12.** Move the catalog into Cloudflare D1 so an owner edit is visible to a guest without a git push.

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
