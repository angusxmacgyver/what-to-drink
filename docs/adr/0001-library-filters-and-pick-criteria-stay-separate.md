---
status: superseded by ADR-0002
---

# Library filters and Pick criteria stay separate

The Library and Pick a Dram used to share one saved selection. An early spec said to reuse filters, and that was built as one set of choices. Browsing a wide cellar and cutting a pool for a Pick are different jobs, so the choices stay separate.

Library filters narrow the Library. Pick criteria narrow the pool from which a Pick can be chosen. Neither is saved across a reload. Pick a Dram starts at the House, with opened bottles eligible and closed bottles left out. A switch to the Apartment lasts for the visit and keeps that visit's Pick criteria, along with the opened and closed choices. A bottle that is not at the new place leaves the pool.

One shared, remembered selection was rejected. So was one narrowing module that both screens render. Similar controls in the two screens are intentional. Matching rules and stateless controls can still be shared. A later review should not merge the two sets of choices just because those controls look alike.
