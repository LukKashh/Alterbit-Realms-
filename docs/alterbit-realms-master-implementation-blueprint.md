# Alterbit Realms — Master Implementation Blueprint

**Repository:** LukKashh/Alterbit-Realms-  
**Baseline branch:** main  
**Baseline commit audited:** acade8f025fcc0b47efb277c1a276229f2ab03c3  
**Purpose:** Consolidate the four-mode product direction, record the repository's actual starting point, and define a safe implementation sequence.  
**Scope:** Planning and audit only. This document does not claim that proposed features have been implemented.

---

## 1. Product definition

Alterbit Realms is one application containing four independent game modes:

1. **Nexus Realms** — 2D side-view sandbox, building, ownership and multiplayer worlds.
2. **Dungeons** — independent third-person 3D dungeon exploration and combat.
3. **Fishing / Fiscore** — independent top-down 3D island, boat and fishing adventure.
4. **Cave Dweller** — independent underground mining and resource-progression experience.

The mode-selection screen is the application-level entry point. Nexus Realms is not the hub for the other modes. Each mode must have its own scene, gameplay loop, progression presentation and mode-specific saved state.

### Product rules

- Keep the existing login and registration experience.
- Replace the current tabbed post-login WorldHub navigation with a clear four-mode selection screen.
- Do not expose STATION as a fifth game mode. It is a legacy dungeon/system-world identity, not a separate player-facing mode.
- Keep the four modes independent while reusing shared account, networking, economy, item and persistence infrastructure where appropriate.
- Preserve existing catalogue entries, balance data and progression definitions unless a deliberate migration is approved.
- Extend existing implementations instead of creating duplicate systems.
- Treat server validation as authoritative for ownership, rewards, inventory, permissions and multiplayer actions.

---

## 2. Repository audit — actual baseline

The audit was performed against the repository's main branch at commit acade8f025fcc0b47efb277c1a276229f2ab03c3.

### Existing application and infrastructure

| Area | Existing implementation |
|---|---|
| Front end | React 19 + TypeScript + Vite |
| Main application | src/App.tsx |
| Authentication screen | src/components/TitleScreen.tsx |
| Current post-login hub | src/components/WorldHub.tsx |
| Main sandbox renderer | src/game/engine.ts — Canvas2D |
| Main server | server.ts — Express + WebSocket |
| Main world/player store | server/worldStore.ts |
| Dungeon persistence/runtime | server/dungeonStore.ts |
| Item catalogue | src/game/catalog.ts |
| World generation | src/game/worldGen.ts |
| Shared rules | src/game/rules.ts |
| Mode/expansion data | src/game/expansion.ts |
| Balance configuration | src/game/config.ts |
| Firebase client sync | src/lib/firebaseSync.ts |
| Firestore rules | firestore.rules |

The app currently uses the states auth, loading, hub, playing and paused. It mounts the sandbox engine and opens the dungeon experience through an independent overlay. Fishing is currently integrated into the sandbox engine rather than a dedicated 3D scene.

### Important baseline findings

1. The current WorldHub has navigation tabs for Worlds, Exchange, Profile, Store and Admin. It also contains quick-launch buttons for NEXUS, STATION, DWELLER and FISHING. This is not the requested final mode-selection flow.
2. Existing standard worlds are 100 × 60 tiles.
3. The current world capacity constant is 20 players. The new user-owned-world decision is 11 total players: owner plus up to 10 additional players. This is an implementation mismatch that must be corrected for player-owned worlds.
4. Current world lock records and area lock records are legacy systems. The catalogue and store still expose World Lock and Small Lock items. The current area lock is a square radius-based 7 × 7 area.
5. The user-approved Share Lock design is not present in the current code.
6. The Landlord NPC, My Worlds / Shared Access Worlds interface, WorldCore and its Manager Panel are not present in the current baseline.
7. Dungeons already has a dedicated server-side run store, a custom third-person renderer, solo/cooperative party modes, gate keys, enemy encounters, room progression and extraction.
8. Fishing already has server-authoritative cast, bite, reel and line-tension mechanics. It is still tied to liquid tiles in the 2D sandbox.
9. Cave Dweller already has mining, pickaxe, furnace, ore and scroll-related foundations. The current Mining Shaft is a temporary 50 × 150 generated world with a 10-minute expiry.
10. Firebase authentication/synchronization exists, while the authoritative world store also writes world data to server-side JSON files. The exact source-of-truth and deployment persistence strategy must be clarified before adding more save systems.
11. Existing test files cover world rules, expansion data, dungeon behaviour, dungeon storage and tree growth. The repository scripts are npm run build, npm run lint and npm test.

