# Drift Tamers

Sci-fi roguelite monster tamer: a salvage crew boards derelicts, scans xeno fauna, and bonds aliens between tense jobs. Warm wit on the ship, Expanse-style grit in the wreck.

**Phase 2a** added `GameState`, species JSON, and turn battles with scan and bond.

**Phase 2b** added the **contract board**, **5-room run loop**, O₂ pressure, weighted wild encounters, and extract / abort payouts.

**Phase 3a** adds the **mission engine**: five playable mission types (Survey, Rescue, Recovery, Bounty, Escort), JSON briefings and story beats, mission-flavored debriefs on hub return, and types 6–12 shown as locked on the board.

**Phase 3b** adds **ship and resource management**: credits, fuel, parts, research and crew morale in one save, fuel-gated deploys, per-mission-type payouts by outcome, a three-section hub (Missions / Stable / Ship), three buyable ship modules that change how a run plays, and a morale bark from the crew.

## Open in Godot

1. Install **[Godot 4.3+](https://godotengine.org/download)** (4.x with GL Compatibility is fine).
2. In the Project Manager, **Import** → select this folder’s `project.godot`.
3. Press **F5** (Play). Flow: **Ship Hub** → pick a **mission** (briefing + Deploy) → **Derelict run** (rooms) → **Battle** when fights trigger.

Pixel defaults are set in `project.godot`: **640×360** viewport, canvas stretch, **integer** scale mode, **nearest** texture filter, and 2D pixel snap.

## Phase 3b manual test

1. **F5** from `ship_hub.tscn`. The **resource bar** sits above the tabs and stays visible in every section: `CR / FUEL / PARTS / RSRCH / MRL`, with a crew **bark** under it that changes with the morale tier.
2. New crew starts with **120 credits, 24 fuel, 4 parts, 0 research, 62 morale** (see the table below).
3. **Missions** tab: every mission button shows its **fuel cost**. Pick one you cannot afford (drop fuel below the cost first) and the hub answers in fiction: *"Tanks read 8 units. The Survey burn needs 10. Hale will not light the drive on fumes..."*. **Deploy** refuses until the tanks are full enough.
4. **Ship** tab: buy **Scanner Array**, **O2 Scrubber**, **Med Bay** with parts and credits. Each shows its effect and a one-line blurb, flips to **Installed**, and nudges morale up by 3. Under **Supplies**, `Buy fuel cell` trades **40 cr for 10 fuel**. If you are broke *and* below the cheapest mission's fuel cost, a `Siphon the reserves` button appears: **+6 fuel for -6 morale**, so a flat-broke crew is never stranded at dock.
5. Deploy with the modules installed and check the run screen: HUD reads `O₂ 105 / 105 (-6 per room)` on Survey (deep scan 85, +20 scrubber, scrubber saves 2 per room). Clearing a room prints *"Med Bay cycles between rooms: +10% team HP."* Entering a fight logs *"Scanner Array warm (+25% starting scan)"*, which stacks with a breach-scan room for a 65% opening scan.
6. **Extract**, **Abort** or run the O₂ to zero. The hub shows the Phase 3a debrief plus a green **payout line**, for example `Payout: +95 cr, +1 parts, +2 research, morale +1`. Fuel is already gone: it is spent on deploy.
7. **Stable** tab: bonded xen are listed with element and HP. **Release** opens a confirmation, then pays **+2 research** and costs **4 morale**, with a line in the notice row.
8. Quit and relaunch. Credits, fuel, parts, research, morale, installed modules and the stable all come back from `user://stable.json` (v1 saves that only hold a stable still load).

### Resources and costs (v1 numbers)

| Resource | Start | Earned by | Spent on |
|----------|-------|-----------|----------|
| Credits | 120 | Mission payouts, 5 cr per room cleared, extract bonus | Modules, fuel cells |
| Fuel | 24 | Fuel cells (10 per 40 cr), siphon (6 per 6 morale) | Deploying a mission (10–16) |
| Parts | 4 | Mission payouts (Recovery pays best) | Modules |
| Research | 0 | Mission payouts (Survey pays best), releasing a bonded xeno | Nothing yet (Phase 4 hook) |
| Crew morale | 62 | Wins, installing a module (+3) | Fails, releases, siphoning |

### Mission fuel and payout by outcome

| Mission | Fuel | Win | Partial | Fail |
|---------|------|-----|---------|------|
| Survey | 10 | 110 cr, 1 part, 4 research, +6 morale | 55 cr, 1 part, 2 research, +1 | 15 cr, 1 research, −8 |
| Rescue | 12 | 130 cr, 2 parts, 1 research, +12 morale | 65 cr, 1 part, +2 | 20 cr, −12 |
| Recovery | 14 | 120 cr, 5 parts, 1 research, +6 morale | 60 cr, 2 parts, +1 | 15 cr, 1 part, −8 |
| Bounty | 16 | 190 cr, 2 parts, +5 morale | 80 cr, 1 part | 25 cr, −10 |
| Escort | 15 | 160 cr, 2 parts, 1 research, +10 morale | 70 cr, 1 part, −2 | 20 cr, −12 |

Every outcome also pays **5 cr per room cleared**, and a full extract adds the mission's Phase 3a `extract_bonus`. Values live in `data/missions/*.json` under `costs` and `payout`.

### Ship modules

| Module | Cost | Effect | Read by |
|--------|------|--------|---------|
| Scanner Array | 110 cr, 6 parts | +25% scan at the start of every battle | `battle_stub.gd` via `GameState.module_scan_bonus()` |
| O2 Scrubber | 90 cr, 5 parts | +20 max O₂, rooms cost 6 O₂ instead of 8 | `GameState.o2_max_for_run()` / `o2_cost_per_room()` |
| Med Bay | 130 cr, 4 parts | +10% team HP after every cleared room | `GameState.complete_current_room()` |

Module data and tuning constants live in `scripts/data/ship_modules.gd`.

### Crew morale tiers

| Tier | Morale | Hub bark |
|------|--------|----------|
| Stoked | 80+ | Bread, humming, nobody mentions the fuel bill |
| Solid | 55–79 | Steady ship, complaints are all about the kettle |
| Frayed | 30–54 | Nobody is singing, Cookie rations the good tea |
| Grim | 0–29 | Galley is quiet in the way that is not restful |

Barks rotate from a pool per tier and hold steady until the tier changes.

### Phase 3b smoke test (headless)

```bash
godot --headless --path drift-tamers tests/phase3b_smoke.tscn
```

60 checks over resources, fuel gating, payouts by outcome, module effects, morale tiers, release, and the save round trip. It clears `user://stable.json` before and after, so do not run it on a save you care about. Exit code is non-zero when a check fails.

## Phase 3a manual test

1. **F5** from `ship_hub.tscn` (main scene).
2. Hub shows **five mission buttons** plus seven **locked** future types (tooltip: *Coming soon*).
3. Click a mission — **briefing** appears in the panel. Press **Deploy** to launch.
4. On the run screen, **Step into room** shows a mission **beat line** (insert room 1, complication ~2–3, crisis ~4–5) plus room effects in the log.
5. Finish via **Extract** or **Abort** — hub **Status** shows mission **debrief** (win / partial / fail) from `data/missions/*.json`, not generic contract copy.
6. **Last op** one-liner appears under the hub flavor text after a run.
7. **Survey** biases early scan rooms and uses Deep Scan O₂ cap (85). **Rescue** biases early **galley rest**. **Recovery** biases **vault loot**. **Bounty** adds an extra corridor fight. **Escort** needs a clean full clear for a win debrief.

### Mission data

| File | Type | Win lean |
|------|------|----------|
| `data/missions/survey.json` | Scan / data | `data_scanned` + rooms cleared |
| `data/missions/rescue.json` | Evac | Rest nodes + depth |
| `data/missions/recovery.json` | Assets | Consumables secured |
| `data/missions/bounty.json` | Warrant | Elite nest neutralized |
| `data/missions/escort.json` | VIP | Full deck extract |

Locked stubs live in `data/missions/locked_manifest.json` (types 6–12).

## Phase 2b manual test (still valid)

1. **F5** from `ship_hub.tscn` (main scene).
2. Mission-specific modifiers replace the old three contract presets (see Phase 3a table above).
3. On the run screen, confirm **Room N / Total** and **O₂ current / max** in the HUD.
4. **Step into room** — pays **−8 O₂** per room. If O₂ hits **0**, you are forced back to hub (no contract bonus).
5. **Non-fight rooms:** breach scan (+40% scan on next battle), galley rest (+15% HP, +5 O₂), vault loot (+1 consumable for payout).
6. **Fight rooms:** **Engage hostile** → battle spends **−5 O₂**; wild species is rolled from the JSON pool (elite nest uses the rare table).
7. **Scan** / **Attack** / **Bond** as in Phase 2a; successful bond adds the **actual wild species** to `user://stable.json`.
8. After a fight, **Leave encounter** returns to the run; room advances when the fight resolves.
9. **Extract** unlocks from **room 3 onward** (`room_index >= 2` before stepping in). Grants partial credits plus contract extract bonus.
10. **Abort** returns to hub with partial payout only (rooms cleared × 15 credits). Hub copy should reflect extract vs abort vs O₂ fail.

### Room templates (v1)

| Template | Effect |
|----------|--------|
| `corridor_fight` | Wild encounter |
| `breach_scan` | +40% scan on next battle |
| `galley_rest` | +15% team HP, +5 O₂ |
| `vault_loot` | +1 consumable |
| `nest_elite` | Fight with elite spawn table |

### Type chart (v1)

| Element | Strong vs | Weak vs |
|---------|-----------|---------|
| EM | Void | Kinetic |
| Thermal | Kinetic | EM |
| Void | EM | Thermal |
| Kinetic | Thermal | Void |

## Export targets

| Platform | Notes |
|----------|--------|
| **Web** | Project → Export → add **Web** preset; export for itch.io playtests (larger download; acceptable for hobby). |
| **Android** | Install Android build template / SDK via Godot editor, add **Android** preset, export APK or AAB for device tests. |

Export presets are not committed in Phase 1; create them locally after installing export templates.

## Repository layout

```
drift-tamers/
  project.godot
  data/species/    # JSON species definitions (8 roster + spacer lead)
  data/missions/   # Briefings, beats, debriefs (3a) + costs, payouts (3b)
  scenes/          # ShipHub, RunStub, BattleStub
  scripts/
    autoload/      # game_state.gd
    combat/        # battle_engine.gd
    data/          # species_data.gd, species_registry.gd, mission_registry.gd, ship_modules.gd
    run/           # room_deck.gd
  tests/           # phase3b_smoke.gd/.tscn (headless resource + module checks)
  CREDITS.md       # Intended CC0 sources
```

## Vision (one paragraph)

You run a found-family crew on a beat-up hauler in the outer belt. Contracts send you into procedural derelicts where illegal xeno life lurks; each **15–20 minute run** is scan, fight, bond, extract. Between runs, the **ship hub** is home: jobs, upgrades, and a stable of bonded creatures for the next dive. v1 is turn-based **3v3-style** encounters with sci-fi elements (EM, thermal, void), not a galaxy map or hundred-species dex.

Plan reference: project store `docs/pixel-art-game-plan.md`.

## License

Game code in this folder: follow the parent repository license. Third-party art will be documented in `CREDITS.md` as it is imported.