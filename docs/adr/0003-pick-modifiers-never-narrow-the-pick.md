---
status: accepted
---

# Pick modifiers change how a Pick is chosen, not what it is chosen from

ADR 0002 makes a Pick draw from exactly the bottles the Library is showing. The drawer also needs choices that only affect the Pick, such as Favor last third and I feel fancy. These are Pick modifiers. A Pick modifier may change how likely each showing bottle is, or how the result is shown. It may never remove a showing bottle from the Pick. Anything that narrows the bottles is a Library filter, so Last third is a filter and Favor last third is a modifier.

A modifier that narrows the Pick, such as the old "Last third only" mode, was rejected. It would bring back a second set of narrowing choices inside the drawer, the problem ADR 0002 removed.
