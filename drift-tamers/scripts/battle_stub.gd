extends Control
## Turn-based battle placeholder. Phase 2: turn order, species data, bond math.

@onready var _log_label: RichTextLabel = %BattleLog


func _ready() -> void:
	_log_label.clear()
	_append_log("Wild [i]Hullmite[/i] blocks the corridor. Your turn.")


func _append_log(line: String) -> void:
	_log_label.append_text(line + "\n")


func _on_attack_pressed() -> void:
	# TODO Phase 2: resolve damage, type chart, hit VFX.
	_append_log("> Attack — you rake it with a plasma cutter. (damage stub)")


func _on_scan_pressed() -> void:
	# TODO Phase 2: fill scan meter, reveal traits and elemental type.
	_append_log("> Scan — EM signature logged. Species: Hullmite (stub).")


func _on_bond_pressed() -> void:
	# TODO Phase 2: weaken threshold, bond chance, team slot.
	_append_log("> Bond — pacifier field deployed. (capture stub)")


func _on_leave_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/run_stub.tscn")