# What To Drink — project brief

**How to use this document.** This is the whole build. Drop it into a new chat with: `This is the structure of the project. We are on Milestone N of 6. Continue from there.` Treat earlier milestones as done unless the repo shows otherwise. Update **Current milestone** in this file when a milestone’s Done when is met.

**Current milestone:** 6 of 6 (Remote editing) is paused. Export and backups remain — see Milestone 6. The range histogram filters for Age and ABV are in the filter bar. Age has a NAS toggle beside its From and To fields, on by default, and NAS is no longer a stop on the age axis. Milestones 1–5 are done; Milestone 5 (Color-coded flavor families) finished across three PRs. The first version of the app is listed under **Done**. The roadmap was renumbered from 1.

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

- **`atApartment`** — from Apartment sheet or Location aliases once those exist. Empty Apartment sheet means the whole live cellar is house.
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
- Apartment with no tagged bottles: explicit empty state (true of the current snapshot)

### Graveyard

Separate view of killed bottles. Same 12 fields as available. Not in Library scroll. Not in the randomizer.

### Shared filters

Reusable components, used by The Library and Pick a Dram as they apply:

- Distillery / Producer (multi)
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

Calculations live in tested helpers in `src/lib/analytics.ts`. Deferred: flavor-by-region heatmap, click-through from a bar to a filtered Library, Graveyard trends.

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

**New feature: database export.**