### Existing content that must be preserved

- The existing unified item catalogue and item IDs.
- Existing fish species and their definitions.
- Existing six fishing rod types and their three upgrade levels.
- Existing fishing rod upgrade costs, pull multipliers and fish resistance configuration.
- Existing ore progression, pickaxe definitions, furnace recipes and scroll data.
- Existing dungeon gate-key progression, enemy families, reward pools and room data.
- Existing player accounts, authentication, inventory, friends, achievements and economy unless explicitly migrated.

---

## 3. Mode 1 — Nexus Realms

**Identity:** 2D side-view sandbox and multiplayer world-building mode.

### 3.1 Core gameplay

- Keep the existing tile-based 2D world engine.
- Retain the 100 × 60 standard world layout unless a separate world-generation change is approved.
- Preserve mining, block placement, harvesting, farming, crafting, drops, trading and existing catalogue content.
- Keep persistent player-owned worlds and server-authoritative world edits.
- Keep Nexus as a designed system world. Selecting Nexus Realms enters NEXUS, not START.

### 3.2 Landlord and realm management

Add an interactable NPC named **Landlord** inside NEXUS.

Landlord menu:
- **My Worlds** — worlds owned by the current player.
- **Shared Access Worlds** — worlds owned by other players where access has been granted.
- **Conjure up a Fresh one** — begins world creation.

The two world lists must remain separate. Shared worlds must not be shown as player-owned worlds.

### 3.3 World creation

- Ask the player for a world name.
- Normalize and validate the name on the server.
- Check uniqueness on the server before creating the world.
- Generate the world only after successful validation.
- Set a maximum of 11 concurrent players for player-owned worlds: the owner plus up to 10 other players.
- Automatically protect the entire world for its owner. This is an ownership rule, not a purchasable legacy World Lock.
- Offer Terra Blasting only during initial world creation and only if the player owns the relevant World Blast item.
- Do not offer Terra Blasting as a later world-editing option.

### 3.4 WorldCore

Every generated player-owned world must have its entrance World Door positioned directly above a special ground block named **WorldCore**.

- WorldCore remains in the world.
- Only the world owner can activate it.
- Activation opens that world's Manager Panel.
- The Manager Panel must validate ownership server-side; hiding the interaction from non-owners is not sufficient security.

### 3.5 Share Locks — approved specification

Remove the legacy Small Lock / Big Lock / Huge Lock / World Lock placement model and replace area-sharing with these three reusable Share Locks:

| Share Lock | Claimed rectangle | Price |
|---|---:|---:|
| Micro-Share Lock | 3 × 2 tiles | 500 Gems |
| Small-Share Lock | 5 × 5 tiles | 1,500 Gems |
| Cover-Share Lock | 7 × 10 tiles | 3,500 Gems |

Rules:
- A Share Lock can only be placed in a world owned by the placing player.
- The lock claims its exact rectangular tile area.
- Claims must not overlap other active Share Lock claims.
- The owner can grant multiple players access to the same claim.
- Each invited/approved player receives individual Build, Break and Interact permissions.
- Permissions apply only inside the relevant claimed area.
- The rest of the world remains protected by the owner's whole-world ownership rule.
- The owner can change permissions or revoke a player's access.
- When the owner breaks a Share Lock, it returns to the owner's inventory as the same lock type. It is not consumed and does not refund Gems.
- Breaking/removing the lock immediately revokes all permissions attached to that claim.
- All permission checks must be enforced by the server for block placement, breaking and object interaction.

