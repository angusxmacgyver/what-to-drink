# What To Drink — project brief

**How to use this document.** Product and architecture context for the app. Work that is ready to build is a GitHub issue. Work that is named but not specified is under **Undeveloped**. Milestones 1–6 below are the record of what shipped.

**Current milestone:** 6 of 6 (Remote editing) is done through guest-visible edits. Issue #9 owns the catalog export. Other work that is not built, and not in GitHub, is under **Undeveloped**. Milestones 1–5 are done. The first version of the app is listed under **Done**.

**Side quest:** Fancy Picker Easter Egg is done.

**Living copy:** this file.

---

## Product

**What To Drink** is a laptop-first web app for a personal whisky cellar.

Two jobs:

1. **The Library** — the book of every bottle that is still available (not killed). Searchable and filterable. Grouped by expression with a stock count.
2. **Pick a Dram** — a randomizer for a pour. Optional filters, then one bottle and where to walk.

A third surface, **Graveyard**, holds killed bottles. It is browse-only. Those bottles are not in The Library and not in the randomizer.

Guests get The Library and Pick a Dram (and Graveyard and Analytics). Owner-only surfaces are ingest and add/edit.

The workbook tab named SMWS is only how Society bottles are captured in Excel. After ingest they are ordinary Library bottles and ordinary randomizer tickets. There is no SMWS-only screen or chip.

---

## How an agent should start

1. Read this file and note **Current milestone**.
2. If a repo exists at [`~/Projects/what-to-drink`](/Users/max.krueger/Projects/what-to-drink), work there. If this chat is still in the home workspace, call `move_agent_to_root` on that path **before** any file changes.
3. Match existing code style. Do not rebuild finished milestones.
4. Finish only the stated milestone unless the user expands scope.
5. When Done when is met, mark the todo complete and set **Current milestone** to N+1.

**Stack:** React 19 + TypeScript + Vite SPA, plus a small Worker API (`worker/index.ts`) over Cloudflare D1.

**Hosting (from Milestone 3):** Cloudflare Workers static assets, git-connected (Workers Builds). Pushes to `main` deploy to https://what-to-drink.max-krueger.workers.dev/. The catalog lives in D1 (from Milestone 6); `data/bottles.json` is the bundled offline fallback and the seed source.

**Owner PIN:** Worker secret `OWNER_PIN` (see `.dev.vars.example`; local default `cellar`). The browser sends it on each owner request and does not bundle it. The header lock glyph, next to the theme switch, asks for it.

---

## Source data

Ingest file (current snapshot): [`/Users/max.krueger/Library/CloudStorage/OneDrive-WarnerBros.Discovery/Desktop/Whisky Inventory- Oct 7 .xlsx`](/Users/max.krueger/Library/CloudStorage/OneDrive-WarnerBros.Discovery/Desktop/Whisky%20Inventory-%20Oct%207%20.xlsx)

Workbook sheets to read:

- **Open Bottles** — 190 rows (as of 7 Oct 2026)
- **Closed Bottles** — 173 rows
- **SMWS** — 176 rows (same cellar; different columns). The expression is in **Name (Bottling)**
- **Fallen soldiers** — 7 rows → Graveyard
- **Apartment** — empty; keep the mapper ready
- Skip **Draft Participants** (contacts). Do not copy that sheet into the app or git.

Flavor Families and Sub-Characteristics in the sheet use ` | ` as the delimiter.

CLI ingest: `npm run ingest` (optional path argument). Writes `data/bottles.json` after copying any previous file to `data/bottles.backup.json`. That file no longer reaches guests on its own; to load it into D1, run `npm run seed:sql && npx wrangler d1 execute what-to-drink --remote --file=./data/seed.sql` (this replaces every row). The in-app replace-import writes to D1 directly.

---

## Canonical bottle schema

Open Bottles and Closed Bottles define the fields shown on every surface:

- Distillery / Producer
- Bottling
- Age — number, `NAS`, or blank
- ABV % — number (parse `55.3` / `55.3%`)
- Status — `Open` | `Closed` | `empty` (normalize case on ingest; Graveyard uses `Killed`)
- Notes
- Tasting Notes
- Location
- Region
- Theme
- Flavor Families — string array
- Sub-Characteristics — string array

Store two identifiers on every live bottle:

