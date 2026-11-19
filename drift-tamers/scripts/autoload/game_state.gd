extends Node
## Persistent meta, active run, party, and stable save stub.

const STABLE_SAVE_PATH := "user://stable.json"
const SAVE_VERSION := 2
const O2_START := 100
const O2_START_DEEP_SCAN := 85
const O2_PER_ROOM := 8
const O2_PER_FIGHT := 5

const START_CREDITS := 120
const START_FUEL := 24
const START_PARTS := 4
const START_RESEARCH := 0
const START_MORALE := 62
const MORALE_MAX := 100
const DEFAULT_FUEL_COST := 12

const FUEL_CELL_FUEL := 10
const FUEL_CELL_CREDITS := 40
const SIPHON_FUEL := 6
const SIPHON_MORALE := 6
const RELEASE_RESEARCH := 2
const RELEASE_MORALE := 4
const SALVAGE_CREDITS_PER_ROOM := 5

const HUB_LINES: Dictionary = {
	"idle": "Jobs board green. Crew owes you one decent run.",
	"extract_ok": "Airlock hisses. Samples stink like success. Cookie hid the good mugs again, but nobody's complaining.",
	"extract_partial": "You made it out with data and bruises. The crew calls it 'field research.' Finance will call it something else.",
	"abort": "Abort logged. Partial payout wired — next time we punch harder before the O2 gauge sulks.",
	"o2_fail": "O2 hit zero. Forced retreat, mission bonus gone. Bonded xen and shame are yours to keep.",
	"run_clear": "Full deck cleared. Even the derelict sounds impressed. Tea's on Cookie.",
}

const MORALE_TIERS: Array = [
	{"id": "stoked", "min": 80, "label": "Stoked"},
	{"id": "solid", "min": 55, "label": "Solid"},
	{"id": "frayed", "min": 30, "label": "Frayed"},
	{"id": "grim", "min": 0, "label": "Grim"},
]

const MORALE_BARKS: Dictionary = {
	"stoked": [
		"Cookie baked actual bread. Hale is humming. Nobody has mentioned the fuel bill once.",
		"Crew is running drills for fun. Someone painted a mascot on the airlock and it is genuinely good.",
		"Morale is high enough that the coffee tastes intentional.",
	],
	"solid": [
		"Steady ship. Two complaints logged, both about the kettle.",
		"Hale says the drive sounds happy. That is as close to a compliment as the drive gets.",
		"Everyone is fed, nobody is bleeding, the board has work. Good day.",
	],
	"frayed": [
		"Nobody is singing. Cookie is rationing the good tea, which is how you know.",
		"Hale fixed the same panel twice and did not mention it. That is a tell.",
		"Crew is tired. Still showing up, but tired.",
	],
	"grim": [
		"The galley is quiet in the way that is not restful.",
		"Hale left a note instead of talking. It reads 'fix the ship or fix the crew.'",
		"Morale is thin. One more bad run and somebody takes a contract elsewhere.",
	],
}

var meta: Dictionary = {
	"credits": START_CREDITS,
	"fuel": START_FUEL,
	"parts": START_PARTS,
	"research": START_RESEARCH,
	"morale": START_MORALE,
	"modules": [],
	"reputation_independence": 0,
	"reputation_corp": 0,
	"missions_unlocked": ["survey", "rescue", "recovery", "bounty", "escort"],
}

var run: Dictionary = {
	"active": false,
	"o2": O2_START,
	"o2_max": O2_START,
	"room_index": 0,
	"mission_id": "",
	"contract_id": "",
	"rooms": [],
	"in_room": false,
	"pending_wild_id": "",
	"next_scan_bonus": 0.0,
	"consumables": 0,
	"rooms_cleared": 0,
	"mission_flags": {},
	"rest_rooms_found": 0,
	"last_exit_kind": "",
}

## lead: Dictionary combatant template; bonds: two slots (null or dict).
var party: Dictionary = {
	"lead": {},
	"bonds": [null, null],
}

var stable: Array = []
var last_hub_line_key: String = "idle"
var last_debrief: String = ""
var last_mission_memory: String = ""
var last_payout_summary: String = ""
var last_outcome: String = ""

var _bark_tier: String = ""
var _bark_line: String = ""


func _ready() -> void:
	_load_stable()
	if not run.get("active", false):
		_reset_party_for_new_run()
		run["active"] = false


func get_mission(mission_id: String) -> Dictionary:
	return MissionRegistry.get_mission(mission_id)