### 3.6 Access, visibility and moderation

World visibility:
- **Private:** only the owner and explicitly authorized players can discover/access the world.
- **Publicly Discoverable:** the world appears in the public browser, but discovery does not grant entry or editing rights.

Public browser shows only:
- World name.
- Owner username.
- Current player count.

When a player without access selects a public world:
- They can send an access request.
- The owner can approve or reject.
- Approved players receive access and are listed under Shared Access Worlds.
- Rejected players cannot enter.
- Owners can block/unblock players from sending future requests.
- Owners can also send direct invitations; acceptance grants access.
- The owner configures each approved player's Build, Break and Interact permissions.
- Shared-access players spawn at the normal world entrance, not directly inside a Share Lock.
- Access approval alone does not grant build, break or interact permissions outside an assigned Share Lock area.

Owner moderation:
- Show a live list of players currently inside the world.
- Allow the owner to kick a player.
- Allow configurable temporary bans and manual early unban.
- Do not add permanent world bans.
- Do not add a global Closed World toggle.
- When the world is full, show World Full and reject entry; do not create a queue.

### 3.7 WorldCore Manager Panel

Planned sections:
- World settings.
- Player access and pending requests.
- Approved/shared players and per-player permissions.
- Blocked players.
- Live player list and moderation.
- Share Lock claim management.
- World deletion.

World deletion requires a dedicated World Deletion Token and an explicit confirmation. Successful deletion removes the world and its associated claims, permissions and access records. The token acquisition method remains undecided.

### 3.8 Nexus items still requiring migration

The existing code uses legacy World Lock and Small Lock items in several places, including catalogue/store listings, world lock handling, exchange/currency paths, crafting and some progression costs. Before removing those item definitions, audit every reference and migrate the dependent feature intentionally. Do not leave dangling item IDs, broken recipes, invalid purchases or orphaned world ownership.

### 3.9 Nexus acceptance criteria

- Selecting Nexus Realms enters NEXUS.
- Landlord menu opens and displays owned/shared lists separately.
- Server rejects duplicate or invalid world names.
- Newly created worlds have WorldCore under the entrance door.
- Non-owners cannot open the Manager Panel or bypass owner protection.
- All three Share Lock sizes claim the exact correct rectangles.
- Multiple players can hold independent permissions on one claim.
- Removing a Share Lock returns it to owner inventory and revokes access.
- Public discovery never bypasses entry authorization.
- The 11-player cap is enforced server-side for player-owned worlds.
- Old lock item removal does not break economy, recipes or existing saves.

---

## 4. Mode 2 — Dungeons

**Identity:** Independent third-person 3D dungeon exploration and combat mode.

### 4.1 Existing implementation

The repository already contains:
- A dedicated DungeonOverlay and third-person renderer.
- A server-side DungeonStore.
- 17 × 11 dungeon maps.
- Five Gate Key tiers.
- Solo and cooperative party modes.
- Enemy movement, targeting, attacks and health.
- Room clearing, next-room progression and final extraction.
- Dungeon XP and raw ore rewards.
- Dungeon persistence and reconnect/resume support.
- Dedicated dungeon SVG assets under public/assets/dungeon/.

Gate-key data currently defines five tiers:

| Tier | Minimum player level | Gem price | Rooms | Completion XP |
|---|---:|---:|---:|---:|
| I | 1 | 50 | 3 | 60 |
| II | 3 | 120 | 4 | 140 |
| III | 6 | 250 | 5 | 300 |
| IV | 10 | 500 | 6 | 650 |
| V | 15 | 1,000 | 7 | 1,400 |

The current data also contains World Lock payment prices. These must be reviewed during the legacy lock migration rather than silently retained after the old currency/item is removed.

### 4.2 Required refinement

The immediate priority is stability, not adding more dungeon content.

