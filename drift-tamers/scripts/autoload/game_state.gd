extends Node
## Persistent meta, active run, party, and stable save stub.

const STABLE_SAVE_PATH := "user://stable.json"
const O2_START := 100
const O2_PER_ROOM := 8
const O2_PER_FIGHT := 5

var meta: Dictionary = {
	"credits": 0,
	"reputation_independence": 0,
	"reputation_corp": 0,
}

var run: Dictionary = {
	"active": false,
	"o2": O2_START,
	"room_index": 0,
	"contract_id": "",
}

## lead: Dictionary combatant template; bonds: two slots (null or dict).
var party: Dictionary = {
	"lead": {},
	"bonds": [null, null],
}

## Saved bonded xen outside active party (stable save stub).
var stable: Array = []


func _ready() -> void:
	_load_stable()
	if not run.get("active", false):
		_reset_party_for_new_run()
		run["active"] = false


func start_run(contract_id: String = "standard_salvage") -> void:
	run = {
		"active": true,
		"o2": O2_START,
		"room_index": 0,
		"contract_id": contract_id,
	}
	_reset_party_for_new_run()


func advance_room() -> void:
	if not run.get("active", false):
		return
	run["room_index"] = int(run.get("room_index", 0)) + 1
	run["o2"] = maxi(0, int(run["o2"]) - O2_PER_ROOM)


func spend_fight_o2() -> void:
	if not run.get("active", false):
		return
	run["o2"] = maxi(0, int(run["o2"]) - O2_PER_FIGHT)


func end_run() -> void:
	run["active"] = false
	run["room_index"] = 0
	run["o2"] = O2_START


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