func mission_ids_for_board() -> PackedStringArray:
	var ids := MissionRegistry.playable_mission_ids()
	var unlocked = meta.get("missions_unlocked", [])
	var out: PackedStringArray = []
	for mid in ids:
		if mid in unlocked:
			out.append(mid)
	return out if out.size() > 0 else ids


## --- Resources -------------------------------------------------------------


func resource_amount(key: String) -> int:
	return int(meta.get(key, 0))


func resource_bar_text() -> String:
	return "CR %d   FUEL %d   PARTS %d   RSRCH %d   MRL %d" % [
		resource_amount("credits"),
		resource_amount("fuel"),
		resource_amount("parts"),
		resource_amount("research"),
		resource_amount("morale"),
	]


func mission_fuel_cost(mission_id: String) -> int:
	var mission := get_mission(mission_id)
	var costs = mission.get("costs", {})
	if not costs is Dictionary:
		return DEFAULT_FUEL_COST
	return int(costs.get("fuel", DEFAULT_FUEL_COST))


func cheapest_mission_fuel_cost() -> int:
	var cheapest := DEFAULT_FUEL_COST
	var first := true
	for mid in mission_ids_for_board():
		var cost := mission_fuel_cost(str(mid))
		if first or cost < cheapest:
			cheapest = cost
			first = false
	return cheapest


func can_deploy(mission_id: String) -> Dictionary:
	var cost := mission_fuel_cost(mission_id)
	var fuel := resource_amount("fuel")
	if fuel >= cost:
		return {"ok": true, "message": "", "cost": cost}
	var mission := get_mission(mission_id)
	var title := str(mission.get("display_name", mission_id))
	var message := (
		"Tanks read %d units. The %s burn needs %d. Hale will not light the drive on fumes, "
		+ "and Cookie's still does not count as jet fuel."
	) % [fuel, title, cost]
	return {"ok": false, "message": message, "cost": cost}


## Spends fuel and starts the mission. Returns {ok, message, cost}.
func try_deploy(mission_id: String) -> Dictionary:
	var check := can_deploy(mission_id)
	if not bool(check.get("ok", false)):
		return check
	var cost := int(check.get("cost", DEFAULT_FUEL_COST))
	_add_resource("fuel", -cost)
	start_run(mission_id)
	save_game()
	return {"ok": true, "message": "Burned %d fuel breaking dock." % cost, "cost": cost}


func fuel_cell_label() -> String:
	return "Buy fuel cell (+%d fuel / %d cr)" % [FUEL_CELL_FUEL, FUEL_CELL_CREDITS]


func can_buy_fuel_cell() -> bool:
	return resource_amount("credits") >= FUEL_CELL_CREDITS


func buy_fuel_cell() -> String:
	if not can_buy_fuel_cell():
		return "Not enough credits. The depot takes cash, sympathy, and nothing else."
	_add_resource("credits", -FUEL_CELL_CREDITS)
	_add_resource("fuel", FUEL_CELL_FUEL)
	save_game()
	return "One fuel cell aboard. Hale signs for it without reading, as usual."


## Last-resort fuel so a broke crew is never stranded at dock.
func siphon_available() -> bool:
	return not can_buy_fuel_cell() and resource_amount("fuel") < cheapest_mission_fuel_cost()


func siphon_label() -> String:
	return "Siphon the reserves (+%d fuel / -%d morale)" % [SIPHON_FUEL, SIPHON_MORALE]


func siphon_reserves() -> String:
	if not siphon_available():
		return "No need to touch the reserves yet."
	_add_resource("fuel", SIPHON_FUEL)
	adjust_morale(-SIPHON_MORALE)
	save_game()
	return "Cookie drains the backup still into the tanks and looks at you the whole time."


## --- Ship modules ----------------------------------------------------------


func owned_modules() -> Array:
	var mods = meta.get("modules", [])
	return mods if mods is Array else []


func has_module(module_id: String) -> bool:
	return module_id in owned_modules()


func can_buy_module(module_id: String) -> bool:
	var module := ShipModules.get_module(module_id)
	if module.is_empty() or has_module(module_id):
		return false
	return (
		resource_amount("credits") >= int(module.get("cost_credits", 0))
		and resource_amount("parts") >= int(module.get("cost_parts", 0))
	)


