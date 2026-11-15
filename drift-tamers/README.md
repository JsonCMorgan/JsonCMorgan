# Drift Tamers

Sci-fi roguelite monster tamer: a salvage crew boards derelicts, scans xeno fauna, and bonds aliens between tense jobs. Warm wit on the ship, Expanse-style grit in the wreck.

**Phase 2a** added `GameState`, species JSON, and turn battles with scan and bond.

**Phase 2b** added the **contract board**, **5-room run loop**, O₂ pressure, weighted wild encounters, and extract / abort payouts.

**Phase 3a** adds the **mission engine**: five playable mission types (Survey, Rescue, Recovery, Bounty, Escort), JSON briefings and story beats, mission-flavored debriefs on hub return, and types 6–12 shown as locked on the board.

## Open in Godot

1. Install **[Godot 4.3+](https://godotengine.org/download)** (4.x with GL Compatibility is fine).
2. In the Project Manager, **Import** → select this folder’s `project.godot`.
3. Press **F5** (Play). Flow: **Ship Hub** → pick a **mission** (briefing + Deploy) → **Derelict run** (rooms) → **Battle** when fights trigger.

Pixel defaults are set in `project.godot`: **640×360** viewport, canvas stretch, **integer** scale mode, **nearest** texture filter, and 2D pixel snap.

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
  data/missions/   # Mission briefings, beats, debriefs (Phase 3a)
  scenes/          # ShipHub, RunStub, BattleStub
  scripts/
    autoload/      # game_state.gd
    combat/        # battle_engine.gd
    data/          # species_data.gd, species_registry.gd, mission_registry.gd
    run/           # room_deck.gd
  CREDITS.md       # Intended CC0 sources
```

## Vision (one paragraph)

You run a found-family crew on a beat-up hauler in the outer belt. Contracts send you into procedural derelicts where illegal xeno life lurks; each **15–20 minute run** is scan, fight, bond, extract. Between runs, the **ship hub** is home: jobs, upgrades, and a stable of bonded creatures for the next dive. v1 is turn-based **3v3-style** encounters with sci-fi elements (EM, thermal, void), not a galaxy map or hundred-species dex.

Plan reference: project store `docs/pixel-art-game-plan.md`.

## License

Game code in this folder: follow the parent repository license. Third-party art will be documented in `CREDITS.md` as it is imported.