- Keep the third-person camera and control direction.
- Fix movement input delay, jitter, collision and wall sliding.
- Keep client rendering interpolation separate from server-authoritative player positions.
- Fix any freeze after clearing the final room or extracting.
- Ensure the final room transitions to the extraction state correctly.
- Ensure rewards are granted once and only once.
- Ensure terminal states clean up safely and the overlay can always be dismissed.
- Ensure leaving, disconnecting, reconnecting, dying, completing and timing out all resolve to a valid state.
- Ensure one player's terminal state cannot strand other party members.
- Preserve the existing four-player cooperative party limit unless changed deliberately.

### 4.3 Dungeon state flow

Active → cleared → next room → active, repeating until the final room.

Final room:
Active → cleared → extraction → completed.

Failure:
Active → failed.

Leaving:
remove the player from the run; remove the run when no participants remain, according to the existing lifecycle rules.

### 4.4 Dungeon acceptance criteria

- Responsive third-person movement on desktop and touch controls.
- No stuck movement against walls or corners.
- Enemy AI continues to operate without freezing the renderer.
- Every room exit works.
- Final extraction completes and returns to the mode-selection screen.
- XP and item rewards are granted exactly once.
- Reconnect/resume restores a valid active run.
- Failure, timeout and leave paths do not strand the app in a modal or paused state.
- Existing dungeon and dungeon-store tests continue to pass.

---

## 5. Mode 3 — Fishing / Fiscore

**Identity:** Independent top-down 3D fishing and ocean-exploration adventure.

### 5.1 Target experience

The player starts in a small island town. The island is surrounded by water. Players can walk around the island and enter functional buildings. They cannot swim indefinitely into deep water; boats are required for ocean travel and access to better fishing locations.

This is a new dedicated 3D mode. It must not be implemented as another fishing menu inside the 2D sandbox.

### 5.2 Island town and player interface

Create a compact functional island town with facilities for:
- Fishing equipment.
- Boat purchase and selection.
- Fish sales.
- Bait and supplies.
- Fish collection.
- Expandable Fish Storage.

The gameplay HUD should include:
- Basic ground movement.
- Compact inventory.
- Dedicated quick-access slots for consumables/boosters.
- Equipped rod and bait status.
- Fish Storage capacity indicator.
- Boat boarding/disembarking interaction.

Building names and final layouts may be refined during visual production; the required principle is that designated buildings have functional interactions.

### 5.3 Ocean and boats

- One continuous ocean surrounds the island.
- Players steer boats freely with directional controls.
- Boat handling differs by boat type.
- Boats are purchased outright using in-game currency and remain permanently owned.
- Players can switch between owned boats.
- Boat types are specialized rather than a single linear six-tier ladder.
- Only selected boat types can be upgraded.
- Boat capabilities determine access to distant/offshore locations.
- Boat cargo does not determine Fish Storage capacity.
- The exact boat catalogue and numerical boat statistics are not confirmed; do not invent final balance values.

### 5.4 Fishing locations

- Six progressively deeper and more distant fishing zones.
- Permanent fishing locations remain available.
- Dynamic rare fishing locations appear and disappear.
- New locations can be discovered through exploration, achievements and special encounters.
- Discovered locations are recorded.
- Underwater visibility is selective: some common fish, rare silhouettes and schools may be visible; the full population is not revealed.
- A lightweight dynamic weather system may influence fish activity, visibility and navigation. It must not block progression.

### 5.5 Fishing encounter

Use the approved hybrid loop:

1. Cast.
2. Wait for a bite.
3. Show bite feedback.
4. Start an interactive encounter using line tension, timing and pulling.
5. Land the fish.
6. Transfer the catch to dedicated Fish Storage.

The existing cast/bite/reel and line-tension logic is the starting point. Adapt it to the 3D scene rather than creating a duplicate fishing balance system.

### 5.6 Existing fishing content to retain

The current repository already defines:
- Six rod types.
- Three upgrade levels per rod.
- Per-rod upgrade costs.
- Upgrade-level pulling multipliers.
- Fish resistance values.
- Depth eligibility and preferred-depth weights.
- Existing fish species: Stream Minnow, Cavern Carp, Glacier Trout and Toxic Slimefin.
- Existing fish XP values and item definitions.
- Reservoir definitions for Shallow Stream, Mid Cavern Pond, Abyssal Glacier Trench and Toxic Acid Basin.