func buy_module(module_id: String) -> String:
	var module := ShipModules.get_module(module_id)
	if module.is_empty():
		return "No such module on the manifest."
	if has_module(module_id):
		return "%s is already bolted on." % str(module.get("display_name", module_id))
	if not can_buy_module(module_id):
		return "Short on parts or credits for the %s. Hale can wait, grumpily." % str(
			module.get("display_name", module_id)
		)
	_add_resource("credits", -int(module.get("cost_credits", 0)))
	_add_resource("parts", -int(module.get("cost_parts", 0)))
	var mods := owned_modules()
	mods.append(module_id)
	meta["modules"] = mods
	adjust_morale(3)
	save_game()
	return "%s installed. %s" % [str(module.get("display_name", module_id)), str(module.get("blurb", ""))]


func module_scan_bonus() -> float:
	return ShipModules.SCANNER_ARRAY_SCAN_BONUS if has_module("scanner_array") else 0.0


func o2_max_for_run(deep_scan: bool) -> int:
	var base := O2_START_DEEP_SCAN if deep_scan else O2_START
	if has_module("o2_scrubber"):
		base += ShipModules.O2_SCRUBBER_MAX_BONUS
	return base


func o2_cost_per_room() -> int:
	if has_module("o2_scrubber"):
		return maxi(1, O2_PER_ROOM - ShipModules.O2_SCRUBBER_ROOM_SAVING)
	return O2_PER_ROOM


## --- Crew morale -----------------------------------------------------------


func morale_tier() -> String:
	var morale := resource_amount("morale")
	for tier in MORALE_TIERS:
		if morale >= int((tier as Dictionary).get("min", 0)):
			return str((tier as Dictionary).get("id", "solid"))
	return "grim"


func morale_tier_label() -> String:
	var tier_id := morale_tier()
	for tier in MORALE_TIERS:
		if str((tier as Dictionary).get("id", "")) == tier_id:
			return str((tier as Dictionary).get("label", tier_id))
	return tier_id.capitalize()


## Warm bark for the hub. Stable until the morale tier changes.
func crew_bark() -> String:
	var tier_id := morale_tier()
	if tier_id != _bark_tier or _bark_line == "":
		var pool = MORALE_BARKS.get(tier_id, MORALE_BARKS["solid"])
		if pool is Array and (pool as Array).size() > 0:
			_bark_line = str((pool as Array).pick_random())
		_bark_tier = tier_id
	return _bark_line


func adjust_morale(delta: int) -> void:
	meta["morale"] = clampi(resource_amount("morale") + delta, 0, MORALE_MAX)


func release_from_stable(index: int) -> String:
	if index < 0 or index >= stable.size():
		return ""
	var creature = stable[index]
	var name := "the xeno"
	if creature is Dictionary:
		name = str((creature as Dictionary).get("nickname", "the xeno"))
	stable.remove_at(index)
	_add_resource("research", RELEASE_RESEARCH)
	adjust_morale(-RELEASE_MORALE)
	save_game()
	return (
		"%s goes back to the dark. You logged the field notes (+%d research), and the galley "
		+ "stays quiet for a while (-%d morale)."
	) % [name, RELEASE_RESEARCH, RELEASE_MORALE]


func start_run(mission_id: String = "survey") -> void:
	var mission := get_mission(mission_id)
	if mission.is_empty():
		mission_id = "survey"
		mission = get_mission(mission_id)
	var mods = mission.get("modifiers", {})
	if not mods is Dictionary:
		mods = {}
	var deep_scan := bool(mods.get("deep_scan", false))
	var o2_max := o2_max_for_run(deep_scan)
	run = {
		"active": true,
		"o2": o2_max,
		"o2_max": o2_max,
		"room_index": 0,
		"mission_id": mission_id,
		"contract_id": mission_id,
		"modifiers": {
			"deep_scan": deep_scan,
			"extra_fight": bool(mods.get("extra_fight", false)),
		},
		"rooms": RoomDeck.build_deck(mission_id, mission),
		"in_room": false,
		"pending_wild_id": "",
		"next_scan_bonus": 0.0,
		"consumables": 0,
		"rooms_cleared": 0,
		"mission_flags": {},
		"rest_rooms_found": 0,
		"last_exit_kind": "",
	}
	last_hub_line_key = "idle"
	last_debrief = ""
	last_payout_summary = ""
	_reset_party_for_new_run()


func run_finished() -> bool:
	if not run.get("active", false):
		return true
	return int(run.get("room_index", 0)) >= _rooms().size()


func total_rooms() -> int:
	return _rooms().size()


func current_room_id() -> String:
	var rooms := _rooms()
	var idx := int(run.get("room_index", 0))
	if idx < 0 or idx >= rooms.size():
		return ""
	return str(rooms[idx])