- A manual "Export database" action (same idea as today's Download JSON, now reading from D1).
- Plus an automatic backup: a weekly Cloudflare Worker Cron Trigger, and also triggered by a manual export, writing a timestamped snapshot to Cloudflare R2 — picked over committing back to git, since every push to `main` deploys, and a scheduled commit would trigger a weekly production redeploy for no code change. Keep the last 10 backups; prune the oldest on write.

**Done when:** an owner edit appears for a guest on the deployed URL with no git push, and every owner-gated request is rejected without the correct PIN.

The D1 database `what-to-drink` exists, is bound as `DB` in `wrangler.toml`, and was seeded from the 2 Oct 2026 catalog (540 live, 7 Graveyard).

---

## Future features

Not scheduled yet.

- **Apartment inventory.** The Apartment sheet mapper exists but the sheet is empty. Once bottles are tagged, Pick a Dram at the apartment should have a real pool.
- **Sheet hygiene.** Theme spelling, SMWS location, status case. Cleanup in Excel; the next import picks it up.
- **Pour tracking.** After Milestone 6 (remote editing), so pours are shared across devices rather than stuck in one browser. Its owner-only actions (see below) gate behind the same lock-glyph toggle Milestone 6 introduces, not a separate mechanism.
  - **Last third.** A field or flag for a bottle in its last third, marking it a prime target for consumption.
  - **Just poured.** A "Just poured" button on a bottle in The Library, and a matching one on the Pick a Dram result.
  - **Recent drams.** A rotating list of the last 25 drams marked as poured, oldest dropping off as new ones arrive.
- **Filter design cleanup.** The first item is in place, ahead of the rest of Milestone 6: ABV and Age are range histogram filters (full requirement below). NAS is a toggle beside the Age From and To fields, not a stop on the age axis. The histogram model lives in `src/lib/histogram.ts`.
- **Pick a Dram refactor.** Filters move into a drawer, options become grids with live counts, and results become a card grid with a picked state. Comes after the range histogram filters, which it consumes (full requirement below).
- **Quick Pours.** Curated starting points (e.g. Heavily Peated, Sweet & Mellow, Spicy & Dry) applied as presets the user can then refine. The Pick a Dram prototype showed these replacing Themes; that is a taxonomy change, so it is not part of the refactor, where Theme stays a normal facet.
- **Origin imagery.** A visual mapping for each bottle, showing its region of Scotland or its country of origin.
- **Analytics improvements.** More robust and interesting facts about the collection.
- **Whisky Draft.** To be scoped later. Data does not need to be in D1: either read it from the sheet import or keep it as a static JSON file. If it uses the workbook's Draft Participants sheet, decide how participant contact data is handled first: today that sheet is skipped and must stay out of the app and git.

### Requirement: Range histogram filters (ABV and Age)

**Summary.** Replace the two continuous range sliders (ABV and Age) with "range histogram" filter controls. Each control combines (a) a distribution histogram, (b) a draggable brush selection over that histogram, and (c) two numeric "endstop" input fields (From / To) that stay in sync with the brush. All selection values snap to whole integers. Results update live.

Rationale: whisky ABV and age statements are effectively quantized (they land on a small set of real values), so free-floating sliders produce meaningless precision (e.g. "57.2 yr", "67.9%") and are hard to land on a round number. Snapping + typed endstops fixes this. Separately, "No Age Statement" (NAS) is not a number and must not live on the age axis.

**Build two instances of the same component.**

1. ABV filter — unit `%`.
2. Age filter — unit `yr`, plus the NAS toggle described below.

**Data model.**

- The collection is a list of bottles. Each bottle has:
  - `abv`: number (percent).
  - `age`: either a positive number (years) OR the sentinel value `NAS` (no age statement).
- Derive each histogram's numeric domain from the data at runtime, do not hardcode it:
  - ABV domain = [min ABV, max ABV] across bottles at or above 40% (floor/ceil to the bin width). Anything under 40% is bad data and is left off the axis.
  - Age domain = [min numeric age, max numeric age] across bottles whose `age` is numeric. (NAS bottles are excluded from this domain.)
- Blanks (the canonical schema allows both until the sheet cleanup lands):
  - Blank Age is treated as `NAS`: counted on the NAS button and governed by the NAS toggle.
  - Blank ABV is excluded from ABV filtering: not binned, not part of the ABV domain, and never filtered out by the ABV range.

**Histogram.**

- Bin the data into fixed-width bins across the numeric domain. Default bin width: ABV = 2%, Age = 2 yr (make it a prop).
- Each bin is a vertical bar; height is proportional to the count of bottles in that bin, scaled to the tallest bin.
- Bars whose bin falls fully inside the current selection are painted in the accent color; bars outside the selection are muted/greyed.
- Show a baseline axis with a few sparse tick labels (e.g. domain min, a few midpoints, domain max). Do not label every bin.

**Brush selection (drag).**

- An overlaid selection region spans the current [from, to].
- Three drag affordances:
  1. Left edge handle: changes `from`.
  2. Right edge handle: changes `to`.
  3. Middle of the region: pans the whole window, preserving its width.
- All drags snap the value to the nearest whole integer.
- Constraints: `from` and `to` stay within the domain; enforce a minimum gap of one bin width so the handles can't cross or collapse.
- Use pointer events so it works with mouse and touch.

**Typed endstops (From / To number inputs).**

- Below each histogram, two numeric inputs labeled `From` and `To`, each showing the unit suffix.
- Two-way binding with the brush: dragging the brush updates the input values; editing an input moves the brush.
- On commit (change/blur), clamp the typed value to the domain and to the min-gap rule relative to the other end; snap to a whole integer. If invalid (e.g. From > To), coerce to the nearest valid value rather than erroring.

**NAS handling (Age filter only).**

- NAS is a separate boolean toggle button, independent of the numeric age range. It is NOT a position on the age axis.
- Default state: ON (NAS bottles included).
- The button shows its label ("NAS") and the count of NAS bottles.
- Layout requirement: the NAS toggle sits on the SAME row as the Age From/To endstop inputs, at the LEFT end of that row. The row is full-justified (space-between): NAS button flush-left, the From/To inputs occupying the right side. On narrow widths the row may wrap, NAS first.

**Match logic (applies to the live count and the filtered result set).** A bottle matches when BOTH are true:

1. `abv` is blank, or within [abvFrom, abvTo] (inclusive).
2. If `age` is `NAS` or blank: the NAS toggle is ON. Otherwise: `age` is within [ageFrom, ageTo] (inclusive).

**Live count.** Display "{N} of {total} bottles match" and recompute on every change to either histogram, either endstop, or the NAS toggle.

**Defaults (seed values).**

- ABV: full domain selected.
- Age: full numeric domain selected, NAS toggle ON.

**Acceptance criteria.**

- No selection value is ever shown with a decimal; everything snaps to whole integers.
- Editing a number field moves the brush, and vice versa, with no drift.
- Turning NAS off removes exactly the NAS bottles from the count, with the numeric age range unchanged.
- The NAS toggle renders at the far left of the age range row, full-justified against the From/To inputs.
- Handles cannot cross; the selection cannot shrink below one bin.
- Works with both mouse and touch.

### Requirement: Pick a Dram refactor

**Depends on:** the range histogram filters above. Build those first; this refactor places them in the drawer and does not redefine them.

**Problem.** Pick a Dram shows every facet expanded as long vertical lists (Region alone is 30+ values). Combining facets often ends at "Nothing matches these filters", options show no counts, and applied filters are not summarized anywhere.

**Goals.** Let the user express intent freely and always see how many bottles remain. Replace long lists with dense option grids. Keep the current selection visible and individually removable. Make zero results a recoverable state. Keep `Pour one` fast, and never offer a bottle that can't be poured.

**Principles (non-negotiable).**

- Inform, never prevent. Every option stays selectable; counts, including zero, are advisory. Never disable, hide, or lock an option because of its count.
- Every option shows a live count of the bottles that would remain if it were added to the current selection.
- The current selection is always visible as removable chips, in the drawer and on the results view.
- Zero is a normal state with a way back.
- Empty bottles are never pourable.

**Decisions.**

- Within a facet, picks combine with OR; across facets, with AND.
- Exception: Flavor Families and Sub-characteristics are OR by default, with an any/all toggle on those sections. Today they are AND only (`every()` in `matchesFilters`, `src/lib/library.ts`).
- Facets stay as they are today: Search, Distillery / Producer, Theme, Flavor Families → Sub-characteristics, Age, ABV, Country → Region, and the availability toggle. The place scope (house or apartment) applies before all facets.
- Results are a grid of cards, one per expression. Selecting a card opens its full details in place, under its row (not in a modal). A card picked by the randomizer has its own picked state, separate from the one being viewed.

**Prototype note.** A quick prototype exists (screenshot shared 6 Oct 2026). It is a clarifying artifact, not a design target; where it conflicts with this spec, the spec wins.

- Don't follow: it disables zero-count options, and its "Include closed / emptied bottles" label is the conflation this refactor removes. Its Age and ABV bucket chips are placeholders for the range histograms.
- Keep: per-section "Clear" links, chips that pair a swatch with a count, the sticky `Pour one · N` button, and its copy ("Nothing applied yet — everything's on the table." for the empty tray; "Pick a flavor family to narrow by sub-characteristic"; "Select a country to narrow by region").

**Build steps.** One commit each, aiming for under 200 lines.

1. **Facet counts and candidate set.** Done. Pure logic with tests.
   - A faceted count helper in `src/lib/library.ts`: bottles matching every active facet except the option's own, combined with that option.
   - Add the flavor any/all mode to `FilterState` (`src/types.ts`).
   - Candidate set: place scope first, never Empty/Killed, and the availability toggle adds only Closed bottles.
   - Target: recompute in under 100 ms for low thousands of bottles.
2. **Option grid component.** Done. A reusable wrapping grid of tiles. Each tile is a real button with pressed state, a label, its count, and a swatch for flavor families (`familyClass`, `src/lib/colors.ts`). Zero counts are de-emphasized but selectable. Sections collapse and remember that for the session; a section with picks shows its own "Clear" link. Built so The Library can use it later.
3. **Applied tray.** Done. A helper that turns the current filters into removable chips, plus "Clear all". One component serves the drawer ("In your glass") and the results summary row.
4. **Drawer shell.** Done. A `Filters` header button with an active-count badge. The drawer slides in over the results with a scrim; `Esc` closes it. Focus stays inside while open and returns to `Filters` on close. Sticky footer with `Pour one` and the live count.
5. **Facets in the drawer.** Done.
   - Move every facet out of the inline `Filters` in `src/components/PickADram.tsx` into the drawer; Age and ABV use the range histogram controls.
   - Sub-characteristics appear only once a family is picked, grouped under each picked family.
   - Region is grouped by picked country. With no country picked, show a prompt instead of the flat list. Single-region countries get no sub-list.
   - Rename "Include closed bottles" so it clearly means unopened, never empty.
6. **Results grid with in-place detail.** Done.
   - Matching pourable bottles render as a wrapping grid of cards, one per expression (`bottleKey`), like The Library's grouping.
   - Each card: distillery name on top, expression below. No SMWS or distillery code (codes leave the data in a later cleanup). Then region and country (once, when they're the same), flavor-family swatches, age, ABV, and a ×N count of matching pourable bottles.
   - Long names: distillery gets one line, ending in "…" if it runs over (longest today is 27 characters). Expression wraps to at most two lines, then "…" (in the 6 Oct 2026 catalog, 57 expressions exceed 30 characters; the longest is 65). The full name stays in the card's hover text and accessible label, and in the detail panel.
   - Selecting a card opens a full-width detail panel under its row; later cards move down. One panel open at a time; selecting the card again or pressing `Esc` closes it.
   - The panel shows `BottleFields` and `FlavorTags`, plus status and location. If the matching bottles differ in location or status, list the split, as the Library row does.
   - Cards are real buttons with an expanded state, built so The Library can use the card and panel later as a grid view.
7. **Picked state (randomizer).** Done.
   - `Pour one` picks one physical bottle (`id`), so stock of 5 is five chances. That expression's card gets a picked state separate from viewing: an accent ring, a "Your dram" label, and the picked bottle's location shown prominently. Viewing other cards doesn't clear it.
   - After a pick, scroll to the card and open its detail. Announce the pick through a live region.
   - A short roll animation (the highlight skips across cards before landing), skipped when the system is set to reduce motion.
   - "Pour another" never repeats the last pick unless it's the only pourable bottle left.
   - Clear the picked state if a filter change removes that bottle.
   - Leave a spot in the picked detail panel for the Pour tracking "Just poured" button; don't build the button.
8. **Results summary and zero state.** Done. A summary row with `N available`, the tray chips, and "Clear all". With no matches, replace the grid with "No bottles match this combination." `Pour one` is disabled only at zero pourable bottles.
9. **Zero recovery.** Done. In the drawer footer: "Undo last", backed by a session history of selection states, and the applied filters with the most constraining one flagged (the single removal that brings back the most bottles).
10. **Local persistence.** Done. Selection state saved per device in `localStorage`; no server call. The tray carries across sessions, which answers open question 2.

**Acceptance criteria.**

- No option is ever disabled or hidden because of a zero count; the user can always build a query that returns nothing.
- Every option shows an accurate count that updates on each change.
- Facet options render as a wrapping grid, not a single column.
- Active selections appear as removable chips in both the drawer tray and the results summary; each is removable on its own, and "Clear all" resets.
- A zero-match selection shows the recovery block with a working "Undo last" and a flag on the most constraining filter.
- Empty bottles never appear in results and `Pour one` can never return one; the availability toggle affects only Closed (sealed) bottles.
- Age and ABV use the range histogram controls.
- Region is country-scoped; sub-characteristics are family-scoped.
- Components are reusable, so the grid can become a toggle on The Library in a later milestone.
- Selecting a result card opens its full details in place, one at a time.
- Cards show the distillery above the expression, with no code; long names cut to one line (distillery) and two lines (expression), with the full name still available.
- After `Pour one`, the picked card is highlighted, scrolled into view, and opened. The highlight survives viewing other cards and clears if filters remove the bottle.
- "Pour another" never returns the same bottle twice in a row while two or more are pourable.
- The roll animation is skipped when the system is set to reduce motion.
- Drawer is keyboard-navigable; option counts are announced with their labels; flavor color is never the only identifier.

**Open questions (resolve before build).**

1. Is a "search within filters" box needed, to reach a value behind progressive disclosure (e.g. a sub-characteristic) without picking its parent first?
2. Does the applied tray carry across sessions, or reset each visit? It carries. Step 10 stores the selection in `localStorage`.
3. Does `Change place` move into the drawer as a scope selector, or stay in the header? Today it resets the screen to the House/Apartment chooser.
4. Status vocabulary. In code, `BottleStatus` is `"Open" | "Closed" | "empty" | "Killed"` (`src/types.ts`). The Graveyard is `Killed`, so this spec's "Empty" maps to `Killed`. A separate `empty` status exists in ingest and would sit among live Library bottles; it is already excluded from `dramPool`, and no current bottle has it. Still to decide: should ingest turn `empty` into `Killed`, and do sealed and unopened need to be distinct?

**Out of scope.** Changes to facet taxonomy or the data model; the range histogram spec itself; Graveyard, Analytics, Owner, and bottle-detail content beyond what this spec references.

---

## Conventions for later chats

- Phrase status as which milestone is in progress, not as a recap of old debates.
- Prefer editing `PROJECT.md` Current milestone over scattering status in chat.
- Sheet cleanup (Theme spelling, SMWS Location, status case) can happen in Excel in parallel; the next import picks it up. It does not block any milestone.
- Theme aliases may be normalized at ingest so filters match.
- First-screen choice: **The Library** or **Pick a Dram**.
- Sub-characteristic family ownership is a curated lookup (`SUB_FAMILY` / `subOwnerFamily` in `src/lib/library.ts`), not computed: bottles typically carry 5+ flavor families at once, so co-occurrence has no real signal (every sub-characteristic touches every family at a near-uniform rate). It drives both the sub-characteristic color (`subFamilyClass` in `src/lib/colors.ts`) and which subs show under a picked family (`subsForFamilies`). If ingest introduces a new sub-characteristic, add it to `SUB_FAMILY` so it gets color-coded and scoped correctly; until then it's treated as unowned (neutral color, always visible).
