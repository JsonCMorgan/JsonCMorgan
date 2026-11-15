class_name BattleEngine
extends RefCounted
## Turn-based 1v3 encounter resolver: type chart, scan meter, bond rolls.

enum Element { KINETIC, EM, THERMAL, VOID }

const STRONG_MULT := 1.5
const WEAK_MULT := 0.75
const NEUTRAL_MULT := 1.0

const BOND_BASE := 0.15
const BOND_HP_FACTOR := 0.35
const BOND_SCAN_BONUS := 0.25
const BOND_PACIFIED_BONUS := 0.10
const BOND_ENRAGED_PENALTY := 0.15

const SCAN_PER_ACTION := 0.35

## Strong vs -> weak defender element (attacker strong)
const TYPE_STRONG: Dictionary = {
	"em": "void",
	"thermal": "kinetic",
	"void": "em",
	"kinetic": "thermal",
}

## Attacker weak vs defender (defender element key when attacker is weak)
const TYPE_WEAK: Dictionary = {
	"em": "kinetic",
	"thermal": "em",
	"void": "thermal",
	"kinetic": "void",
}

signal state_changed
signal battle_ended(victory: bool, bonded: bool)

var wild: Dictionary = {}
var allies: Array = []
var scan_meter: float = 0.0
var wild_enraged: bool = false
var wild_pacified: bool = false
var battle_over: bool = false
var bonded: bool = false
var log_lines: Array[String] = []


func start_encounter(wild_species_id: String, ally_snapshots: Array, initial_scan: float = 0.0) -> void:
	battle_over = false
	bonded = false
	scan_meter = clampf(initial_scan, 0.0, 1.0)
	wild_enraged = false
	wild_pacified = false
	log_lines.clear()
	wild = _spawn_from_species(wild_species_id, 1.0)
	wild["is_wild"] = true
	allies = []
	for snap in ally_snapshots:
		if snap == null:
			continue
		var copy: Dictionary = snap.duplicate(true)
		copy["is_wild"] = false
		allies.append(copy)
	var species := SpeciesRegistry.get_species(wild_species_id)
	var name := species.display_name if species else wild_species_id
	_log("Wild [i]%s[/i] blocks the corridor." % name)
	_log("Your crew is ready. Choose Attack, Scan, or Bond.")
	state_changed.emit()


func get_type_multiplier(attacker_element: String, defender_element: String) -> float:
	var atk := attacker_element.to_lower()
	var def := defender_element.to_lower()
	if TYPE_STRONG.get(atk, "") == def:
		return STRONG_MULT
	if TYPE_WEAK.get(atk, "") == def:
		return WEAK_MULT
	return NEUTRAL_MULT


func type_advantage_text(attacker_element: String, defender_element: String) -> String:
	var mult := get_type_multiplier(attacker_element, defender_element)
	if mult > 1.0:
		return "Type advantage!"
	if mult < 1.0:
		return "Not very effective..."
	return ""


func bond_chance() -> float:
	if wild.is_empty():
		return 0.0
	var hp_ratio := float(wild["hp"]) / float(maxi(wild["max_hp"], 1))
	var chance := BOND_BASE
	chance += BOND_HP_FACTOR * (1.0 - hp_ratio)
	if scan_meter >= 1.0:
		chance += BOND_SCAN_BONUS
	if wild_pacified:
		chance += BOND_PACIFIED_BONUS
	if wild_enraged:
		chance -= BOND_ENRAGED_PENALTY
	return clampf(chance, 0.05, 0.95)


func can_bond_attempt() -> bool:
	return not battle_over and scan_meter >= 0.5 and int(wild.get("hp", 0)) > 0


func player_attack() -> void:
	if battle_over:
		return
	var lead := _lead()
	if lead.is_empty() or lead.get("fainted", false):
		_log("Lead cannot act.")
		return
	_resolve_player_strike(lead, _default_attack_power(lead))
	for bond in allies:
		if bond == lead:
			continue
		if bond.get("fainted", false):
			continue
		_resolve_player_strike(bond, int(round(_default_attack_power(bond) * 0.35)))
	_wild_turn_if_alive()
	state_changed.emit()


func player_scan() -> void:
	if battle_over:
		return
	scan_meter = minf(1.0, scan_meter + SCAN_PER_ACTION)
	var species := SpeciesRegistry.get_species(str(wild.get("species_id", "")))
	if species:
		_log(
			"> Scan — %s signature logged. Element: %s. (%d%% scan)" % [
				species.display_name,
				species.element.capitalize(),
				int(round(scan_meter * 100.0)),
			]
		)
		if species.bond_flavor != "":
			_log("  [i]%s[/i]" % species.bond_flavor)
	else:
		_log("> Scan — signal noisy. (%d%% scan)" % int(round(scan_meter * 100.0)))
	_wild_turn_if_alive()
	state_changed.emit()