func can_extract() -> bool:
	if not run.get("active", false):
		return false
	return int(run.get("room_index", 0)) >= 2


func mission_beat_for_current_room() -> String:
	if not run.get("active", false):
		return ""
	var mission_id := str(run.get("mission_id", "survey"))
	var idx := int(run.get("room_index", 0))
	return MissionRegistry.mission_beat_line(mission_id, idx)


func set_mission_flag(flag: String, value: bool = true) -> void:
	var flags = run.get("mission_flags", {})
	if not flags is Dictionary:
		flags = {}
	flags[flag] = value
	run["mission_flags"] = flags


func note_fight_won(elite_room: bool) -> void:
	if elite_room:
		set_mission_flag("target_neutralized", true)
	set_mission_flag("fights_won", true)


func step_into_room() -> Dictionary:
	var result := {"ok": false, "message": "", "o2_depleted": false, "beat_line": ""}
	if not run.get("active", false) or run_finished():
		result["message"] = "No rooms left on this mission."
		return result
	if bool(run.get("in_room", false)):
		result["ok"] = true
		return result
	result["beat_line"] = mission_beat_for_current_room()
	_apply_room_o2()
	result["o2_depleted"] = int(run["o2"]) <= 0
	if result["o2_depleted"]:
		result["message"] = "O2 empty — forced retreat."
		return result
	run["in_room"] = true
	var room_id := current_room_id()
	var effect := _resolve_non_fight_room(room_id)
	result["ok"] = true
	result["room_id"] = room_id
	result["effect"] = effect
	return result


func prepare_fight_encounter() -> String:
	var room_id := current_room_id()
	var elite := RoomDeck.is_elite_room(room_id)
	run["current_fight_elite"] = elite
	var deep := bool(run.get("modifiers", {}).get("deep_scan", false))
	var wild_id := RoomDeck.pick_wild(deep, elite)
	run["pending_wild_id"] = wild_id
	return wild_id


func consume_pending_wild() -> String:
	var wild_id := str(run.get("pending_wild_id", "hullmite"))
	if wild_id == "":
		wild_id = "hullmite"
	run["pending_wild_id"] = ""
	return wild_id


func current_fight_is_elite() -> bool:
	return bool(run.get("current_fight_elite", false))


func take_next_scan_bonus() -> float:
	var bonus := float(run.get("next_scan_bonus", 0.0))
	run["next_scan_bonus"] = 0.0
	return bonus


func spend_fight_o2() -> void:
	if not run.get("active", false):
		return
	run["o2"] = maxi(0, int(run["o2"]) - O2_PER_FIGHT)


## Returns a module effect line for the run log, or "" when nothing fired.
func complete_current_room() -> String:
	if not run.get("active", false):
		return ""
	run["rooms_cleared"] = int(run.get("rooms_cleared", 0)) + 1
	run["in_room"] = false
	run["room_index"] = int(run.get("room_index", 0)) + 1
	if has_module("med_bay"):
		_heal_party_percent(ShipModules.MED_BAY_HEAL_RATIO)
		return "Med Bay cycles between rooms: +%d%% team HP." % int(
			round(ShipModules.MED_BAY_HEAL_RATIO * 100.0)
		)
	return ""


func extract_run() -> void:
	var cleared_all := run_finished()
	run["last_exit_kind"] = "run_clear" if cleared_all else "extract_partial"
	_finalize_mission_debrief()
	_grant_mission_payout(last_outcome, true)
	_end_run_internal()


func abort_run() -> void:
	run["last_exit_kind"] = "abort"
	_finalize_mission_debrief()
	_grant_mission_payout(last_outcome, false)
	_end_run_internal()


func forced_o2_retreat() -> void:
	run["last_exit_kind"] = "o2_fail"
	_finalize_mission_debrief()
	_grant_mission_payout(last_outcome, false)
	_end_run_internal()


func hub_status_line() -> String:
	if last_debrief != "":
		return last_debrief
	return str(HUB_LINES.get(last_hub_line_key, HUB_LINES["idle"]))


func hub_memory_line() -> String:
	if last_mission_memory != "":
		return "Last op: " + last_mission_memory
	return ""


func hub_payout_line() -> String:
	return last_payout_summary


func advance_room() -> void:
	if not run.get("active", false):
		return
	run["o2"] = maxi(0, int(run["o2"]) - o2_cost_per_room())


func end_run() -> void:
	_end_run_internal()