- **`id`** — UUID per physical bottle
- **`bottleKey`** — expression identity for grouping stock
  - Non-SMWS: slug of Distillery/Producer + Bottling (example `ardbeg::cask-strength-10`)
  - SMWS: Full Code + US name (example `smws::1.246::a-one-like-no-other`)

JSON envelope:

- `schemaVersion` (start at `1`)
- `importedAt`
- `bottles` — live bottles (Library + randomizer pool)
- `graveyard` — killed bottles

On each replace-import: copy current `data/bottles.json` to `data/bottles.backup.json`, then write the new file. One backup copy only. Git history is the longer record.

### SMWS → schema (built into ingest)

- Distillery → Distillery / Producer
- Bottling (display) → **Name (Bottling)** on the current sheet, or **Full Code + Name (USA)** when that older column is present
- Age, ABV, Status, Location, Region, Theme, Flavor Families, Sub-Characteristics, Tasting Notes → same-named canonical fields
- Notes (placeholder) → `SMWS Cask` plus `Secondary Maturation`
- Keep on detail only: Full Code, Distillery No., Cask No., Flavor Profile, SMWS Cask, Secondary Maturation, Name (Intl), Vintage, SMWS URL
- `bottleKey` → Full Code + US name
- Blank Location still imports. Those bottles are in the **house** pool until Location (or an apartment flag) says otherwise. Pick a Dram may show an empty walk-to.

### Derived fields

- **`atApartment`** — from the Apartment sheet, or from a Location that contains "apartment". The bundled catalog tags 39 bottles that way. An empty Apartment sheet does not by itself put the whole cellar at the house.
- **Country** — derived from Region for filters (Scotland from Islay / Highland / Speyside / Island / Campbeltown / Lowland / Blended Scotch / Blended Malt; plus Japan, Ireland, Canada, USA from the obvious Region values). Store Region as authored; Country is derived.

---

## UX

Laptop-first, responsive web. Bottle detail stays in place (no new page). Expanding row on The Library; result card on Pick a Dram.

### The Library

Live bottles, grouped by `bottleKey`, in distillery then expression order. The panel header toggles a list and a grid. The list is the default, and the choice is remembered on this device the same way the theme is. Search and filters apply to both, and both use the same grouping.

The list row is distillery, expression, age, ABV, theme, and stock count. Five Ardbeg Cask Strength 10s render as one row `×5`. A card shows the distillery on one line and the expression on at most two, then an ellipsis. It also shows region and country (once, when they are the same), flavor-family swatches, age, ABV, and `×N` when stock is more than one. No Society or distillery code on the card. The full name stays in the hover text, the accessible name, and the detail.

Selecting a row or a card opens one detail under that row. Later cards move down. Selecting it again, or Escape, closes it. The detail shows one field block for the expression (the 12 canonical fields, plus SMWS extras when present): the first bottle whose status is Open, or the first bottle if none are Open, even when the others differ. When there is more than one physical bottle, each is listed as status and location only, with Mark open, Edit, and Kill on that line.

### Pick a Dram

A randomizer, not a second list. Flow: apartment or house → optional filters → one bottle.

- Default pool: **Open** bottles at that place
- Control to include Closed
- Random among **physical bottles** (`id`), so stock of 5 is five tickets
- Result: identity + Location (blank allowed)
- Pool is the full live cellar, including SMWS
- Graveyard is never in the pool
- Apartment with no tagged bottles: explicit empty state. The bundled catalog has tagged bottles, so that state stays hidden for this file.

### Graveyard

Separate view of killed bottles. Same 12 fields as available. Not in Library scroll. Not in the randomizer.

### Shared filters

Reusable components, used by The Library and Pick a Dram as they apply:

- Distillery / Producer — reached through text search; the separate distillery typeahead was removed
- Age range, snapped to whole years, with a NAS toggle beside From and To (on by default; blank ages count as NAS)
- ABV range, snapped to whole percents (a blank ABV stays in the results)
- Theme (multi)
- Flavor Families (multi)
- Sub-Characteristics (multi)
- Text search (The Library; Pick a Dram if it stays useful)

Pick a Dram also has:

- Apartment vs house
- Open default / include Closed
- Country (derived) and Region (multi)

A filter applies only when the user sets it. Bottles missing a tag still appear when that filter is unset.

Sub-characteristics depend on Flavor Families: the chips appear only after a family is picked, and list only the sub-characteristics owned by one of the picked families (`subOwnerFamily` in `src/lib/library.ts`), scoped to bottles that have every picked family. A sub with no curated owner yet stays visible regardless of the picked family, so a new ingest never silently hides it.