The current depth mapping includes source depth labels 2, 6 and 12 mapped to fishing depth levels 1, 3 and 6. The six rod types cap at their matching depth levels 1–6. Fish depth profiles overlap across neighboring depth levels.

Do not replace or duplicate the existing fish catalogue, rod definitions, rod upgrade costs, fish profiles or pull-resistance configuration.

### 5.7 Important gap between current fishing and Fiscore

Current fishing:
- Runs in the 2D tile-world engine.
- Requires casting into Water or Acid liquid tiles.
- Uses a server tick to schedule bites and line tension.
- Selects a fish from the existing eligible species pool.
- Adds caught fish to the regular inventory.
- Awards XP using the fish item's existing XP value.
- Uses rod durability and repair.
- Has no dedicated boat system, island scene, ocean zones or dedicated Fish Storage.
- Does not yet have the approved bait-equipped-to-rod charge system.

Fiscore implementation must add:
- A top-down 3D island/ocean scene.
- Ground movement and boat movement.
- Fishing spots/zones in the ocean.
- Boat ownership and selected-boat state.
- 3D casting and fishing interaction.
- Dedicated Fish Storage with limited, upgradeable capacity.
- Rod-equipped bait with limited charges.
- Booster quick slots.
- Fiscore-specific XP/level progression and saved data.
- First-discovery and location records if they are part of the final approved reward loop.

The current account model stores a single global XP/level. A mode-specific Fiscore progression record is needed if Fiscore levels are to remain independent from the other modes. Do not silently mix Fiscore XP into the global account level.

### 5.8 Fiscore acceptance criteria

- Player can walk around the island and interact with its facilities.
- Player can board, steer and leave an owned boat.
- Swimming boundaries prevent entering deep water without a boat.
- Boat access rules correctly gate offshore zones.
- Fishing can begin at valid locations in the 3D ocean.
- Hybrid cast/bite/fight/catch sequence works on touch and desktop.
- Rod depth restrictions and all six existing rod tiers work.
- Existing fish species and depth profiles are used.
- Bait charges persist and are consumed according to the existing approved use model.
- Fish enter Fish Storage, not the normal inventory.
- Storage capacity and upgrades persist.
- Fiscore XP and level persist independently.
- Leaving and re-entering Fiscore restores the player's saved state.

---

## 6. Mode 4 — Cave Dweller

**Identity:** Independent underground exploration and mining progression mode.

### 6.1 Existing implementation

The repository already contains:
- A DWELLER system-world identity.
- A temporary Mining Shaft scroll flow.
- A generated 50 × 150 vertical mine.
- Four strata in the current shaft generator: upper limestone, middle shale, crystal granite and deep obsidian.
- Coal, copper, iron, crystal and obsidian deposits in the current generated mine.
- Stone, Iron and Crystal Pickaxes.
- Pickaxe durability and repair at Stone Furnaces.
- Furnaces, fuel, smelting and gear recipes.
- Twelve ore progression tiers in the expansion data.
- Four scroll-category data entries.
- Cave-themed blocks and underground assets in the item catalogue.

The current Mining Shaft is temporary, expires after 10 minutes, and is not saved as a persistent world. It is currently an expedition launched by a Mining Shaft Scroll, not a complete independent mode.

### 6.2 Target gameplay structure

Cave Dweller should be a distinct underground experience, not merely Nexus Realms with a cave background.

Build around existing systems:
- Enter the DWELLER mode.
- Explore underground areas and vertical mine layers.
- Mine breakable terrain and resource deposits.
- Collect ores and materials.
- Improve mining equipment.
- Smelt/refine resources.
- Use existing scroll progression and resource systems.
- Reach deeper strata and unlock higher resource tiers.
- Return to the mode's safe/management area to process resources and prepare another expedition.

The exact final map structure, instance lifecycle and progression pacing must be reconciled with the existing source blueprint. Do not invent missing balance numbers.

### 6.3 Data/runtime mismatch to resolve