func _finalize_mission_debrief() -> void:
	var outcome := _evaluate_mission_outcome()
	var mission_id := str(run.get("mission_id", "survey"))
	var mission := get_mission(mission_id)
	var debrief = mission.get("debrief", {})
	if not debrief is Dictionary:
		debrief = {}
	var text := str(debrief.get(outcome, debrief.get("partial", "")))
	if text == "":
		text = str(HUB_LINES.get(str(run.get("last_exit_kind", "abort")), HUB_LINES["abort"]))
	last_debrief = text
	last_outcome = outcome
	var display := str(mission.get("board_title", mission.get("display_name", mission_id)))
	last_mission_memory = "%s — %s" % [display, outcome.capitalize()]
	last_hub_line_key = "idle"


func _evaluate_mission_outcome() -> String:
	var exit_kind := str(run.get("last_exit_kind", "abort"))
	var flags = run.get("mission_flags", {})
	if not flags is Dictionary:
		flags = {}
	var cleared := int(run.get("rooms_cleared", 0))
	var mission_id := str(run.get("mission_id", "survey"))
	var mission := get_mission(mission_id)
	var win_cfg = mission.get("win_flags", {})
	if not win_cfg is Dictionary:
		win_cfg = {}

	if exit_kind == "abort" and bool(win_cfg.get("fail_on_abort", false)):
		return "fail"
	if exit_kind == "o2_fail":
		if bool(win_cfg.get("fail_on_o2", false)):
			return "fail"
		return "fail"

	match mission_id:
		"survey":
			if bool(flags.get("data_scanned", false)) and cleared >= int(win_cfg.get("win_min_rooms", 4)):
				return "win"
			if bool(flags.get("data_scanned", false)) or cleared >= 2:
				return "partial"
			return "fail"
		"rescue":
			var rests := int(run.get("rest_rooms_found", 0))
			if rests >= int(win_cfg.get("partial_min_rest", 1)) and cleared >= int(win_cfg.get("win_min_rooms", 4)):
				set_mission_flag("survivors_evacuated", true)
				return "win"
			if rests >= 1 or cleared >= 3:
				return "partial"
			return "fail"
		"recovery":
			var consumables := int(run.get("consumables", 0))
			if bool(flags.get("assets_secured", false)) and consumables >= int(win_cfg.get("win_min_consumables", 1)):
				return "win"
			if consumables >= 1 or cleared >= 3:
				return "partial"
			return "fail"
		"bounty":
			if bool(flags.get("target_neutralized", false)):
				return "win"
			if cleared >= 3:
				return "partial"
			return "fail"
		"escort":
			if exit_kind == "run_clear" and exit_kind != "o2_fail" and exit_kind != "abort":
				set_mission_flag("vip_intact", true)
				return "win"
			if exit_kind == "extract_partial" and cleared >= 3:
				return "partial"
			return "fail"
		_:
			if exit_kind == "run_clear":
				return "win"
			if exit_kind in ["extract_partial", "o2_fail"]:
				return "partial"
			return "fail"


func _end_run_internal() -> void:
	run["active"] = false
	run["room_index"] = 0
	run["in_room"] = false
	run["pending_wild_id"] = ""
	run["o2"] = O2_START
	run["o2_max"] = O2_START


## Mission payout: per-type table from JSON, scaled by outcome, plus salvage per room.
func _grant_mission_payout(outcome: String, full_extract: bool) -> void:
	var mission_id := str(run.get("mission_id", "survey"))
	var mission := get_mission(mission_id)
	var payouts = mission.get("payout", {})
	if not payouts is Dictionary:
		payouts = {}
	var reward = payouts.get(outcome, payouts.get("partial", {}))
	if not reward is Dictionary:
		reward = {}

	var cleared := int(run.get("rooms_cleared", 0))
	var credits := int(reward.get("credits", 0)) + cleared * SALVAGE_CREDITS_PER_ROOM
	if full_extract:
		var mods = mission.get("modifiers", {})
		if mods is Dictionary:
			credits += int(mods.get("extract_bonus", 25))
	var parts := int(reward.get("parts", 0))
	var research := int(reward.get("research", 0))
	var morale := int(reward.get("morale", 0))

	_add_resource("credits", credits)
	_add_resource("parts", parts)
	_add_resource("research", research)
	adjust_morale(morale)

	var consumables := int(run.get("consumables", 0))
	if consumables > 0:
		meta["reputation_independence"] = int(meta.get("reputation_independence", 0)) + consumables

	last_payout_summary = "Payout: %+d cr, %+d parts, %+d research, morale %+d" % [
		credits, parts, research, morale
	]
	save_game()