---

## Architecture

The catalog lives in Cloudflare D1, one row per bottle: `id`, `bottle_key`, `status` (`Killed` rows are the Graveyard), the full bottle as JSON in `data`, and `updated_at`. A `meta` table holds `importedAt`. The Worker answers `/api/*` ahead of the static assets (`run_worker_first` in `wrangler.toml`):

- `GET /api/catalog` — the whole catalog, in the same envelope as `bottles.json`
- `PUT /api/bottles/:id` — save one bottle (edit, add, mark Open, kill)
- `POST /api/bottles` — add bottles (merge-import)
- `PUT /api/catalog` — replace everything (replace-import)
- `POST /api/owner` — check the PIN and write nothing

Those four owner routes require the header `X-Owner-Pin` to match the `OWNER_PIN` secret. A missing secret rejects them. `GET /api/catalog` stays open.

Written for the Workers free plan: bulk writes insert 500 bottles per statement via `json_each` (D1 allows 50 queries per request), and reads join the stored JSON instead of parsing it (10 ms CPU per request). On load the app shows its `localStorage` copy (or the bundled `bottles.json`), then swaps in the D1 catalog and caches it. A write the server rejects stays on that device and shows a notice.

`npm run dev` (Vite alone) has no API, so the app falls back to the bundled catalog and owner writes fail. To work against the API, run `npm run build && npx wrangler dev` (local D1 under `.wrangler/`) or add `--remote` to use the production database.

**Layout:**

- `PROJECT.md` — this brief
- `data/bottles.json` — bundled fallback and seed source
- `data/bottles.backup.json`
- `scripts/ingest.ts` — workbook → JSON
- `scripts/seed-sql.ts` — `bottles.json` → `data/seed.sql` (gitignored) for `wrangler d1 execute`
- `src/` — React app; `src/lib/rows.ts` converts bottles to and from D1 rows
- `worker/index.ts` — the Worker API
- `schema.sql` — D1 schema

---

## Done

The first version of the app, built before the roadmap was renumbered:

- **Scaffold.** Vite + React + TypeScript, `PROJECT.md`, git at `~/Projects/what-to-drink`.
- **Ingest.** xlsx → canonical bottles from Open, Closed, and SMWS. Fallen soldiers → `graveyard`. Draft Participants skipped. Ardbeg Cask Strength 10 `bottleKey` count is 5; graveyard length is 5.
- **The Library.** Grouped list with stock badge, shared filter bar, text search, expanding row with the 12 fields (SMWS extras on Society rows).
- **Graveyard.** Separate view for `graveyard`. Lagavulin 16 appears only here.
- **Pick a Dram.** Place question, Open default, include-Closed, shared filters plus derived Country. Never rolls a graveyard bottle; empty apartment has an explicit empty state.
- **Replace import and backup.** Replace JSON after writing `bottles.backup.json`. Shows `importedAt`.
- **Import UI.** In-app upload of xlsx/csv. Open/Closed headers are the default map; SMWS mapping is built in.
- **Owner edit.** PIN-gated add (sparse fields allowed), edit, mark Open, kill → Graveyard.
- **Filter redesign and theme.** Chip filters, a distillery typeahead with counts, sub-characteristics scoped to the picked flavor families, and a light/dark toggle.

---

## Milestones (6)

### Milestone 1 — Land the filter and theme work

Commit the docs, the filter redesign, and the light/dark theme as separate commits.

**Done when:** the working tree is clean and this file uses the new numbering.

### Milestone 2 — Test setup

`vitest` with a `npm test` script. Tests for `src/lib/library.ts`: `subsForFamilies`, `distilleryCounts`, and grouping by `bottleKey`.

**Done when:** `npm test` runs and passes.

### Milestone 3 — Deploy

**Done.** Live at https://what-to-drink.max-krueger.workers.dev/, confirmed on a phone with the laptop off. Cloudflare's new-project flow only offers Workers, so `wrangler.toml` serves `dist` as static assets with single-page-app fallback instead of Pages. The GitHub repo is connected with Workers Builds (build `npm run build`, deploy `npx wrangler deploy`), so every push to `main` deploys and other branches get preview builds. Bottle locations are public.

### Milestone 4 — Analytics

