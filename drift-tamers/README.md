# Drift Tamers

Sci-fi roguelite monster tamer: a salvage crew boards derelicts, scans xeno fauna, and bonds aliens between tense jobs. Warm wit on the ship, Expanse-style grit in the wreck.

**Phase 2a** adds `GameState`, species JSON, and a real turn battle vs a wild **Hullmite** (types, HP, scan meter, bond odds).

## Open in Godot

1. Install **[Godot 4.3+](https://godotengine.org/download)** (4.x with GL Compatibility is fine).
2. In the Project Manager, **Import** → select this folder’s `project.godot`.
3. Press **F5** (Play). Flow: **Ship Hub** → **Derelict run** → **Battle** (Attack / Scan / Bond).

Pixel defaults are set in `project.godot`: **640×360** viewport, canvas stretch, **integer** scale mode, **nearest** texture filter, and 2D pixel snap.

## Phase 2a manual test (Hullmite fight)

1. **F5** from `ship_hub.tscn` (main scene).
2. **Start contract** → on the run screen, note **O₂** in the room label (starts at 100 after `GameState.start_run()`).
3. **Trigger encounter** → battle loads a wild **Hullmite** (Kinetic).
4. **Scan** twice to reach ~70% scan (35% per Scan). Log should show element and bond flavor text.
5. **Attack** until wild HP is low. Watch for **Type advantage!** / **Not very effective...** (Kinetic vs Kinetic is neutral).
6. **Bond** after scan ≥ 50%. Log shows roll vs computed odds; success adds the xeno to `user://stable.json` via `GameState.add_to_stable()`.
7. Confirm HUD: **Wild HP**, **Crew** HP (Spacer + bonded Hullmite), **Scan %**.
8. **Leave encounter** returns to the run stub; **Extract** or **Abort** calls `GameState.end_run()`.

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
  scenes/          # ShipHub, RunStub, BattleStub
  scripts/
    autoload/      # game_state.gd
    combat/        # battle_engine.gd
    data/          # species_data.gd, species_registry.gd
  CREDITS.md       # Intended CC0 sources
```

## Vision (one paragraph)

You run a found-family crew on a beat-up hauler in the outer belt. Contracts send you into procedural derelicts where illegal xeno life lurks; each **15–20 minute run** is scan, fight, bond, extract. Between runs, the **ship hub** is home: jobs, upgrades, and a stable of bonded creatures for the next dive. v1 is turn-based **3v3-style** encounters with sci-fi elements (EM, thermal, void), not a galaxy map or hundred-species dex.

Plan reference: project store `docs/pixel-art-game-plan.md`.

## License

Game code in this folder: follow the parent repository license. Third-party art will be documented in `CREDITS.md` as it is imported.