The expansion data describes twelve ore tiers and four scroll categories, but the current generated Mining Shaft places a smaller set of deposit types. The current catalogue has three pickaxe item definitions, while the expansion progression table describes a broader pickaxe chain. The runtime must be reconciled with those data definitions before claiming the full Cave Dweller progression is implemented.

### 6.4 Cave Dweller acceptance criteria

- DWELLER launches a dedicated Cave Dweller experience.
- Mine generation is deterministic from its saved seed where persistence is required.
- Every generated deposit is mineable only with valid equipment.
- Resource drops match the configured ore tier and tool rules.
- Pickaxe durability, repair and crafting work consistently.
- Smelting consumes correct inputs/fuel and delivers outputs once.
- Scroll categories unlock only their configured resource ranges.
- Instance expiry/disconnect/exit cannot delete or duplicate player rewards.
- Cave Dweller progress is saved independently from other modes.

---

## 7. Shared application architecture

### 7.1 Required application flow

Title Screen → Account/Profile Load → Four-Mode Selection → Selected Mode

The mode-selection screen should expose exactly:
- Nexus Realms
- Dungeons
- Fishing / Fiscore
- Cave Dweller

The old tabbed WorldHub should no longer be the post-login navigation system. Existing account, store, profile, admin and exchange features must be relocated deliberately to appropriate shared menus or mode-specific facilities before the old tabs are removed.

### 7.2 Mode router

Add an explicit active-mode state rather than inferring the current mode from world names or modal visibility.

Recommended conceptual mode identifiers:
- nexus
- dungeons
- fiscore
- cave_dweller

The app shell should own:
- Authentication.
- Profile loading.
- Mode selection.
- Mode entry/exit.
- Shared notifications.
- Shared connection status.
- Sign out.

Each mode owns its scene, controls, HUD, progression UI and lifecycle.

### 7.3 Shared versus mode-specific data

Shared account data:
- Account ID and username.
- Authentication/session.
- Gems/currency only where the current economy is intentionally shared.
- Common item ownership only where items are genuinely cross-mode.
- Friends and global account settings.

Mode-specific data:
- Nexus world ownership, world access, Share Locks and world state.
- Dungeon run state and dungeon progression.
- Fiscore boats, rods, bait loadouts, fish storage, discovered locations and Fiscore XP.
- Cave Dweller mining progression, scroll unlocks, equipment and resource state.

Avoid placing all mode progress in one unstructured profile object. Use versioned mode-specific records with server-side validation.

### 7.4 Persistence and server authority

- Keep the existing WebSocket server authoritative for real-time gameplay.
- Keep account authentication and identity shared.
- Define one authoritative save path for each data category.
- Reconcile local JSON world persistence with Firestore synchronization before implementing new persistence.
- Never let a client grant itself world ownership, item rewards, permissions, XP, boat access or fish catches.
- Use idempotency for purchases, extraction rewards and other value-granting actions.
- Add migration/version handling for existing user and world records.

---

## 8. Recommended implementation sequence

### Phase 0 — Baseline and safety
- Record current main commit.
- Run and capture current build, lint and test results in a development environment.
- Preserve existing user data and assets.
- Inventory every use of legacy locks and shared XP.
- Confirm the authoritative persistence path.

### Phase 1 — Application shell and mode routing
- Keep TitleScreen authentication.
- Add the four-mode selection screen.
- Replace the old tabbed WorldHub flow.
- Add explicit active-mode routing and safe return-to-selection behaviour.
- Relocate account/profile/store/admin functions before deleting old UI.

### Phase 2 — Dungeons stabilization
- Reproduce the reported movement lag and completion freeze.
- Fix movement/collision/replication.
- Harden final-room and extraction state transitions.
- Make reward delivery idempotent.
- Test reconnect, leave, death, timeout and terminal cleanup.

### Phase 3 — Nexus ownership and Share Locks
- Add Landlord and realm-management UI.
- Add server-validated unique world creation.
- Add WorldCore and owner-only Manager Panel.
- Add the 11-player cap for player-owned worlds.
- Implement Share Lock rectangular geometry and per-player permissions.
- Add access requests, direct invites, visibility and temporary moderation.
- Migrate legacy lock records and all legacy currency/store/recipe references.

