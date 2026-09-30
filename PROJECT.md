# What To Drink — project brief

**How to use this document.** This is the whole build. Drop it into a new chat with: `This is the structure of the project. We are on Milestone N of 6. Continue from there.` Treat earlier milestones as done unless the repo shows otherwise. Update **Current milestone** in this file when a milestone’s Done when is met.

**Current milestone:** 6 of 6 (Remote editing). Scoped and decided, not yet implemented — see Milestone 6 for the full plan (storage, owner access, merge-import, backups). Milestones 1–5 are done; Milestone 5 (Color-coded flavor families) finished across three PRs. The first version of the app is listed under **Done**. The roadmap was renumbered from 1.

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

**Stack:** React 19 + TypeScript + Vite. Static SPA until Milestone 6.

**Hosting (from Milestone 3):** Cloudflare Workers static assets, git-connected (Workers Builds). Pushes to `main` deploy to https://what-to-drink.max-krueger.workers.dev/. Data until Milestone 6 is JSON in the repo.

**Owner PIN:** `VITE_OWNER_PIN` (see `.env.example`; local default `cellar`). Milestone 6 moves the check server-side and replaces the top-nav "Owner login" with a lock-glyph toggle next to the theme switch.

---

## Source data

Ingest file (current snapshot): [`/Users/max.krueger/Downloads/Whisky Inventory_Sept_22_1623.xlsx`](/Users/max.krueger/Downloads/Whisky Inventory_Sept_22_1623.xlsx)

Workbook sheets to read:

- **Open Bottles** — 157 rows (as of 22 Sep 2026, 16:23)
- **Closed Bottles** — 174 rows
- **SMWS** — 176 rows (same cellar; different columns)
- **Fallen soldiers** — 5 rows → Graveyard
- **Apartment** — empty; keep the mapper ready
- Skip **Draft Participants** (contacts). Do not copy that sheet into the app or git.

Flavor Families and Sub-Characteristics in the sheet use ` | ` as the delimiter.

CLI ingest: `npm run ingest` (optional path argument). Writes `data/bottles.json` after copying any previous file to `data/bottles.backup.json`.

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
- Bottling (display) → **Full Code + Name (USA)**
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

List of all live bottles, grouped by `bottleKey`. Compact row: distillery, expression, age, ABV, theme, **stock count**. Five Ardbeg Cask Strength 10s render as one row `×5`.

Selecting a row expands the 12 canonical fields (plus SMWS extras when present). If instances of the same `bottleKey` differ on Location or Status, the expanded detail lists the split.

Search and filters apply to this list.

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
- Age range (NAS is the left stop; include it by leaving the min thumb there, or pin both thumbs on NAS)
- ABV range
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

Until Milestone 6 the git repo is the host for data. Guests see whatever was last imported and deployed. Owner edits persist to `localStorage` today; Milestone 6 replaces the remote side with Cloudflare D1, one row per bottle, rather than the single-blob `PUT /api/catalog` sketched here originally.

**Layout:**

- `PROJECT.md` — this brief
- `data/bottles.json`
- `data/bottles.backup.json`
- `scripts/ingest.ts` — workbook → JSON
- `src/` — React app
- `functions/api/catalog.ts` — Pages Function for D1 (not served on Workers; replaced by a Worker script in Milestone 6)
- `schema.sql` — D1 schema; currently a single-blob snapshot table, to be replaced with one row per bottle for Milestone 6

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

Migrate the catalog into Cloudflare D1, served by a Worker script (`main` in `wrangler.toml`) since Pages Functions don't run on Workers. Guest refresh sees writes without a commit. Scoped and decided below; not yet implemented.

**Storage.** One D1 row per bottle, not a single JSON blob. Enables partial writes — a single edit, or a merge-import, touches only the rows it needs, instead of read-modify-write-the-whole-blob.

**Owner access.** The threat model is accidental guest interference, not a hardened security boundary — a PIN is proportionate. `VITE_OWNER_PIN` moves from a client-bundled constant to a server-checked secret the Worker validates on every owner request (kill, edit, merge-import, export). No separate login page, no Cloudflare Access, no sessions or rate-limiting — those solve a problem this app doesn't have.

