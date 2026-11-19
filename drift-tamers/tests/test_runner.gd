extends Node
## Headless unit tests. Run: godot --headless --path . res://tests/test_runner.tscn

const REQUIRED_MISSION_FIELDS: PackedStringArray = [
	"id", "type_number", "display_name", "board_title", "briefing", "beats", "debrief", "modifiers", "win_flags",
]
const REQUIRED_BEATS: PackedStringArray = ["insert", "complication", "crisis"]
const REQUIRED_DEBRIEF: PackedStringArray = ["win", "partial", "fail"]
const REQUIRED_SPECIES_FIELDS: PackedStringArray = [
	"id", "display_name", "element", "base_hp", "base_attack", "abilities",
]
const ELEMENTS: PackedStringArray = ["kinetic", "em", "thermal", "void"]

var _failures: Array[String] = []
var _checks := 0
var _current := ""


func _ready() -> void:
	seed(1234)
	var suites := [
		"test_type_chart",
		"test_damage",
		"test_bond_chance_bounds",
		"test_elite_void_nest_fainted_lead",
		"test_room_deck_size",
		"test_extract_gating",
		"test_o2_zero_forces_retreat",
		"test_mission_json",
		"test_species_json",
	]
	for suite in suites:
		_current = suite
		call(suite)
		GameState.end_run()
	print("")
	if _failures.is_empty():
		print("TESTS PASSED: %d checks across %d suites" % [_checks, suites.size()])
		get_tree().quit(0)
	else:
		for f in _failures:
			printerr("FAIL " + f)
		printerr("TESTS FAILED: %d of %d checks" % [_failures.size(), _checks])
		get_tree().quit(1)


func check(cond: bool, msg: String) -> void:
	_checks += 1
	if not cond:
		_failures.append("[%s] %s" % [_current, msg])


func check_eq(actual: Variant, expected: Variant, msg: String) -> void:
	check(actual == expected, "%s (expected %s, got %s)" % [msg, str(expected), str(actual)])


func test_type_chart() -> void:
	var engine := BattleEngine.new()
	var strong := {"em": "void", "thermal": "kinetic", "void": "em", "kinetic": "thermal"}
	var weak := {"em": "kinetic", "thermal": "em", "void": "thermal", "kinetic": "void"}
	for atk in ELEMENTS:
		for def in ELEMENTS:
			var expected := BattleEngine.NEUTRAL_MULT
			if strong[atk] == def:
				expected = BattleEngine.STRONG_MULT
			elif weak[atk] == def:
				expected = BattleEngine.WEAK_MULT
			check_eq(engine.get_type_multiplier(atk, def), expected, "%s -> %s" % [atk, def])
	check_eq(engine.get_type_multiplier("EM", "Void"), BattleEngine.STRONG_MULT, "chart is case-insensitive")
	check_eq(engine.get_type_multiplier("bogus", "em"), BattleEngine.NEUTRAL_MULT, "unknown element is neutral")


func test_damage() -> void:
	var engine := BattleEngine.new()
	var lead := GameState.make_combatant("spacer")
	var bond := GameState.make_combatant("hullmite")
	engine.start_encounter("ashling", [lead, bond])
	check_eq(int(engine.wild["hp"]), 38, "ashling spawns at base hp")
	var before_ally_hp := int(engine.allies[0]["hp"])
	engine.player_attack()
	# Spacer kinetic 9 x1.5 vs thermal = 14; Hullmite support round(8*0.35)=3 x1.5 = 5.
	check_eq(int(engine.wild["hp"]), 38 - 14 - 5, "lead + support damage with type advantage")
	# Ashling Char Nip 10 thermal vs kinetic spacer = 15.
	check_eq(int(engine.allies[0]["hp"]), before_ally_hp - 15, "wild counterattack with type advantage")
	check(not engine.battle_over, "battle continues after one exchange")

	var e2 := BattleEngine.new()
	e2.start_encounter("nullfin", [GameState.make_combatant("spacer")])
	e2.player_attack()
	# Kinetic weak vs void: round(9*0.75)=7.
	check_eq(int(e2.wild["hp"]), 36 - 7, "resisted damage")

	var e3 := BattleEngine.new()
	var ended := [false]
	e3.battle_ended.connect(func(victory: bool, _bonded: bool) -> void: ended[0] = victory)
	e3.start_encounter("relaybat", [GameState.make_combatant("spacer")])
	e3.wild["hp"] = 1
	e3.player_attack()
	check(e3.battle_over and ended[0], "killing blow ends battle with victory")
	check_eq(int(e3.wild["hp"]), 0, "hp floors at zero")

	var e4 := BattleEngine.new()
	var fainted_lead := GameState.make_combatant("spacer")
	fainted_lead["hp"] = 0
	fainted_lead["fainted"] = true
	e4.start_encounter("ashling", [fainted_lead, GameState.make_combatant("hullmite")])
	e4.player_attack()
	# Hullmite steps up as lead: 8 x1.5 = 12.
	check_eq(int(e4.wild["hp"]), 38 - 12, "living bond attacks when lead is down")
	check(not e4.party_wiped(), "party not wiped while a bond stands")

	var e5 := BattleEngine.new()
	var lost := [false]
	e5.battle_ended.connect(func(victory: bool, _bonded: bool) -> void: lost[0] = not victory)
	e5.start_encounter("ashling", [fainted_lead])
	e5.player_attack()
	check(e5.party_wiped() and e5.battle_over and lost[0], "all-fainted party ends battle as a loss")


