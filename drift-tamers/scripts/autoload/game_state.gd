extends Node
## Persistent meta, active run, party, and stable save stub.

const STABLE_SAVE_PATH := "user://stable.json"
const O2_START := 100
const O2_START_DEEP_SCAN := 85
const O2_PER_ROOM := 8
const O2_PER_FIGHT := 5

const CONTRACTS: Dictionary = {
	"standard_salvage": {
		"display_name": "Standard Salvage",
		"summary": "No modifiers. Balanced tables and payout.",
		"deep_scan": false,
		"extra_fight": false,
		"extract_bonus": 25,
	},
	"corp_audit": {
		"display_name": "Corp Audit",
		"summary": "+1 security fight. Credits lean high if you extract clean.",
		"deep_scan": false,
		"extra_fight": true,
		"extract_bonus": 40,
	},
	"deep_scan": {
		"display_name": "Deep Scan",
		"summary": "Lower O₂ cap. Rare spawn table (Cryptid possible).",
		"deep_scan": true,
		"extra_fight": false,
		"extract_bonus": 35,
	},
}

const HUB_LINES: Dictionary = {
	"idle": "Jobs board green. Crew owes you one decent contract.",
	"extract_ok": "Airlock hisses. Samples stink like success. Cookie hid the good mugs again, but nobody's complaining.",
	"extract_partial": "You made it out with data and bruises. The crew calls it 'field research.' Finance will call it something else.",
	"abort": "Abort logged. Partial payout wired — next time we punch harder before the O₂ gauge sulks.",
	"o2_fail": "O₂ hit zero. Forced retreat, contract bonus gone. Bonded xen and shame are yours to keep.",
	"run_clear": "Full deck cleared. Even the derelict sounds impressed. Tea's on Cookie.",
}

var meta: Dictionary = {
	"credits": 0,
	"reputation_independence": 0,
	"reputation_corp": 0,
}

var run: Dictionary = {
	"active": false,
	"o2": O2_START,
	"o2_max": O2_START,
	"room_index": 0,
	"contract_id": "",
	"rooms": [],
	"in_room": false,
	"pending_wild_id": "",
	"next_scan_bonus": 0.0,
	"consumables": 0,
	"rooms_cleared": 0,
}

## lead: Dictionary combatant template; bonds: two slots (null or dict).
var party: Dictionary = {
	"lead": {},
	"bonds": [null, null],
}

var stable: Array = []
var last_hub_line_key: String = "idle"


func _ready() -> void:
	_load_stable()
	if not run.get("active", false):
		_reset_party_for_new_run()
		run["active"] = false


func get_contract(contract_id: String) -> Dictionary:
	return CONTRACTS.get(contract_id, CONTRACTS["standard_salvage"]).duplicate(true)


func contract_ids_for_board() -> PackedStringArray:
	return PackedStringArray(["standard_salvage", "corp_audit", "deep_scan"])


func start_run(contract_id: String = "standard_salvage") -> void:
	if not CONTRACTS.has(contract_id):
		contract_id = "standard_salvage"
	var contract := get_contract(contract_id)
	var deep_scan := bool(contract.get("deep_scan", false))
	var o2_max := O2_START_DEEP_SCAN if deep_scan else O2_START
	run = {
		"active": true,
		"o2": o2_max,
		"o2_max": o2_max,
		"room_index": 0,
		"contract_id": contract_id,
		"modifiers": {
			"deep_scan": deep_scan,
			"extra_fight": bool(contract.get("extra_fight", false)),
		},
		"rooms": RoomDeck.build_deck(contract_id),
		"in_room": false,
		"pending_wild_id": "",
		"next_scan_bonus": 0.0,
		"consumables": 0,
		"rooms_cleared": 0,
	}
	last_hub_line_key = "idle"
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


func step_into_room() -> Dictionary:
	var result := {"ok": false, "message": "", "o2_depleted": false}
	if not run.get("active", false) or run_finished():
		result["message"] = "No rooms left on this contract."
		return result
	if bool(run.get("in_room", false)):
		result["ok"] = true
		return result
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
	_grant_partial_rewards(true)
	if cleared_all:
		last_hub_line_key = "run_clear"
	else:
		last_hub_line_key = "extract_partial"
	_end_run_internal()


func abort_run() -> void:
	_grant_partial_rewards(false)
	last_hub_line_key = "abort"
	_end_run_internal()


func forced_o2_retreat() -> void:
	_grant_partial_rewards(false)
	last_hub_line_key = "o2_fail"
	_end_run_internal()


func hub_status_line() -> String:
	return str(HUB_LINES.get(last_hub_line_key, HUB_LINES["idle"]))


func advance_room() -> void:
	# Legacy hook; room advance is tied to complete_current_room in Phase 2b.
	if not run.get("active", false):
		return
	run["o2"] = maxi(0, int(run["o2"]) - O2_PER_ROOM)


func end_run() -> void:
	_end_run_internal()


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
		var contract := get_contract(str(run.get("contract_id", "standard_salvage")))
		credits += int(contract.get("extract_bonus", 20))
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
			return "Scan calibrators grabbed a +40% head start for the next battle."
		"galley_rest":
			_heal_party_percent(0.15)
			run["o2"] = mini(int(run.get("o2_max", O2_START)), int(run["o2"]) + 5)
			return "Crew rested: +15% team HP, +5 O₂."
		"vault_loot":
			run["consumables"] = int(run.get("consumables", 0)) + 1
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