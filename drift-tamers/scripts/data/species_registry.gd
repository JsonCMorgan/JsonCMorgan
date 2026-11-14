class_name SpeciesRegistry
extends RefCounted
## Loads species JSON from res://data/species/.

const SPECIES_DIR := "res://data/species/"

static var _cache: Dictionary = {}


static func get_species(species_id: String) -> SpeciesData:
	var key := species_id.to_lower()
	if _cache.has(key):
		return _cache[key]
	var path := "%s%s.json" % [SPECIES_DIR, key]
	if not FileAccess.file_exists(path):
		push_warning("SpeciesRegistry: missing %s" % path)
		return null
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if parsed == null or not parsed is Dictionary:
		push_warning("SpeciesRegistry: invalid JSON at %s" % path)
		return null
	var species := SpeciesData.from_dict(parsed)
	_cache[key] = species
	return species


static func all_species_ids() -> PackedStringArray:
	var ids: PackedStringArray = []
	for file_name in DirAccess.get_files_at(SPECIES_DIR):
		if file_name.ends_with(".json"):
			ids.append(file_name.trim_suffix(".json"))
	return ids