**Done.** One scrolling Analytics screen, computed from the in-app catalog so it follows imports and owner edits. Counts are per physical bottle, and Society bottles are counted like any other (no Society-only panels). Hand-built SVG/CSS graphics, no chart library, and plain one-line takeaways generated from the numbers.

- Headline numbers: bottles, producers, expressions, top region share, share with Smoke, median ABV.
- The shelf: Open vs Closed stacked bar, plus the Graveyard count.
- Where it's from (sub-regions such as "Speyside, Lossie" roll up to their parent), top producers, age buckets, ABV buckets.
- Peat donut: Smoke, no Smoke, untagged.
- Flavor fingerprint radar: share of tagged bottles per family, open bottles drawn over the whole cellar.
- Palate: sub-characteristics sized by count, grouped under the family they appear with most (`subFamily`). Milestone 5 tried reusing this for sub-characteristic colors and found it had no real signal (bottles average 5.9 of 11 families tagged, so co-occurrence is near-uniform); it ended up with a curated map instead (`subOwnerFamily` in `src/lib/library.ts`). The palate cloud still uses the original statistical `subFamily` for its own grouping, unchanged.

Calculations live in tested helpers in `src/lib/analytics.ts`. Deferred: flavor-by-region heatmap, click-through from a bar to a filtered Library, Graveyard trends, and, once pour tracking exists, dram counts, kill shots, and a Just poured chart.

### Milestone 5 — Color-coded flavor families

**Done.** Each of the 11 flavor families has its own accent color, tuned separately for light and dark themes (`familyClass` in `src/lib/colors.ts`). Applied to the Flavor Families filter chips (tinted when available, solid-filled with `--on-gold` text when selected) and to family tag chips on Library rows and the Pick a Dram result.

Sub-characteristics were meant to take the color of the family they most often co-occur with, but that statistic turned out to carry no real signal (bottles average 5.9 of 11 families tagged at once, so every sub touches every family at a near-uniform rate). Replaced with a curated lookup instead (`SUB_FAMILY` / `subOwnerFamily` in `src/lib/library.ts`), assigned by what each sub-characteristic actually means. A sub with no curated owner yet falls back to a neutral look rather than breaking.

That same curation exposed a related filtering gap: picking a flavor family used to list every sub-characteristic merely co-occurring with it, not the ones it actually owns. `subsForFamilies` now also requires a sub's curated owner to be one of the picked families (OR across families when several are picked), so the chips shown match the colors shown.

### Milestone 6 — Remote editing

Migrate the catalog into Cloudflare D1, served by a Worker script (`main` in `wrangler.toml`) since Pages Functions don't run on Workers. Guest refresh sees writes without a commit. Scoped and decided below. **Storage**, **merge-import**, **owner access**, the **lock glyph**, and **confirm steps** are done; export and backups are not yet implemented.

**Storage.** Done. One D1 row per bottle, not a single JSON blob. Enables partial writes — a single edit, or a merge-import, touches only the rows it needs, instead of read-modify-write-the-whole-blob. See Architecture for the schema and routes.

**Owner access.** Done. The threat model is accidental guest interference, not a hardened security boundary — a PIN is proportionate. The PIN is the Worker secret `OWNER_PIN`, checked on every owner request (kill, edit, merge-import, and later export). The browser keeps an accepted PIN in `sessionStorage` for the tab and sends it as `X-Owner-Pin`. No separate login page, no Cloudflare Access, no server sessions or rate-limiting — those solve a problem this app doesn't have. Local `wrangler dev` reads `.dev.vars`; production needs `npx wrangler secret put OWNER_PIN` (and the same secret on preview builds) or every owner request is rejected.

**Owner-mode UI.** Done. "Owner login" is renamed **Bottle Management** and comes off the persistent top nav. In its place: a lock glyph next to the dark-mode toggle in the header. A closed padlock is the guest default; clicking it opens a popover for the PIN. A correct PIN switches the glyph to an open padlock for the rest of the session. That open padlock offers Bottle Management and Lock. This is the general mechanism for any future owner-only action, not just this milestone's — see Pour tracking under Future features.

**Confirmation.** Done. Kill, committing a merge-import, replacing the whole cellar, and overwriting a bottle's details each open a confirm dialog. Cancel and Escape leave the cellar unchanged. Adding a bottle and marking one open stay a single click.

**Editor scope.** Just the owner, from multiple places (laptop, phone, Excel workbook, in-app) — not multiple people, no per-user accounts. Excel and in-app editing are both first-class, indefinitely; neither replaces the other.

