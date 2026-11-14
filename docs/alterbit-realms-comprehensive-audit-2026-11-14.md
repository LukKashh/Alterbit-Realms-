# Alterbit Realms — Comprehensive Repository Audit

**Repository:** `LukKashh/Alterbit-Realms-`  
**Audited branch:** `main`  
**Audited commit:** `3629420bee9389f55a0d76e170a92368d617a064`  
**Audit date:** 2026-11-14  
**Audit type:** Static implementation, architecture, security-rule, persistence, networking, gameplay-flow and CI review.

## Executive summary

The current main branch builds successfully and its latest GitHub Actions verification run passed TypeScript checking, regression tests and the production build. This is a useful baseline, but it does not establish runtime correctness or security.

The highest-risk findings are:

1. WebSocket authentication accepts a client-supplied player ID without a verified session token.
2. The server seeds a known administrator password and promotes an account based on a username/email match.
3. Firestore rules permit any verified user to update a public world's full snapshot, including world tiles and ownership metadata.
4. Legacy world-editor membership bypasses Share Lock claim-level permissions.
5. Fiscore's visible 3D fishing loop is locally simulated rather than integrated with the authoritative fishing service.

These should be treated as release-blocking security and product-integrity issues until resolved.

## Verification baseline

Latest commit: `3629420bee9389f55a0d76e170a92368d617a064`.

GitHub Actions run `43553670812` completed successfully. Its single verification job passed:
- dependency installation
- TypeScript check (`npm run lint`)
- regression tests (`npm test`)
- production build (`npm run build`)

Workflow: `.github/workflows/verify.yml`.

The repository currently has focused tests for world rules, expansion data, dungeon behavior/storage, Share Lock geometry/permissions, and tree growth. It does not yet have broad browser-level or end-to-end coverage for all four modes, real WebSocket authentication, Firestore authorization, Fiscore gameplay, or complete player journeys.

## Findings

### CRITICAL — A1. WebSocket identity can be impersonated

**Evidence:** `server.ts:308-340`.

The WebSocket `hello` handler accepts either a valid session token or a client-supplied `playerId`. The latter is passed to `store.getOrCreatePlayer(...)`, which can load an existing player record or create a new account using that identifier (`server/worldStore.ts:750-776`).

**Impact:** A caller who knows or guesses another player's ID can connect as that player without proving account ownership. This exposes that player's inventory, Gems, progression, permissions, and account actions to impersonation.

**Required remediation:**
- Require a valid server-issued session token for all player WebSocket sessions.
- Remove the unauthenticated `playerId` identity fallback from production.
- If guest accounts are intentionally supported, issue an unguessable server-side guest credential and bind it to a server-created account; never accept a chosen account ID as proof.
- Add tests proving missing, expired, malformed and forged credentials are rejected and cannot mutate any account.

### CRITICAL — A2. Default administrator credential and unsafe role promotion

**Evidence:** `server/worldStore.ts:300-342`.

The initializer creates a `GameDev` administrator using the literal password `123456`. If an account matching the configured email or username exists, the initializer assigns it the admin role and rewrites its email to the configured administrator email.

**Impact:** The default credential is publicly recoverable from source. More seriously, a user-controlled registration that matches the privileged username/email can be promoted automatically during startup. This is a privilege-escalation path.

**Required remediation:**
- Remove source-controlled administrator passwords and automatic role promotion by username/email.
- Use a one-time, deployment-controlled bootstrap secret or an explicit out-of-band administrator provisioning procedure.
- Never grant administrator privileges based solely on mutable account profile fields.
- Rotate/revoke any existing account created with the known default credential.
- Add startup migration tests covering pre-existing matching usernames/emails and ordinary player accounts.

### HIGH — A3. Firestore public-world update rule permits snapshot takeover

**Evidence:** `firestore.rules:206-229`; client writer: `src/lib/firebaseSync.ts:113-160`.

The world update rule accepts an update when the existing world is public (`existing().publicAccess == true`). The allowed changed fields include owner metadata, revision, spawn, foreground/background tile snapshots, fluid snapshots and public access. The client writer sends those fields from its local world state.

**Impact:** Any verified Firebase user can potentially overwrite the complete Firestore snapshot of a publicly discoverable world, including its content and ownership metadata. This conflicts with server-authoritative world ownership and edits.

**Required remediation:**
- Restrict world snapshot writes to the actual owner or a trusted server identity.
- Do not treat public discoverability as write authorization.
- Keep public browser/read access separate from world mutation rights.
- Prefer server-mediated writes with owner/permission checks and revision validation.
- Add Firestore Emulator tests for owner, authorized collaborator, unrelated verified user, anonymous user, and public/private worlds.

### HIGH — A4. Legacy editor list bypasses Share Lock permissions

**Evidence:** `src/game/rules.ts:125-145`.

