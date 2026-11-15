extends Control
## Ship hub — mission board, briefing, stable glance.

const LOCKED_TOOLTIP := "Coming soon"

@onready var _status_label: RichTextLabel = %StatusLabel
@onready var _meta_label: Label = %MetaLabel
@onready var _briefing_label: RichTextLabel = %BriefingLabel
@onready var _memory_label: Label = %MemoryLabel
@onready var _mission_list: VBoxContainer = %MissionList
@onready var _locked_list: VBoxContainer = %LockedList
@onready var _deploy_button: Button = %DeployButton

var _selected_mission_id: String = ""


func _ready() -> void:
	_populate_missions()
	_status_label.text = GameState.hub_status_line()
	var memory := GameState.hub_memory_line()
	_memory_label.text = memory
	_memory_label.visible = memory != ""
	_meta_label.text = _meta_summary()
	_briefing_label.text = "[i]Pick a mission. Read the briefing. Try not to void the warranty on the airlock.[/i]"
	_deploy_button.disabled = true


func _meta_summary() -> String:
	var credits := int(GameState.meta.get("credits", 0))
	var stable_n := GameState.stable.size()
	return "Credits: %d — Stable: %d bonded xen" % [credits, stable_n]


func _populate_missions() -> void:
	for child in _mission_list.get_children():
		child.queue_free()
	for child in _locked_list.get_children():
		child.queue_free()

	for mid in GameState.mission_ids_for_board():
		var mission := GameState.get_mission(mid)
		var btn := Button.new()
		btn.text = _mission_button_label(mission)
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.pressed.connect(_on_mission_selected.bind(mid))
		_mission_list.add_child(btn)

	for entry in MissionRegistry.locked_mission_entries():
		var btn := Button.new()
		btn.text = _locked_button_label(entry)
		btn.disabled = true
		btn.tooltip_text = LOCKED_TOOLTIP
		_locked_list.add_child(btn)


func _mission_button_label(mission: Dictionary) -> String:
	var num := int(mission.get("type_number", 0))
	var title := str(mission.get("board_title", mission.get("display_name", "Mission")))
	return "%d. %s" % [num, title]


func _locked_button_label(entry: Dictionary) -> String:
	var num := int(entry.get("type_number", 0))
	var title := str(entry.get("board_title", entry.get("display_name", "?")))
	return "%d. %s — locked" % [num, title]


func _on_mission_selected(mission_id: String) -> void:
	_selected_mission_id = mission_id
	var mission := GameState.get_mission(mission_id)
	var briefing := str(mission.get("briefing", ""))
	_briefing_label.text = briefing
	_deploy_button.disabled = false
	_deploy_button.text = "Deploy — %s" % str(mission.get("display_name", mission_id))


func _on_deploy_pressed() -> void:
	if _selected_mission_id == "":
		return
	GameState.start_run(_selected_mission_id)
	get_tree().change_scene_to_file("res://scenes/run_stub.tscn")