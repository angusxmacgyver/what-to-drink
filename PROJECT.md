# What To Drink — project brief

**How to use this document.** This is the whole build. Drop it into a new chat with: `This is the structure of the project. We are on Milestone N of 12. Continue from there.` Treat earlier milestones as done unless the repo shows otherwise. Update **Current milestone** in this file when a milestone’s Done when is met.

**Current milestone:** 9 of 12

**Living copy:** this file.

---

## Product

**What To Drink** is a laptop-first web app for a personal whisky cellar.

Two jobs:

1. **The Library** — the book of every bottle that is still available (not killed). Searchable and filterable. Grouped by expression with a stock count.
2. **Pick a Dram** — a randomizer for a pour. Optional filters, then one bottle and where to walk.

A third surface, **Graveyard**, holds killed bottles. It is browse-only. Those bottles are not in The Library and not in the randomizer.

Guests get The Library and Pick a Dram (and Graveyard). Owner-only surfaces (from Milestone 10) are ingest and, later, add/edit.

The workbook tab named SMWS is only how Society bottles are captured in Excel. After ingest they are ordinary Library bottles and ordinary randomizer tickets. There is no SMWS-only screen or chip.

---

## How an agent should start

1. Read this file and note **Current milestone**.
2. If a repo exists at [`~/Projects/what-to-drink`](/Users/max.krueger/Projects/what-to-drink), work there. If this chat is still in the home workspace, call `move_agent_to_root` on that path **before** any file changes.
3. Match existing code style. Do not rebuild finished milestones.
4. Finish only the stated milestone unless the user expands scope.
5. When Done when is met, mark the todo complete and set **Current milestone** to N+1.

**Stack:** React 19 + TypeScript + Vite. Static SPA until Milestone 12.

**Hosting (from Milestone 9):** Cloudflare Pages, git-connected. Data until Milestone 12 is JSON in the repo.

**Owner PIN:** `VITE_OWNER_PIN` (see `.env.example`; local default `cellar`).

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

---

## Architecture

Until Milestone 12 the git repo is the host for data. Guests see whatever was last imported and deployed. Owner edits persist to `localStorage` and, when bound, to Cloudflare D1 via `PUT /api/catalog`.

**Layout:**

- `PROJECT.md` — this brief
- `data/bottles.json`
- `data/bottles.backup.json`
- `scripts/ingest.ts` — workbook → JSON
- `src/` — React app
- `functions/api/catalog.ts` — Pages Function for D1
- `schema.sql` — D1 snapshot table

---

## Milestones (12)

### Milestone 1 — Scaffold

Vite + React + TypeScript, `PROJECT.md`, git at `~/Projects/what-to-drink`.

**Done when:** `npm run dev` shows a blank shell and the git repo has `PROJECT.md`.

### Milestone 2 — Ingest

Read the xlsx. Map Open, Closed, and SMWS into canonical bottles. Fallen soldiers → `graveyard`. Skip Draft Participants.

**Done when:** `data/bottles.json` has 157+174+176 live bottles, Ardbeg Cask Strength 10 `bottleKey` count is 5, `smws::1.246` (or equivalent) is present, graveyard length is 5.

### Milestone 3 — The Library list

Grouped list, compact fields, stock badge.

**Done when:** CS10 is one row `×5`, Society bottles appear in the same list, killed bottles do not.

### Milestone 4 — The Library search, filters, detail

Shared filter bar, text search, expanding row with the 12 fields (SMWS extras on Society rows).

**Done when:** you can filter to a distillery, search a Full Code, and expand a row without leaving the list.

### Milestone 5 — Graveyard

Separate view for `graveyard`.

**Done when:** Lagavulin 16 appears only here.

### Milestone 6 — Pick a Dram roll

Place question, Open default, roll a result card with Location.

**Done when:** a house roll can return a Society bottle; it never returns a graveyard bottle; apartment with no tags shows empty state.

### Milestone 7 — Pick a Dram filters

Wire shared filters plus include-Closed and derived Country.

**Done when:** a Theme + Open house roll stays inside that set.

### Milestone 8 — Replace import and backup

Owner-triggered ingest. Replace JSON after writing `bottles.backup.json`. Show `importedAt`.

**Done when:** a second import makes `bottles.backup.json` equal the previous payload.

### Milestone 9 — Deploy

Cloudflare Pages from git. Public URL is The Library + Pick a Dram + Graveyard.

**Done when:** the URL works without the laptop running `npm run dev`.

```bash
npm run build
npx wrangler pages deploy dist --project-name=what-to-drink
```

### Milestone 10 — Import UI

In-app upload of xlsx/csv. Default mapping is Open/Closed headers; SMWS mapping stays built-in.

**Done when:** uploading a new export refreshes The Library without a CLI step.

### Milestone 11 — Owner edit

Login-gated add (sparse fields allowed), edit, mark Open, kill → Graveyard.

**Done when:** an owner can add a closed purchase in the UI and see it in The Library.

### Milestone 12 — App as source of truth

Migrate `bottles.json` into Cloudflare D1 (Pages Functions). Guest refresh sees writes without a commit.

**Done when:** an owner edit appears for a guest on the deployed URL with no git push.

```bash
npx wrangler d1 create what-to-drink
npx wrangler d1 execute what-to-drink --file=./schema.sql
# bind database_id in wrangler.toml, redeploy
```

---

## Conventions for later chats

- Phrase status as which milestone is in progress, not as a recap of old debates.
- Prefer editing `PROJECT.md` Current milestone over scattering status in chat.
- Sheet cleanup (Theme spelling, SMWS Location, status case) can happen in Excel in parallel; the next import picks it up. It does not block Milestones 1–7.
- Theme aliases may be normalized at ingest so filters match.
- First-screen choice: **The Library** or **Pick a Dram**.