func _add_resource(key: String, delta: int) -> void:
	meta[key] = maxi(0, int(meta.get(key, 0)) + delta)


func _apply_room_o2() -> void:
	run["o2"] = maxi(0, int(run["o2"]) - o2_cost_per_room())


func _resolve_non_fight_room(room_id: String) -> String:
	if RoomDeck.is_fight_room(room_id):
		return "fight_pending"
	match room_id:
		"breach_scan":
			run["next_scan_bonus"] = 0.4
			set_mission_flag("data_scanned", true)
			return "Scan calibrators grabbed a +40% head start for the next battle."
		"galley_rest":
			_heal_party_percent(0.15)
			run["o2"] = mini(int(run.get("o2_max", O2_START)), int(run["o2"]) + 5)
			run["rest_rooms_found"] = int(run.get("rest_rooms_found", 0)) + 1
			set_mission_flag("survivors_evacuated", int(run["rest_rooms_found"]) >= 1)
			return "Crew rested: +15% team HP, +5 O2."
		"vault_loot":
			run["consumables"] = int(run.get("consumables", 0)) + 1
			set_mission_flag("assets_secured", true)
			return "Pocketed one consumable for extract payout."
		_:
			return "Room noted. Moving on."


func _heal_party_percent(ratio: float) -> void:
	_heal_combatant(party["lead"], ratio)
	for i in party["bonds"].size():
		if party["bonds"][i] != null:
			_heal_combatant(party["bonds"][i], ratio)


func _heal_combatant(unit: Dictionary, ratio: float) -> void:
	if unit.is_empty():
		return
	var max_hp := int(unit.get("max_hp", 1))
	var heal := int(round(float(max_hp) * ratio))
	unit["hp"] = mini(max_hp, int(unit.get("hp", 0)) + heal)
	if int(unit["hp"]) > 0:
		unit["fainted"] = false


func _rooms() -> Array:
	var rooms = run.get("rooms", [])
	return rooms if rooms is Array else []


func make_combatant(species_id: String, nickname: String = "", level_scale: float = 1.0) -> Dictionary:
	var species := SpeciesRegistry.get_species(species_id)
	if species == null:
		return {}
	var max_hp := int(round(float(species.base_hp) * level_scale))
	return {
		"species_id": species.id,
		"nickname": nickname if nickname != "" else species.display_name,
		"element": species.element,
		"max_hp": max_hp,
		"hp": max_hp,
		"fainted": false,
	}


func _reset_party_for_new_run() -> void:
	party["lead"] = make_combatant("spacer", "Spacer")
	var hullmite := make_combatant("hullmite", "Shellback")
	party["bonds"] = [hullmite, null]


func add_to_stable(creature: Dictionary) -> void:
	if creature.is_empty():
		return
	stable.append(creature.duplicate(true))
	save_game()


## Stable plus meta resources share one save file (v1 saves still load).
func save_game() -> void:
	var file := FileAccess.open(STABLE_SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_warning("GameState: could not write save")
		return
	var payload := {
		"version": SAVE_VERSION,
		"stable": stable,
		"meta": meta,
	}
	file.store_string(JSON.stringify(payload, "\t"))


func _load_stable() -> void:
	if not FileAccess.file_exists(STABLE_SAVE_PATH):
		stable = []
		return
	var file := FileAccess.open(STABLE_SAVE_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary:
		return
	var data := parsed as Dictionary
	if data.get("stable") is Array:
		stable = data["stable"]
	var saved = data.get("meta", {})
	if saved is Dictionary:
		_merge_saved_meta(saved as Dictionary)


func _merge_saved_meta(saved: Dictionary) -> void:
	for key in ["credits", "fuel", "parts", "research", "morale"]:
		if saved.has(key):
			meta[key] = int(saved[key])
	meta["morale"] = clampi(int(meta.get("morale", START_MORALE)), 0, MORALE_MAX)
	for key in ["reputation_independence", "reputation_corp"]:
		if saved.has(key):
			meta[key] = int(saved[key])
	if saved.get("modules") is Array:
		var known := ShipModules.module_ids()
		var owned: Array = []
		for module_id in saved["modules"]:
			if str(module_id) in known and not str(module_id) in owned:
				owned.append(str(module_id))
		meta["modules"] = owned
	if saved.get("missions_unlocked") is Array:
		meta["missions_unlocked"] = saved["missions_unlocked"]