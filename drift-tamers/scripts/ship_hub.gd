extends Control
## Ship hub — between-run home. Phase 2: contracts, stable, crew banter.

@onready var _status_label: Label = %StatusLabel


func _ready() -> void:
	_status_label.text = "Jobs board green. Crew owes you one decent contract."


func _on_start_run_pressed() -> void:
	# TODO Phase 2: persist loadout and seed run RNG before transition.
	get_tree().change_scene_to_file("res://scenes/run_stub.tscn")