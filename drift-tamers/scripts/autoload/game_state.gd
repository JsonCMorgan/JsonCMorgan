extends Node
## Persistent meta, active run, party, and stable save stub.

const STABLE_SAVE_PATH := "user://stable.json"
const O2_START := 100
const O2_START_DEEP_SCAN := 85
const O2_PER_ROOM := 8
const O2_PER_FIGHT := 5

const HUB_LINES: Dictionary = {
	"idle": "Jobs board green. Crew owes you one decent run.",
	"extract_ok": "Airlock hisses. Samples stink like success. Cookie hid the good mugs again, but nobody's complaining.",
	"extract_partial": "You made it out with data and bruises. The crew calls it 'field research.' Finance will call it something else.",
	"abort": "Abort logged. Partial payout wired — next time we punch harder before the O₂ gauge sulks.",
	"o2_fail": "O₂ hit zero. Forced retreat, mission bonus gone. Bonded xen and shame are yours to keep.",
	"run_clear": "Full deck cleared. Even the derelict sounds impressed. Tea's on Cookie.",
}

var meta: Dictionary = {
	"credits": 0,
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


func start_run(mission_id: String = "survey") -> void:
	var mission := get_mission(mission_id)
	if mission.is_empty():
		mission_id = "survey"
		mission = get_mission(mission_id)
	var mods = mission.get("modifiers", {})
	if not mods is Dictionary:
		mods = {}
	var deep_scan := bool(mods.get("deep_scan", false))
	var o2_max := O2_START_DEEP_SCAN if deep_scan else O2_START
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
		result["message"] = "O₂ empty — forced retreat."
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


func complete_current_room() -> void:
	if not run.get("active", false):
		return
	run["rooms_cleared"] = int(run.get("rooms_cleared", 0)) + 1
	run["in_room"] = false
	run["room_index"] = int(run.get("room_index", 0)) + 1


func extract_run() -> void:
	var cleared_all := run_finished()
	run["last_exit_kind"] = "run_clear" if cleared_all else "extract_partial"
	_grant_partial_rewards(true)
	_finalize_mission_debrief()
	_end_run_internal()


func abort_run() -> void:
	run["last_exit_kind"] = "abort"
	_grant_partial_rewards(false)
	_finalize_mission_debrief()
	_end_run_internal()


func forced_o2_retreat() -> void:
	run["last_exit_kind"] = "o2_fail"
	_grant_partial_rewards(false)
	_finalize_mission_debrief()
	_end_run_internal()


func hub_status_line() -> String:
	if last_debrief != "":
		return last_debrief
	return str(HUB_LINES.get(last_hub_line_key, HUB_LINES["idle"]))


func hub_memory_line() -> String:
	if last_mission_memory != "":
		return "Last op: " + last_mission_memory
	return ""


func advance_room() -> void:
	if not run.get("active", false):
		return
	run["o2"] = maxi(0, int(run["o2"]) - O2_PER_ROOM)


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


func _grant_partial_rewards(full_extract: bool) -> void:
	var cleared := int(run.get("rooms_cleared", 0))
	var credits := cleared * 15
	if full_extract:
		var mission_id := str(run.get("mission_id", "survey"))
		var mission := get_mission(mission_id)
		var mods = mission.get("modifiers", {})
		if mods is Dictionary:
			credits += int(mods.get("extract_bonus", 25))
	var consumables := int(run.get("consumables", 0))
	meta["credits"] = int(meta.get("credits", 0)) + credits
	if consumables > 0:
		meta["reputation_independence"] = int(meta.get("reputation_independence", 0)) + consumables


func _apply_room_o2() -> void:
	run["o2"] = maxi(0, int(run["o2"]) - O2_PER_ROOM)


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
			return "Crew rested: +15% team HP, +5 O₂."
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
	_save_stable()


func _save_stable() -> void:
	var file := FileAccess.open(STABLE_SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_warning("GameState: could not write stable save")
		return
	file.store_string(JSON.stringify({"stable": stable}, "\t"))


func _load_stable() -> void:
	if not FileAccess.file_exists(STABLE_SAVE_PATH):
		stable = []
		return
	var file := FileAccess.open(STABLE_SAVE_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if parsed is Dictionary and parsed.get("stable") is Array:
		stable = parsed["stable"]