`hasEditPermission` grants a player in `world.worldLock.editors` unconditional permission before checking whether the target tile is inside a Share Lock and whether that player has the requested Build, Break or Interact permission.

**Impact:** A legacy editor can bypass the new per-claim permission model and edit beyond the Share Lock rectangle or perform actions that should have been individually denied. This conflicts with the approved design that access and editing rights are constrained to assigned claims.

**Required remediation:**
- Make world ownership the only whole-world edit bypass.
- Apply Share Lock permissions only inside the matching claim.
- Deny editing outside claims in an owned world unless a separately approved world-wide permission model is explicitly introduced.
- Migrate legacy editor data deliberately and test all three permission types inside and outside claims.

### HIGH — A5. Fiscore 3D fishing encounter is not server-authoritative

**Evidence:** `src/components/Fishing3dOverlay.tsx:29-96` and `297-338`.

The 3D overlay changes cast/bite/progress/catch state locally with React state and fixed timers. The reel button increments local progress and assigns a fixed fish name. The component accepts server fishing callbacks, but this local loop does not use them to complete the encounter.

**Impact:** The 3D mode can display a successful catch without a server-confirmed cast, bite, fish selection, reel sequence, inventory award, or durable fish-caught statistic. It also duplicates fishing behavior instead of adapting the existing authoritative cast/bite/reel system.

**Required remediation:**
- Connect 3D fishing locations to the existing authoritative fishing service.
- Have the server validate rod ownership, fishing location/depth, bite timing, fight state, reel progress, catch selection, inventory award and statistics.
- Keep the overlay as presentation/input only.
- Add integration tests for invalid casts, early/late reeling, line failure, successful catches, disconnects and duplicate reward attempts.

### HIGH — A6. Firestore and JSON persistence are competing data paths

**Evidence:** `server/worldStore.ts` uses local JSON files for credentials, sessions, player accounts, configuration, exchange and worlds; examples include `savePlayer` and `saveWorld`. `src/lib/firebaseSync.ts` separately writes account/world/presence snapshots to Firestore.

**Impact:** There is no clearly enforced single source of truth across these paths. Concurrent writes, stale client snapshots, restarts, multi-instance deployments and partial failures can produce divergent state. Local disk persistence also depends on the hosting platform providing durable storage and a single-writer deployment model.

**Required remediation:**
- Declare the authoritative persistence layer for each data class.
- Ensure economy, inventory, ownership, world edits and progression have one authoritative write path.
- If JSON remains for local development, add atomic temp-file replacement, schema/version validation, corruption recovery and explicit single-instance constraints.
- For hosted multiplayer, use durable shared storage with transactional updates, concurrency control and backups.
- Add restart, crash-during-write, simultaneous-update and multi-instance tests.

### HIGH — A7. Offline action queue can replay stale gameplay commands

**Evidence:** `src/game/network.ts:545-560` and `630-675`.

The client retains non-movement messages while disconnected and flushes them after reconnection, with a bounded queue. The queue includes state-changing commands such as purchases, lock configuration, crafting/interactions and other actions.

**Impact:** A delayed command can execute after the player has changed worlds, the target object has changed, the permission context has changed, or the user has intentionally abandoned the action. The server must not assume that a previously queued action is still current.

**Required remediation:**
- Classify commands as ephemeral, safely retryable, or non-replayable.
- Drop stale movement and context-bound interactions on disconnect/world change.
- Use idempotency keys for all economy-affecting commands and validate the current world/object/permission at execution time.
- Surface pending/failed action outcomes instead of silently replaying.
- Test reconnects during purchases, vending trades, rod upgrades, lock changes, and world transitions.

### MEDIUM — A8. Fiscore progression is not yet mode-independent

**Evidence:** `src/game/network.ts` defines a shared account profile with a single global `xp` and `level`; the master blueprint's Fiscore section calls for mode-specific progression if Fiscore levels are to remain independent.

**Impact:** Awarding Fiscore XP through the current shared profile would affect progression in other modes. A dedicated progression model is needed before the 3D mode is considered complete.

**Required remediation:**
- Define Fiscore XP, level, unlocks and reward persistence separately.
- Keep shared account identity and eligible shared inventory/economy separate from mode-specific progression.
- Specify whether any existing global achievements or account level intentionally receive cross-mode rewards.

### MEDIUM — A9. The mode selector overstates Cave Dweller completeness

**Evidence:** `src/components/ModeSelection.tsx` routes Cave Dweller to the `DWELLER` world. The master blueprint describes Cave Dweller as an independent underground progression experience and lists remaining runtime work around instance lifecycle, mining, drops, progression, and failure/disconnect/exit handling.

**Impact:** The mode is presented as a finished independent experience even though its implementation still relies on the shared 2D world engine and Mining Shaft foundations. The gap between mode identity and implemented gameplay may mislead players and complicate future progression separation.