func test_bond_chance_bounds() -> void:
	var engine := BattleEngine.new()
	check_eq(engine.bond_chance(), 0.0, "no wild means zero chance")
	engine.start_encounter("hullmite", [GameState.make_combatant("spacer")])
	check(is_equal_approx(engine.bond_chance(), BattleEngine.BOND_BASE), "full hp, no scan = base chance")
	check(not engine.can_bond_attempt(), "bond locked below 50% scan")
	engine.player_scan()
	engine.player_scan()
	check(engine.can_bond_attempt(), "bond unlocked at 70% scan")

	engine.wild_enraged = true
	engine.wild["hp"] = engine.wild["max_hp"]
	engine.scan_meter = 0.0
	check(is_equal_approx(engine.bond_chance(), 0.05), "enraged full-hp chance clamps to 5%")

	engine.wild_enraged = false
	engine.wild_pacified = true
	engine.scan_meter = 1.0
	engine.wild["hp"] = 0
	check(is_equal_approx(engine.bond_chance(), 0.85), "best case = base + hp + scan + pacified")

	for i in 200:
		engine.wild["hp"] = randi_range(0, int(engine.wild["max_hp"]))
		engine.scan_meter = randf()
		engine.wild_enraged = randf() < 0.5
		engine.wild_pacified = randf() < 0.5
		var c := engine.bond_chance()
		if c < 0.05 or c > 0.95:
			check(false, "chance %.3f out of [0.05, 0.95]" % c)
			return
	check(true, "200 random states within bounds")


func test_elite_void_nest_fainted_lead() -> void:
	# Regression: Kinetic lead at 0 HP vs an elite Void nest logged "Lead cannot act" with no way to resolve.
	for wild_id in ["cryptid", "nullfin"]:
		check(wild_id in RoomDeck.WILD_WEIGHTS_ELITE.map(func(e): return e["id"]), "%s spawns in elite nests" % wild_id)
		var engine := BattleEngine.new()
		var lead := GameState.make_combatant("spacer", "Spacer")
		lead["hp"] = 0
		lead["fainted"] = true
		var bond := GameState.make_combatant("hullmite", "Shellback")
		engine.start_encounter(wild_id, [lead, bond])
		var start_hp := int(engine.wild["hp"])
		engine.player_attack()
		check(int(engine.wild["hp"]) < start_hp, "%s: living bond deals damage when lead is down" % wild_id)
		check(not engine.log_lines.has("Lead cannot act."), "%s: no 'Lead cannot act' while a bond stands" % wild_id)
		var guard := 0
		while not engine.battle_over and guard < 50:
			engine.player_attack()
			guard += 1
		check(engine.battle_over, "%s: fight resolves (win or wipe) by attacking" % wild_id)
func test_room_deck_size() -> void:
	for mid in MissionRegistry.playable_mission_ids():
		var mission := MissionRegistry.get_mission(mid)
		var extra := bool(mission.get("modifiers", {}).get("extra_fight", false))
		var expected := 6 if extra else 5
		for i in 10:
			var deck := RoomDeck.build_deck(mid, mission)
			check_eq(deck.size(), expected, "%s deck size" % mid)
			for room in RoomDeck.BASE_TEMPLATES:
				check(deck.has(room), "%s deck contains %s" % [mid, room])
	for i in 20:
		var deck := RoomDeck.build_deck("survey", MissionRegistry.get_mission("survey"))
		check(deck.find("breach_scan") <= 1, "survey biases breach_scan to front")
	for i in 50:
		check(RoomDeck.pick_wild(randf() < 0.5, randf() < 0.5) != "", "pick_wild returns an id")
		var sid := RoomDeck.pick_wild(true, true)
		check(SpeciesRegistry.get_species(sid) != null, "picked wild %s exists" % sid)


