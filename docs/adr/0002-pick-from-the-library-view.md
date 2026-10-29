---
status: accepted
---

# A Pick is chosen from what the Library is showing

ADR 0001 kept Library filters and Pick criteria apart, on two screens. In use, picking turned out to be a way of narrowing the Library and then letting chance choose, not a separate job. Pick a Dram is retired as a screen. A Pick is an action on the Library, and it draws from exactly the bottles the Library filters leave showing.

There is one set of choices. Place (House or Apartment) becomes an ordinary Library filter, unset by default, so an unfiltered Library still shows the whole cellar. A Pick is the one place the Library view is narrowed further: unless the Apartment is chosen, a Pick draws only from the bottles showing at the House. Picking at the Apartment is rare and has to be asked for. The old "opened only" default is gone, so a Pick can land on a closed bottle that is showing. The reveal always says where the bottle is. When an expression has an opened bottle, the Pick leads to it. A Pick lasts until the app is reloaded and survives moving between screens. It clears when a filter change hides it.

Two sets of choices on one screen was rejected because it rebuilds the two-screen problem inside one page. Defaulting the Library to the House, or giving the Pick its own place switch, was rejected for the same reason.