**Required remediation:**
- Complete the intended Cave Dweller gameplay loop and its independent state boundaries.
- Verify ore density/distribution, pickaxe durability/consumption, shaft lifecycle, drops, furnace/refining, scroll progression and reward persistence.
- Keep unresolved blueprint values explicitly marked provisional until approved.

### MEDIUM — A10. Dungeon lifecycle and rewards need stronger integration guarantees

**Evidence:** `server/dungeonStore.ts` contains active/cleared/completed/failed transitions, disconnect grace, extraction rewards and periodic cleanup. Existing tests cover dungeon logic/storage, but there is no broad end-to-end test for multi-client reconnect, duplicate extraction, reward persistence, server restart and concurrent party actions.

**Impact:** A passing unit/regression suite does not prove that a complete cooperative run grants rewards exactly once or recovers correctly through disconnects and restarts.

**Required remediation:**
- Add explicit idempotency/persisted reward-claim state for completed runs.
- Test duplicate extraction/action delivery, reconnect during cleared/completed phases, last-player disconnect, party defeat, timeout, restart recovery and multiple simultaneous parties.
- Add real client/server integration tests for third-person input and completion UI.

### MEDIUM — A11. CI does not exercise browser/runtime or Firebase security behavior

**Evidence:** `.github/workflows/verify.yml` runs TypeScript, Node regression tests and Vite production build only.

**Impact:** Browser rendering, mobile touch input, actual Firebase rules, WebSocket auth and real multiplayer state transitions can regress while CI remains green.

**Required remediation:**
- Add unit tests for the critical authorization and persistence paths.
- Add Firebase Emulator rule tests.
- Add WebSocket integration tests using authenticated clients.
- Add browser E2E smoke journeys for each mode, including mobile viewport and touch controls.
- Add performance smoke tests for the 2D render loop and dungeon/Fiscore scenes.

## Mode-by-mode audit summary

### Nexus Realms
**Implemented foundations:** 2D world engine, persistent world records, owner-protected WorldCore, Landlord entry point, Share Lock rectangles, per-player permission data, world listing and multiplayer socket flow.

**Must fix/verify:** WebSocket account identity, Firestore snapshot write authorization, legacy editor bypass, durable persistence strategy, world ownership migration, access requests/invitations/blocking/temporary bans, owner deletion flow and complete Share Lock interaction enforcement. Confirm all world management UI actions are server-authorized.

### Dungeons
**Implemented foundations:** separate server-side dungeon run store, third-person overlay, party modes, gate keys, room maps, enemy simulation, extraction and rewards.

**Must fix/verify:** end-to-end movement/input latency, collision and wall sliding on touch devices, reconnect behavior, duplicate rewards, terminal cleanup, server restart recovery and reward persistence. Existing successful CI is not a substitute for real multiplayer runtime testing.

### Fishing / Fiscore
**Implemented foundations:** existing authoritative 2D fishing cast/bite/reel state, six rod types, individual rod identities/upgrades, depth-aware fish selection, fish resistance and fight-pattern feedback. A separate 3D island overlay exists.

**Must fix/verify:** the 3D overlay currently simulates a catch locally. It needs a real world scene, movement/boat/fishing-zone systems, server-integrated fishing, fish catalog/encounter UI, permanent boat ownership, six depth regions, dynamic rare locations, independent progression, and save/reconnect behavior.

### Cave Dweller
**Implemented foundations:** DWELLER world identity, mine shaft generation/expiry, ore/pickaxe/furnace/scroll data and mining-related server paths.

**Must fix/verify:** complete independent game loop, mining shaft access/exit/disconnect lifecycle, ore and drop balance, pickaxe durability/consumption, refining progression, scroll recipes, reward persistence, independent progression and mobile usability.

## Recommended remediation order

1. **P0 — Security:** remove unauthenticated WebSocket identity fallback; eliminate default admin credentials/role promotion; close Firestore public-world write takeover; enforce Share Lock claim-level permissions.
2. **P1 — Data integrity:** define a single persistence authority; make writes durable/atomic; add idempotency and stale-action handling.
3. **P1 — Fiscore correctness:** connect 3D fishing to server-authoritative fishing and independent progression.
4. **P1 — Dungeon reliability:** test reconnect, extraction, duplicate rewards, lifecycle and restart recovery.
5. **P2 — Cave Dweller completion:** finish the mode-specific loop and remove misleading incomplete mode claims.
6. **P2 — Quality gates:** add Firebase Emulator, WebSocket integration, browser E2E and mobile/performance smoke coverage.

## Audit limitations

This audit inspected the default-branch source, architecture blueprint, Firestore rules, client/server message handling, selected mode components, persistence paths, focused regression tests and latest GitHub Actions run. It did not execute the game in a browser, connect to a live Firebase project, deploy a multiplayer server, inspect production data, or perform an external penetration test. Findings about exploitable code paths are based on the inspected implementation; live exploitability and deployment-specific impact still require controlled verification.

No gameplay source files were changed as part of this audit report.