func player_bond() -> void:
	if battle_over:
		return
	if not can_bond_attempt():
		_log("> Bond — scanners need at least 50%% scan lock.")
		return
	var roll := randf()
	var chance := bond_chance()
	if roll <= chance:
		bonded = true
		battle_over = true
		_log(
			"> Bond — pacifier field holds! Captured (%d%% odds, rolled %.2f)." % [
				int(round(chance * 100.0)),
				roll,
			]
		)
		battle_ended.emit(true, true)
	else:
		wild_enraged = true
		_log(
			"> Bond — it thrashes free! (%d%% odds, rolled %.2f). Wild enraged!" % [
				int(round(chance * 100.0)),
				roll,
			]
		)
		_wild_turn_if_alive(1.25)
	state_changed.emit()


func player_flee() -> void:
	if battle_over:
		return
	battle_over = true
	_log("> You retreat from the fight.")
	battle_ended.emit(false, false)
	state_changed.emit()


func get_wild_hp_ratio() -> float:
	if wild.is_empty():
		return 0.0
	return float(wild["hp"]) / float(maxi(wild["max_hp"], 1))


func get_ally_hp_summary() -> String:
	var parts: PackedStringArray = []
	for unit in allies:
		parts.append("%s %d/%d" % [unit.get("nickname", "?"), unit["hp"], unit["max_hp"]])
	return ", ".join(parts)


func _resolve_player_strike(attacker: Dictionary, power: int) -> void:
	if wild.get("hp", 0) <= 0:
		return
	var atk_element := str(attacker.get("element", "kinetic"))
	var def_element := str(wild.get("element", "kinetic"))
	var mult := get_type_multiplier(atk_element, def_element)
	var damage := maxi(1, int(round(float(power) * mult)))
	wild["hp"] = maxi(0, int(wild["hp"]) - damage)
	var advantage := type_advantage_text(atk_element, def_element)
	_log(
		"> Attack — %s hits for %d DMG. %s" % [
			attacker.get("nickname", "Ally"),
			damage,
			advantage,
		]
	)
	_check_wild_fainted()


func _wild_turn_if_alive(enraged_mult: float = 1.0) -> void:
	if battle_over or wild.get("hp", 0) <= 0:
		return
	var species := SpeciesRegistry.get_species(str(wild.get("species_id", "")))
	var ability: Dictionary = _first_physical_ability(species)
	var ability_name := str(ability.get("name", "Strike"))
	var power := int(ability.get("power", species.base_attack if species else 8))
	power = int(round(float(power) * enraged_mult))
	var target := _first_living_ally()
	if target.is_empty():
		_log("> Wild %s — but your crew is down!" % ability_name)
		return
	var mult := get_type_multiplier(str(wild.get("element", "")), str(target.get("element", "")))
	var damage := maxi(1, int(round(float(power) * mult)))
	target["hp"] = maxi(0, int(target["hp"]) - damage)
	if int(target["hp"]) <= 0:
		target["fainted"] = true
	var adv := type_advantage_text(str(wild.get("element", "")), str(target.get("element", "")))
	_log("> Wild uses %s on %s for %d DMG. %s" % [ability_name, target["nickname"], damage, adv])
	_check_party_wipe()


func _check_wild_fainted() -> void:
	if int(wild.get("hp", 0)) > 0:
		return
	battle_over = true
	_log("The wild xeno collapses. Fight over.")
	battle_ended.emit(true, false)


func _check_party_wipe() -> void:
	for unit in allies:
		if not unit.get("fainted", false) and int(unit.get("hp", 0)) > 0:
			return
	battle_over = true
	_log("Crew cannot continue. Forced retreat.")
	battle_ended.emit(false, false)


func _spawn_from_species(species_id: String, level_scale: float) -> Dictionary:
	return GameState.make_combatant(species_id, "", level_scale)


func _lead() -> Dictionary:
	if allies.is_empty():
		return {}
	return allies[0]


func _first_living_ally() -> Dictionary:
	for unit in allies:
		if not unit.get("fainted", false) and int(unit.get("hp", 0)) > 0:
			return unit
	return {}


func _default_attack_power(unit: Dictionary) -> int:
	var species := SpeciesRegistry.get_species(str(unit.get("species_id", "")))
	if species == null:
		return 8
	return species.base_attack


func _first_physical_ability(species: SpeciesData) -> Dictionary:
	if species == null:
		return {"name": "Strike", "power": 8}
	for ab in species.abilities:
		if str(ab.get("kind", "physical")) == "physical":
			return ab
	if not species.abilities.is_empty():
		return species.abilities[0]
	return {"name": "Strike", "power": species.base_attack}


func _log(line: String) -> void:
	log_lines.append(line)