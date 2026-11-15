class_name MissionRegistry
extends RefCounted
## Loads mission JSON from res://data/missions/.

const MISSIONS_DIR := "res://data/missions/"
const PLAYABLE_ORDER: PackedStringArray = [
	"survey",
	"rescue",
	"recovery",
	"bounty",
	"escort",
]

const LOCKED_MANIFEST := "locked_manifest.json"

static var _cache: Dictionary = {}
static var _locked: Array = []


static func _ensure_locked_loaded() -> void:
	if not _locked.is_empty():
		return
	var path := MISSIONS_DIR + LOCKED_MANIFEST
	if not FileAccess.file_exists(path):
		return
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if parsed is Dictionary and parsed.get("locked_types") is Array:
		_locked = parsed["locked_types"]


static func get_mission(mission_id: String) -> Dictionary:
	var key := mission_id.to_lower()
	if _cache.has(key):
		return _cache[key].duplicate(true)
	var path := "%s%s.json" % [MISSIONS_DIR, key]
	if not FileAccess.file_exists(path):
		push_warning("MissionRegistry: missing %s" % path)
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if parsed == null or not parsed is Dictionary:
		push_warning("MissionRegistry: invalid JSON at %s" % path)
		return {}
	_cache[key] = parsed
	return parsed.duplicate(true)


static func playable_mission_ids() -> PackedStringArray:
	return PLAYABLE_ORDER.duplicate()


static func locked_mission_entries() -> Array:
	_ensure_locked_loaded()
	var out: Array = []
	for entry in _locked:
		if entry is Dictionary:
			out.append(entry.duplicate(true))
	return out


static func beat_key_for_room_index(room_index: int) -> String:
	if room_index <= 0:
		return "insert"
	if room_index <= 2:
		return "complication"
	return "crisis"


static func mission_beat_line(mission_id: String, room_index: int) -> String:
	var mission := get_mission(mission_id)
	if mission.is_empty():
		return ""
	var beats = mission.get("beats", {})
	if not beats is Dictionary:
		return ""
	var key := beat_key_for_room_index(room_index)
	return str(beats.get(key, ""))