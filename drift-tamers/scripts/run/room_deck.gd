class_name RoomDeck
extends RefCounted
## Builds derelict room order and weighted wild encounter tables.

const BASE_TEMPLATES: PackedStringArray = [
	"corridor_fight",
	"breach_scan",
	"galley_rest",
	"vault_loot",
	"nest_elite",
]

const TEMPLATE_INFO: Dictionary = {
	"corridor_fight": {
		"title": "Corridor fight",
		"blurb": "Movement in the bulkhead. Something wild nests in the torn insulation.",
		"is_fight": true,
		"elite": false,
	},
	"breach_scan": {
		"title": "Breach scan",
		"blurb": "A hull breach exposes quiet void. Your scanner catches a clean resonance.",
		"is_fight": false,
		"elite": false,
	},
	"galley_rest": {
		"title": "Galley rest",
		"blurb": "Dead galley, still faintly warm. The crew patches suits and steals a breath.",
		"is_fight": false,
		"elite": false,
	},
	"vault_loot": {
		"title": "Vault loot",
		"blurb": "Sealed locker. Inside: one salvage-grade consumable and corporate junk.",
		"is_fight": false,
		"elite": false,
	},
	"nest_elite": {
		"title": "Nest — elite signature",
		"blurb": "Nest of relay scraps. The scan reads like a rare spawn.",
		"is_fight": true,
		"elite": true,
	},
}


const WILD_WEIGHTS_STANDARD: Array = [
	{"id": "hullmite", "weight": 20},
	{"id": "sparkmote", "weight": 18},
	{"id": "ashling", "weight": 16},
	{"id": "bulkgrub", "weight": 14},
	{"id": "relaybat", "weight": 14},
	{"id": "frostmoth", "weight": 12},
	{"id": "nullfin", "weight": 10},
]

const WILD_WEIGHTS_DEEP: Array = [
	{"id": "hullmite", "weight": 10},
	{"id": "sparkmote", "weight": 12},
	{"id": "ashling", "weight": 12},
	{"id": "bulkgrub", "weight": 10},
	{"id": "relaybat", "weight": 12},
	{"id": "frostmoth", "weight": 12},
	{"id": "nullfin", "weight": 16},
	{"id": "cryptid", "weight": 14},
]

const WILD_WEIGHTS_ELITE: Array = [
	{"id": "nullfin", "weight": 18},
	{"id": "bulkgrub", "weight": 16},
	{"id": "relaybat", "weight": 14},
	{"id": "frostmoth", "weight": 14},
	{"id": "cryptid", "weight": 10},
]

const WILD_WEIGHTS_ELITE_DEEP: Array = [
	{"id": "nullfin", "weight": 12},
	{"id": "cryptid", "weight": 22},
	{"id": "bulkgrub", "weight": 10},
	{"id": "relaybat", "weight": 12},
	{"id": "frostmoth", "weight": 12},
]


static func build_deck(mission_id: String, mission: Dictionary = {}) -> Array:
	var deck: Array = []
	for template_id in BASE_TEMPLATES:
		deck.append(template_id)
	var mods = mission.get("modifiers", {})
	if not mods is Dictionary:
		mods = {}
	if bool(mods.get("extra_fight", false)):
		deck.append("corridor_fight")
	match mission_id:
		_:
			pass
	deck.shuffle()
	if mission_id == "rescue":
		_bias_room_toward_front(deck, "galley_rest")
	if mission_id == "survey":
		_bias_room_toward_front(deck, "breach_scan")
	if mission_id == "recovery":
		_bias_room_toward_front(deck, "vault_loot")
	return deck


static func _bias_room_toward_front(deck: Array, room_id: String) -> void:
	if not deck.has(room_id):
		return
	var idx := deck.find(room_id)
	if idx <= 1:
		return
	deck.remove_at(idx)
	deck.insert(mini(1, deck.size() - 1), room_id)


static func template_title(template_id: String) -> String:
	return str(TEMPLATE_INFO.get(template_id, {}).get("title", template_id))


static func template_blurb(template_id: String) -> String:
	return str(TEMPLATE_INFO.get(template_id, {}).get("blurb", ""))


static func is_fight_room(template_id: String) -> bool:
	return bool(TEMPLATE_INFO.get(template_id, {}).get("is_fight", false))


static func is_elite_room(template_id: String) -> bool:
	return bool(TEMPLATE_INFO.get(template_id, {}).get("elite", false))


static func pick_wild(deep_scan: bool, elite: bool) -> String:
	var table: Array
	if elite:
		table = WILD_WEIGHTS_ELITE_DEEP if deep_scan else WILD_WEIGHTS_ELITE
	else:
		table = WILD_WEIGHTS_DEEP if deep_scan else WILD_WEIGHTS_STANDARD
	return _weighted_pick(table)


static func _weighted_pick(table: Array) -> String:
	var total := 0
	for entry in table:
		total += int(entry.get("weight", 0))
	if total <= 0:
		return "hullmite"
	var roll := randi_range(1, total)
	var cursor := 0
	for entry in table:
		cursor += int(entry.get("weight", 0))
		if roll <= cursor:
			return str(entry.get("id", "hullmite"))
	return str(table[0].get("id", "hullmite"))