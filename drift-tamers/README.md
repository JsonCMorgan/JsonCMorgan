# Drift Tamers

Sci-fi roguelite monster tamer: a salvage crew boards derelicts, scans xeno fauna, and bonds aliens between tense jobs. Warm wit on the ship, Expanse-style grit in the wreck. **Phase 1** is a scene-flow scaffold only (hub → run → battle stubs); gameplay systems land in Phase 2.

## Open in Godot

1. Install **[Godot 4.3+](https://godotengine.org/download)** (4.x with GL Compatibility is fine).
2. In the Project Manager, **Import** → select this folder’s `project.godot`.
3. Press **F5** (Play). Flow: **Ship Hub** → **Derelict run** → **Battle** (Attack / Scan / Bond).

Pixel defaults are set in `project.godot`: **640×360** viewport, canvas stretch, **integer** scale mode, **nearest** texture filter, and 2D pixel snap.

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
  scenes/          # ShipHub, RunStub, BattleStub
  scripts/         # GDScript stubs (TODO Phase 2)
  CREDITS.md       # Intended CC0 sources
```

## Vision (one paragraph)

You run a found-family crew on a beat-up hauler in the outer belt. Contracts send you into procedural derelicts where illegal xeno life lurks; each **15–20 minute run** is scan, fight, bond, extract. Between runs, the **ship hub** is home: jobs, upgrades, and a stable of bonded creatures for the next dive. v1 is turn-based **3v3-style** encounters with sci-fi elements (EM, thermal, void), not a galaxy map or hundred-species dex.

Plan reference: project store `docs/pixel-art-game-plan.md`.

## License

Game code in this folder: follow the parent repository license. Third-party art will be documented in `CREDITS.md` as it is imported.