**New feature: merge-import.** Done. A second, additive import path (distinct from today's full-replace `ImportPanel`) for dropping in a workbook of new bottles without touching the existing database:

- Lives in Bottle Management, owner-gated.
- Upload always opens a preview screen first; nothing writes to D1 until confirmed.
- Rows matching an existing `bottleKey` are flagged in that preview; the owner chooses per row whether to insert as new stock or skip.

**Export and backups.** Not required for the done-when above. Issue #9 owns the catalog export that a replace can read back. A weekly R2 backup is untracked; see **Undeveloped**.

**Done when:** an owner edit appears for a guest on the deployed URL with no git push, and every owner-gated request is rejected without the correct PIN.

The D1 database `what-to-drink` exists, is bound as `DB` in `wrangler.toml`, and was seeded from the 2 Oct 2026 catalog (540 live, 7 Graveyard).

---

## Undeveloped

GitHub issues are the spec for work that is ready to build. This list is everything else the project has named that is not built and has no issue. Add an issue before building one of these. A finished milestone is a record, not a prompt to build it again.

### In GitHub

- **#8 Separate Library filters from Pick criteria.** The spec is #7. The Library and Pick a Dram still share one saved selection.
- **#9 Record drams against each bottle and round-trip that history.** No dram can be written until a catalog export and replace keep bottle ids. Weekly backup storage is outside that issue.

### Not tracked yet

- **R2 backups.** A weekly Worker cron, and the same write when an owner exports by hand. Each run stores a timestamped snapshot in Cloudflare R2 and keeps the last 10. A scheduled commit to `main` would redeploy the app for no code change. This is not the export in #9.
- **Quick Pours.** Named starting points, such as Heavily Peated or Sweet & Mellow, applied as presets that can then be changed. Theme stays its own facet. This is a taxonomy change, so it stays separate from #8.
- **Origin imagery.** A picture of each bottle's region of Scotland, or its country.
- **Analytics, later.** A flavor-by-region heatmap, a click from a bar through to a filtered Library, and Graveyard trends. Charts of dram counts, kill shots, and Just poured wait until #9, which left them out of scope.
- **Whisky Draft.** Not scoped. The data need not live in D1. If it uses the workbook's Draft Participants sheet, decide what happens to contact data first. That sheet stays out of the app and git.
- **Sheet hygiene.** Theme spelling, SMWS location, and status case, fixed in Excel. The next import picks them up. Society and distillery codes still sit on the bottle; cards already hide them. Removing those codes from the stored fields belongs here. It does not block the open issues.
- **`empty` status.** `BottleStatus` is `Open`, `Closed`, `empty`, or `Killed`. The Graveyard is `Killed`. Ingest can still write `empty`. The Pick pool already refuses it, and the bundled catalog has none. Still open: should ingest turn `empty` into `Killed`? #9 left that decision alone.
- **Search inside a filter section.** Pick a Dram has no search box for a value that appears only after its parent is picked, such as a sub-characteristic or a region. Whether it needs one was never decided.

Already in the app, and so not listed above: the Age and ABV range histograms, the Pick a Dram drawer and card grid, the fancy wheel, guest-visible owner edits, and apartment bottles tagged from a location of `Apartment` (39 in the bundled catalog). Pick a Dram opens a bottle's detail in a dialog. The Library opens it under the row.

---

## Conventions for later chats

- Unbuilt work is an open GitHub issue, or a line under **Undeveloped**. Phrase status that way.
- Sheet cleanup (Theme spelling, SMWS Location, status case) can happen in Excel in parallel. It does not block the open issues.
- Theme aliases may be normalized at ingest so filters match.
- First-screen choice: **The Library** or **Pick a Dram**.
- Sub-characteristic family ownership is a curated lookup (`SUB_FAMILY` / `subOwnerFamily` in `src/lib/library.ts`), not computed: bottles typically carry 5+ flavor families at once, so co-occurrence has no real signal (every sub-characteristic touches every family at a near-uniform rate). It drives both the sub-characteristic color (`subFamilyClass` in `src/lib/colors.ts`) and which subs show under a picked family (`subsForFamilies`). If ingest introduces a new sub-characteristic, add it to `SUB_FAMILY` so it gets color-coded and scoped correctly; until then it's treated as unowned (neutral color, always visible).
