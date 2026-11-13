# Revised implementation blueprint — integration notes

The source blueprint has many confirmed data tables and several unresolved design decisions.
This branch adds a data-first rules module and regression tests for the source-confirmed
ore/pickaxe progression, Cave Dweller scroll categories, system-world identities, Gate Key
progression, fishing reservoirs, and the six rod types with three upgrade levels each.

The fishing reservoir depth mapping (source labels 2/6/12 mapped to fishing levels 1/3/6)
is the blueprint's proposed interpretation, not a separately confirmed balance decision.
The six rod types and depth caps 1–6 reflect the subsequent explicit fishing instruction.

Not fabricated: pickaxe consumption, starter Coal notation, Cave Point award cadence,
mine density denominator, exact ore/vein distributions, scroll-I recipe, furnace durations
and fuel quantities, instance access/lifecycle, fish catalogue and catch probabilities,
numeric rod pull strengths/upgrading costs, Toxic Acid Basin rules, dungeon combat values,
failure/disconnect behaviour, and ore reward quantities.

This commit is a data/rules foundation only. It does not claim the entire runtime expansion
is complete; the server transaction paths, protected-world enforcement, NPC/UI flows,
top-down dungeon runtime, fullscreen toggle, and visual drop resizing still require
integration and end-to-end tests.
