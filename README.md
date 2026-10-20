# What To Drink

A laptop-first web app for a personal whisky cellar. It keeps the bottles still on hand, and it can ask for one to walk to.

Guests can browse what is still available, look at the cellar as a whole, and pick a bottle. The owner can import a workbook, add or edit bottles, and send finished ones to the Graveyard.

Live at https://what-to-drink.max-krueger.workers.dev/. A push to `main` deploys.

## What you can do

**The Library** is every bottle that is still available. Bottles of the same expression are grouped, with a stock count. List and grid show the same groups. Search and filters narrow the list. Opening a row shows that expression in place.

**Pick a Dram** chooses one physical bottle to walk to. You are at the House or the Apartment, and you can narrow the pool before the pick. The pick does not change the bottle. A checkbox in the filter drawer, I feel fancy, sends the next pick through a separate wheel.

**Graveyard** is finished bottles. Browse only. They are not in the Library and not in the pick.

**Analytics** is a picture of the cellar, counted by physical bottle. It follows imports and owner edits.

The owner unlocks with the lock beside the theme switch. Bottle Management can replace the cellar from a workbook, add bottles from a workbook, add or edit one bottle, mark one open, or kill one into the Graveyard. Those writes go to the shared catalog, so another device sees them on the next load.

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
