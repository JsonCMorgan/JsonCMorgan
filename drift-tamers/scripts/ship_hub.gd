extends Control
## Ship hub — contract board, stable glance, warm return lines.

@onready var _status_label: Label = %StatusLabel
@onready var _meta_label: Label = %MetaLabel


func _ready() -> void:
	_status_label.text = GameState.hub_status_line()
	_meta_label.text = _meta_summary()


func _meta_summary() -> String:
	var credits := int(GameState.meta.get("credits", 0))
	var stable_n := GameState.stable.size()
	return "Credits: %d — Stable: %d bonded xen" % [credits, stable_n]


func _on_contract_pressed(contract_id: String) -> void:
	GameState.start_run(contract_id)
	get_tree().change_scene_to_file("res://scenes/run_stub.tscn")


func _on_standard_pressed() -> void:
	_on_contract_pressed("standard_salvage")


func _on_corp_audit_pressed() -> void:
	_on_contract_pressed("corp_audit")


func _on_deep_scan_pressed() -> void:
	_on_contract_pressed("deep_scan")