func test_extract_gating() -> void:
	GameState.start_run("survey")
	check(not GameState.can_extract(), "no extract in room 1")
	GameState.complete_current_room()
	check(not GameState.can_extract(), "no extract in room 2")
	GameState.complete_current_room()
	check(GameState.can_extract(), "extract allowed from room 3")
	GameState.end_run()
	check(not GameState.can_extract(), "no extract without active run")


func test_o2_zero_forces_retreat() -> void:
	GameState.start_run("bounty")
	GameState.run["o2"] = GameState.O2_PER_ROOM - 1
	var result := GameState.step_into_room()
	check(not result["ok"], "step refused when O2 runs out")
	check(result["o2_depleted"], "o2_depleted flag set")
	check_eq(int(GameState.run["o2"]), 0, "O2 floors at zero")
	GameState.forced_o2_retreat()
	check(not GameState.run["active"], "retreat ends the run")
	check_eq(str(GameState.run["last_exit_kind"]), "o2_fail", "exit kind recorded")
	var fail_text := str(GameState.get_mission("bounty")["debrief"]["fail"])
	check_eq(GameState.hub_status_line(), fail_text, "hub shows mission fail debrief")

	GameState.start_run("survey")
	check_eq(int(GameState.run["o2_max"]), GameState.O2_START_DEEP_SCAN, "deep scan mission starts with less O2")


func test_mission_json() -> void:
	var files := DirAccess.get_files_at(MissionRegistry.MISSIONS_DIR)
	var seen: PackedStringArray = []
	for file_name in files:
		if not file_name.ends_with(".json") or file_name == MissionRegistry.LOCKED_MANIFEST:
			continue
		var mid := file_name.trim_suffix(".json")
		seen.append(mid)
		var m := MissionRegistry.get_mission(mid)
		check(not m.is_empty(), "%s parses" % mid)
		for field in REQUIRED_MISSION_FIELDS:
			check(m.has(field), "%s has %s" % [mid, field])
		check_eq(str(m.get("id")), mid, "%s id matches filename" % mid)
		check(str(m.get("briefing", "")).strip_edges() != "", "%s briefing beat non-empty" % mid)
		var beats: Dictionary = m.get("beats", {})
		for b in REQUIRED_BEATS:
			check(str(beats.get(b, "")).strip_edges() != "", "%s beat %s non-empty" % [mid, b])
		var debrief: Dictionary = m.get("debrief", {})
		for d in REQUIRED_DEBRIEF:
			check(str(debrief.get(d, "")).strip_edges() != "", "%s debrief %s non-empty" % [mid, d])
		for room_idx in 6:
			check(MissionRegistry.mission_beat_line(mid, room_idx) != "", "%s beat for room %d" % [mid, room_idx + 1])
	for mid in MissionRegistry.playable_mission_ids():
		check(mid in seen, "playable mission %s has a JSON file" % mid)
	var locked := MissionRegistry.locked_mission_entries()
	check_eq(locked.size(), 7, "seven locked mission stubs")


func test_species_json() -> void:
	var ids := SpeciesRegistry.all_species_ids()
	check(ids.size() >= 9, "at least 9 species found")
	for sid in ids:
		var f := FileAccess.open(SpeciesRegistry.SPECIES_DIR + sid + ".json", FileAccess.READ)
		var raw: Variant = JSON.parse_string(f.get_as_text())
		check(raw is Dictionary, "%s parses" % sid)
		if not raw is Dictionary:
			continue
		for field in REQUIRED_SPECIES_FIELDS:
			check(raw.has(field), "%s has %s" % [sid, field])
		var s := SpeciesRegistry.get_species(sid)
		check(s != null, "%s loads via registry" % sid)
		if s == null:
			continue
		check_eq(s.id, sid, "%s id matches filename" % sid)
		check(s.element in ELEMENTS, "%s element %s is valid" % [sid, s.element])
		check(s.base_hp > 0 and s.base_attack > 0, "%s has positive stats" % sid)
		check(not s.abilities.is_empty(), "%s has abilities" % sid)
		for ab in s.abilities:
			check(ab.has("id") and ab.has("name") and ab.has("power"), "%s ability fields" % sid)
	for table in [RoomDeck.WILD_WEIGHTS_STANDARD, RoomDeck.WILD_WEIGHTS_DEEP, RoomDeck.WILD_WEIGHTS_ELITE, RoomDeck.WILD_WEIGHTS_ELITE_DEEP]:
		for entry in table:
			check(str(entry["id"]) in ids, "encounter table species %s exists" % entry["id"])