### Phase 4 — Cave Dweller integration
- Reconcile the existing 12-tier data with the current shaft generator and catalogue.
- Build the dedicated mode entry/exit flow.
- Integrate scroll categories, mining progression, pickaxes, ore drops and furnace loops.
- Add independent saved progression and regression tests.

### Phase 5 — Fiscore implementation
- Build the top-down 3D island scene.
- Add ground movement and functional town buildings.
- Add the continuous ocean, six depth zones and boat movement.
- Add specialized boat ownership and selected-boat upgrades.
- Adapt existing fishing encounter logic to the 3D world.
- Add dedicated Fish Storage, bait charges, boosters and Fiscore progression.
- Add location discovery and lightweight weather.

### Phase 6 — Integration and release hardening
- Verify every mode can be entered and exited without stale state.
- Verify profile and mode-specific saves across reconnect/reload.
- Run the complete test suite.
- Add end-to-end tests for all critical gameplay loops.
- Test touch controls and responsive layouts.
- Test multiplayer/security paths and data migrations.
- Confirm that a failure in one mode cannot corrupt another mode's state.

---

## 9. Required regression and acceptance test matrix

| Area | Minimum test coverage |
|---|---|
| Authentication | Register, login, reconnect, logout |
| Mode router | Enter each mode, return to selection, switch modes |
| Nexus world creation | Invalid names, duplicate names, successful creation |
| Nexus capacity | 11th/12th entrant boundary, reconnecting existing player |
| Share Locks | Exact rectangle, overlap rejection, owner-only placement/removal |
| Share permissions | Multiple players, independent Build/Break/Interact, revocation |
| Public access | Discovery does not bypass approval |
| Moderation | Kick, temporary ban, expiry, manual unban |
| Dungeons | Movement, collisions, enemy combat, room transition, extraction, rewards |
| Fishing | Rod depth caps, bite, tension, catch, bait charges, storage-full handling |
| Boats | Ownership, switching, upgrade eligibility, water boundaries |
| Cave Dweller | Shaft generation, ore eligibility, pickaxe, smelting, scroll progression |
| Persistence | Reload, reconnect, save migration, no duplicated rewards |
| Cross-mode | No accidental shared scene, inventory, XP or session-state leakage |

---

## 10. Decisions that remain open

These items were not finalized in the design discussion and must not be invented during implementation:

- How World Deletion Tokens are acquired.
- Whether world renaming is allowed and whether it requires an item.
- Whether invitations expire and after what duration.
- Whether the WorldCore activity history is included.
- What happens when Fish Storage is full.
- Exact boat catalogue, prices, stats and which boats can be upgraded.
- Exact Fiscore storage capacity and upgrade costs.
- Final cave instance lifecycle and the complete relationship between the 12 ore tiers, four scroll categories and current mine generator.
- Whether public-world descriptions or other metadata are shown to authorized players.
- The exact source-of-truth relationship between server JSON persistence and Firestore.

Do not block unrelated implementation work on these questions. Use safe defaults only where a decision is necessary, document them, and avoid inventing economy or balance numbers.

---

## 11. Definition of done

Alterbit Realms is ready for a complete release only when:

- The login experience remains intact.
- The post-login screen selects between exactly four independent modes.
- Nexus Realms has functional ownership, Landlord, WorldCore and Share Lock systems.
- Dungeons completes reliably without movement lag or post-clear freezes.
- Fiscore is a playable top-down 3D island-and-ocean fishing experience using existing fish and rod data.
- Cave Dweller is a complete mining/exploration mode built from the existing ore, pickaxe, scroll and furnace foundations.
- Each mode saves and restores its own progression.
- Shared account infrastructure works without merging mode-specific gameplay state.
- All server-side permission, economy and reward rules are enforced.
- Build, lint, unit tests and end-to-end acceptance tests pass.
- No existing catalogue content, user data or unrelated mode functionality is lost during migration.

**Implementation status at time of writing:** No gameplay code has been changed by this blueprint. The repository audit and this plan are the deliverables for this step.
