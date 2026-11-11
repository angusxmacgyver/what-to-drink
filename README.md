# What To Drink

A laptop-first web app for a personal whisky cellar. It keeps the bottles still on hand, and it can ask for one to walk to.

Guests can browse what is still available, look at the cellar as a whole, and pick a bottle. The owner can import a workbook, add or edit bottles, and send finished ones to the Graveyard.

Live at https://what-to-drink.max-krueger.workers.dev/. A push to `main` deploys.

## What you can do

**The Library** is every bottle that is still available, and the app opens on it. Bottles of the same expression are grouped, with a stock count. List and grid show the same groups. Search and filters narrow the list. Opening a row shows that expression in place.

**Pick** is a button in the Library's filter drawer. It chooses one physical bottle to walk to, from the bottles the filters leave showing: at the House, unless Place is set to the Apartment. The Library scrolls to that bottle and opens it, marked "Your dram". The pick does not change the bottle. A checkbox beside it, I feel fancy, sends the next pick through a separate wheel, which hands its bottle back to the Library.

**Graveyard** is finished bottles. Browse only. They are not in the Library, so they are never picked.

**Analytics** is a picture of the cellar, counted by physical bottle. It follows imports and owner edits.

The owner unlocks with the lock beside the theme switch. Bottle Management can replace the cellar from a workbook or a downloaded bottles.json, add bottles from a workbook, add or edit one bottle, mark one open, or kill one into the Graveyard. Those writes go to the shared catalog, so another device sees them on the next load.

Scotch Malt Whisky Society bottles are ordinary bottles after import. The SMWS sheet is only a capture format.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` has no API. It shows the bundled catalog, and owner edits fail. For the API and a local database:

```bash
npm run build && npx wrangler dev
```

Add `--remote` to use the production database.

The owner PIN is the Worker secret `OWNER_PIN`. See `.dev.vars.example`. The local default is `cellar`. Copy that file to `.dev.vars` for `wrangler dev`.

```bash
npm test
npm run ingest
```

`npm run ingest` rebuilds `data/bottles.json` from an Excel export. Loading that file into the database replaces every bottle:

```bash
npm run seed:sql
npx wrangler d1 execute what-to-drink --remote --file=./data/seed.sql
```

Work that is not built yet is listed in [PROJECT.md](PROJECT.md).

## Timeline

What shipped, newest first. Each entry is the date the work landed on `main`.

- **11 Nov 2026:** A replace that would clear dram history warns twice. A workbook, or a bottles.json without the drams, last third, kill shots, and Recently poured lines, asks for two confirmations that both say dram counts are cleared, and a merge starts each new bottle at 0 drams with last third off. ([#36](https://github.com/angusxmacgyver/what-to-drink/issues/36))
- **11 Nov 2026:** The catalog round-trips its dram history. Download bottles.json carries each live bottle's drams and last third, each Graveyard bottle's kill shot, and the Recently poured lines, which the shared cellar keeps for every device, and a full replace from that file restores them onto the same bottle ids. ([#35](https://github.com/angusxmacgyver/what-to-drink/issues/35))
- **11 Nov 2026:** Text search matches primary-cask and secondary-cask tags, but not Notes. ([#13](https://github.com/angusxmacgyver/what-to-drink/issues/13))
- **30 Oct 2026:** The Pick a Dram screen is retired. The Library is the only screen for the cellar, and the Pick lives in its filter drawer (ADR 0002). ([#18](https://github.com/angusxmacgyver/what-to-drink/issues/18), [#27](https://github.com/angusxmacgyver/what-to-drink/issues/27))
- **29 Oct 2026:** I feel fancy spins the fancy wheel from the Library drawer, and the wheel hands its bottle back to the Library. ([#26](https://github.com/angusxmacgyver/what-to-drink/issues/26))
- **29 Oct 2026:** A Pick lasts for the visit. The app opens on the Library, and the Pick is made only from its drawer. ([#24](https://github.com/angusxmacgyver/what-to-drink/issues/24), [#25](https://github.com/angusxmacgyver/what-to-drink/issues/25))
- **28 Oct 2026:** Pick a dram from the Library drawer. The Library scrolls to the picked bottle, pulses it, and opens it. ([#23](https://github.com/angusxmacgyver/what-to-drink/issues/23))
- **28 Oct 2026:** The Library drawer guides filtering with live counts, a flag on the filter that hides the most bottles, and a way back from an empty result. ([#22](https://github.com/angusxmacgyver/what-to-drink/issues/22))
- **28 Oct 2026:** A Match exactly switch in the Library drawer. ([#21](https://github.com/angusxmacgyver/what-to-drink/issues/21))
- **28 Oct 2026:** A Place filter on the Library, for the House or the Apartment. ([#20](https://github.com/angusxmacgyver/what-to-drink/issues/20))
- **21 Oct 2026:** Primary cask and secondary cask are read from the workbook, shown on a bottle's detail, and edited in the owner form. ([#11](https://github.com/angusxmacgyver/what-to-drink/issues/11))
- **20 Oct 2026:** Library filters and Pick criteria are kept separate for one visit (ADR 0001, later replaced by ADR 0002). ([#7](https://github.com/angusxmacgyver/what-to-drink/issues/7), [#8](https://github.com/angusxmacgyver/what-to-drink/issues/8))
- **14 Oct 2026:** The fancy wheel easter egg (I feel fancy) on Pick a Dram, and pours grouped by distillery.
- **12 Oct 2026:** The Library is grouped by distillery. SMWS themes get their own palettes, themes and flavor families are ordered by flavor, and open cards group their characteristics.
- **9 Oct 2026:** Pick a Dram is rebuilt around a sliding filter drawer: live option counts, a removable tray of applied filters, undo for the last selection, matches as cards, a bottle dialog, and a selection remembered on this device. A pour walks to the open bottle of its expression.
- **8 Oct 2026:** Age and ABV filters are histograms, built from the bottles every other filter leaves.
- **7 Oct 2026:** The Library shows one detail per expression and adds a card grid beside the list. It remembers which one you chose.
- **7 Oct 2026:** Kill, merge-import, replacing the cellar, and overwriting a bottle each ask for confirmation.
- **6 Oct 2026:** The Worker checks the owner PIN. A lock glyph replaces the owner login and opens Bottle Management.
- **5 Oct 2026:** The catalog lives in D1 behind a Worker API. Owner changes are saved per bottle, so another device sees them. ([PR #6](https://github.com/angusxmacgyver/what-to-drink/pull/6))
- **30 Sep 2026:** Merge-import adds bottles from a workbook without a full replace. ([PR #5](https://github.com/angusxmacgyver/what-to-drink/pull/5))
- **30 Sep 2026:** Each flavor family has its own color, and sub-characteristics sit under the family that owns them. ([PR #1](https://github.com/angusxmacgyver/what-to-drink/pull/1), [PR #2](https://github.com/angusxmacgyver/what-to-drink/pull/2), [PR #3](https://github.com/angusxmacgyver/what-to-drink/pull/3))
- **29 Sep 2026:** The Analytics screen: headline numbers, the shelf, region, producer, age, and ABV bars, a smoke donut, a flavor radar, and a palate cloud. The app deploys on Cloudflare Workers.
- **29 Sep 2026:** A light and dark theme toggle that remembers your choice, chip filters with a distillery typeahead, and an Open/Closed status filter.
- **23 Sep 2026:** The first version: the Library, Pick a Dram, and the Graveyard.
