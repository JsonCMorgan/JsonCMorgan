class_name SpeciesData
extends Resource
## Static species definition loaded from JSON under data/species/.

@export var id: String = ""
@export var display_name: String = ""
@export var element: String = "kinetic"
@export var base_hp: int = 40
@export var base_attack: int = 8
@export var abilities: Array[Dictionary] = []
@export var bond_flavor: String = ""


static func from_dict(data: Dictionary) -> SpeciesData:
	var species := SpeciesData.new()
	species.id = str(data.get("id", ""))
	species.display_name = str(data.get("display_name", species.id))
	species.element = str(data.get("element", "kinetic")).to_lower()
	species.base_hp = int(data.get("base_hp", 40))
	species.base_attack = int(data.get("base_attack", 8))
	species.bond_flavor = str(data.get("bond_flavor", ""))
	var raw_abilities: Array = data.get("abilities", [])
	for entry in raw_abilities:
		if entry is Dictionary:
			species.abilities.append(entry)
	return species