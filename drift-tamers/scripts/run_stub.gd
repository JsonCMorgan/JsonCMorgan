extends Control
## One salvage run placeholder. Phase 2: procedural rooms, threats, extraction timer.

@onready var _room_label: Label = %RoomLabel


func _ready() -> void:
	_room_label.text = "Deck 3 — flickering aux power. Something moved in the bulkhead."


func _on_encounter_pressed() -> void:
	# TODO Phase 2: spawn encounter from run state.
	get_tree().change_scene_to_file("res://scenes/battle_stub.tscn")


func _on_extract_pressed() -> void:
	# TODO Phase 2: run success rewards and meta save.
	get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")


func _on_abort_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")