**Owner-mode UI.** "Owner login" is renamed **Bottle Management** and comes off the persistent top nav. In its place: a lock glyph next to the dark-mode toggle in the header. Open padlock = guest view (default); clicking a locked padlock prompts for the PIN, and a correct PIN unlocks owner actions for the rest of the session. This is the general mechanism for any future owner-only action, not just this milestone's — see Pour tracking under Future features.

**Confirmation.** Any destructive or irreversible owner action (kill, committing a merge-import, overwriting a bottle's metadata) requires an explicit confirm step — no single-click accidents.

**Editor scope.** Just the owner, from multiple places (laptop, phone, Excel workbook, in-app) — not multiple people, no per-user accounts. Excel and in-app editing are both first-class, indefinitely; neither replaces the other.

**New feature: merge-import.** A second, additive import path (distinct from today's full-replace `ImportPanel`) for dropping in a workbook of new bottles without touching the existing database:

- Lives in Bottle Management, owner-gated.
- Upload always opens a preview screen first; nothing writes to D1 until confirmed.
- Rows matching an existing `bottleKey` are flagged in that preview; the owner chooses per row whether to insert as new stock or skip.

**New feature: database export.**

- A manual "Export database" action (same idea as today's Download JSON, now reading from D1).
- Plus an automatic backup: a weekly Cloudflare Worker Cron Trigger, and also triggered by a manual export, writing a timestamped snapshot to Cloudflare R2 — picked over committing back to git, since every push to `main` deploys, and a scheduled commit would trigger a weekly production redeploy for no code change. Keep the last 10 backups; prune the oldest on write.

**Still open (small, resolve during implementation):** exact placement/interaction of the PIN prompt under the lock glyph (e.g. a popover vs. an inline field).

**Done when:** an owner edit appears for a guest on the deployed URL with no git push, and every owner-gated request is rejected without the correct PIN.

```bash
npx wrangler d1 create what-to-drink
npx wrangler d1 execute what-to-drink --file=./schema.sql
# bind database_id in wrangler.toml, redeploy
```

---

## Future features

Not scheduled yet.

- **Apartment inventory.** The Apartment sheet mapper exists but the sheet is empty. Once bottles are tagged, Pick a Dram at the apartment should have a real pool.
- **Sheet hygiene.** Theme spelling, SMWS location, status case. Cleanup in Excel; the next import picks it up.
- **Pour tracking.** After Milestone 6 (remote editing), so pours are shared across devices rather than stuck in one browser. Its owner-only actions (see below) gate behind the same lock-glyph toggle Milestone 6 introduces, not a separate mechanism.
  - **Last third.** A field or flag for a bottle in its last third, marking it a prime target for consumption.
  - **Just poured.** A "Just poured" button on a bottle in The Library, and a matching one on the Pick a Dram result.
  - **Recent drams.** A rotating list of the last 25 drams marked as poured, oldest dropping off as new ones arrive.
---

## Conventions for later chats

- Phrase status as which milestone is in progress, not as a recap of old debates.
- Prefer editing `PROJECT.md` Current milestone over scattering status in chat.
- Sheet cleanup (Theme spelling, SMWS Location, status case) can happen in Excel in parallel; the next import picks it up. It does not block any milestone.
- Theme aliases may be normalized at ingest so filters match.
- First-screen choice: **The Library** or **Pick a Dram**.
- Sub-characteristic family ownership is a curated lookup (`SUB_FAMILY` / `subOwnerFamily` in `src/lib/library.ts`), not computed: bottles typically carry 5+ flavor families at once, so co-occurrence has no real signal (every sub-characteristic touches every family at a near-uniform rate). It drives both the sub-characteristic color (`subFamilyClass` in `src/lib/colors.ts`) and which subs show under a picked family (`subsForFamilies`). If ingest introduces a new sub-characteristic, add it to `SUB_FAMILY` so it gets color-coded and scoped correctly; until then it's treated as unowned (neutral color, always visible).
