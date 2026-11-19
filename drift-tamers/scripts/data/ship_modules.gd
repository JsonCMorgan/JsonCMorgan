class_name ShipModules
extends RefCounted
## Buyable ship modules. Effects are read by GameState during runs and battles.

const MODULES: Array = [
	{
		"id": "scanner_array",
		"display_name": "Scanner Array",
		"blurb": "Hale bolts a salvaged survey dish to the dorsal spine. Every fight opens with the scanner already warm.",
		"effect": "+25% scan at the start of every battle",
		"cost_credits": 110,
		"cost_parts": 6,
	},
	{
		"id": "o2_scrubber",
		"display_name": "O2 Scrubber",
		"blurb": "Second-hand scrubber stack, loud as a kettle, honest as a kettle. Suits recycle instead of just emptying.",
		"effect": "+20 max O2 and rooms cost 6 O2 instead of 8",
		"cost_credits": 90,
		"cost_parts": 5,
	},
	{
		"id": "med_bay",
		"display_name": "Med Bay",
		"blurb": "One bunk, one autodoc, one poster of a beach nobody on this crew has seen. Patches the team between rooms.",
		"effect": "+10% team HP after every cleared room",
		"cost_credits": 130,
		"cost_parts": 4,
	},
]

const SCANNER_ARRAY_SCAN_BONUS := 0.25
const O2_SCRUBBER_MAX_BONUS := 20
const O2_SCRUBBER_ROOM_SAVING := 2
const MED_BAY_HEAL_RATIO := 0.10


static func all_modules() -> Array:
	var out: Array = []
	for module in MODULES:
		out.append((module as Dictionary).duplicate(true))
	return out


static func get_module(module_id: String) -> Dictionary:
	for module in MODULES:
		if str((module as Dictionary).get("id", "")) == module_id:
			return (module as Dictionary).duplicate(true)
	return {}


static func module_ids() -> PackedStringArray:
	var out: PackedStringArray = []
	for module in MODULES:
		out.append(str((module as Dictionary).get("id", "")))
	return out
