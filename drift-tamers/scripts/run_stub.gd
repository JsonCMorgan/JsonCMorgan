extends Control
## One salvage run placeholder. Phase 2: procedural rooms, threats, extraction timer.

@onready var _room_label: Label = %RoomLabel


func _ready() -> void:
	if GameState.run.get("active", false):
		_room_label.text = (
			"Deck %d — O₂ %d%%. Something moved in the bulkhead."
			% [int(GameState.run.get("room_index", 0)) + 3, int(GameState.run.get("o2", 0))]
		)
	else:
		_room_label.text = "Deck 3 — flickering aux power. Something moved in the bulkhead."


func _on_encounter_pressed() -> void:
	# TODO Phase 2: spawn encounter from run state.
	get_tree().change_scene_to_file("res://scenes/battle_stub.tscn")


func _on_extract_pressed() -> void:
	GameState.end_run()
	get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")


func _on_abort_pressed() -> void:
	GameState.end_run()
	get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")