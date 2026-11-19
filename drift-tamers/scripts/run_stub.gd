extends Control
## Derelict run loop: room deck, O₂ pressure, extract / abort.

@onready var _room_label: Label = %RoomLabel
@onready var _hud_label: Label = %HudLabel
@onready var _step_button: Button = %StepButton
@onready var _fight_button: Button = %FightButton
@onready var _continue_button: Button = %ContinueButton
@onready var _extract_button: Button = %Extract
@onready var _abort_button: Button = %Abort

var _last_effect_line: String = ""


func _ready() -> void:
	if not GameState.run.get("active", false):
		_room_label.text = "No active mission. Return to ship."
		_set_nav_enabled(false)
		return
	if int(GameState.run.get("o2", 0)) <= 0:
		GameState.forced_o2_retreat()
		get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")
		return
	_refresh_ui()


func _refresh_ui() -> void:
	var mission := GameState.get_mission(str(GameState.run.get("mission_id", "survey")))
	var mission_title := str(mission.get("display_name", "Mission"))
	var room_num := int(GameState.run.get("room_index", 0)) + 1
	var total := GameState.total_rooms()
	_hud_label.text = "%s — Room %d / %d — O₂ %d / %d (-%d per room)" % [
		mission_title,
		room_num,
		maxi(1, total),
		int(GameState.run.get("o2", 0)),
		int(GameState.run.get("o2_max", GameState.O2_START)),
		GameState.o2_cost_per_room(),
	]
	_extract_button.disabled = not GameState.can_extract()
	_abort_button.disabled = false

	if GameState.run_finished():
		_room_label.text = (
			"Deck clear. Extract when ready — the crew is already arguing over split."
		)
		_step_button.visible = false
		_fight_button.visible = false
		_continue_button.visible = false
		return

	var in_room := bool(GameState.run.get("in_room", false))
	var room_id := GameState.current_room_id()
	var title := RoomDeck.template_title(room_id)
	var blurb := RoomDeck.template_blurb(room_id)

	if not in_room:
		_room_label.text = "Approaching: %s\n%s" % [title, blurb]
		if _last_effect_line != "":
			_room_label.text += "\n\n" + _last_effect_line
		_step_button.visible = true
		_step_button.text = "Step into room %d" % room_num
		_fight_button.visible = false
		_continue_button.visible = false
		return

	var body := "Inside: %s\n%s" % [title, blurb]
	if _last_effect_line != "":
		body += "\n\n" + _last_effect_line
	_room_label.text = body

	var is_fight := RoomDeck.is_fight_room(room_id)
	_step_button.visible = false
	_fight_button.visible = is_fight
	_fight_button.text = "Engage hostile"
	_continue_button.visible = not is_fight


func _on_step_pressed() -> void:
	var result := GameState.step_into_room()
	if not result.get("ok", false) and result.get("o2_depleted", false):
		GameState.forced_o2_retreat()
		get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")
		return
	var beat := str(result.get("beat_line", ""))
	var effect := str(result.get("effect", ""))
	_last_effect_line = beat
	if effect != "" and effect != "fight_pending":
		if _last_effect_line != "":
			_last_effect_line += "\n\n" + effect
		else:
			_last_effect_line = effect
	if int(GameState.run.get("o2", 0)) <= 0:
		GameState.forced_o2_retreat()
		get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")
		return
	_refresh_ui()


func _on_fight_pressed() -> void:
	GameState.prepare_fight_encounter()
	get_tree().change_scene_to_file("res://scenes/battle_stub.tscn")


func _on_continue_pressed() -> void:
	_last_effect_line = GameState.complete_current_room()
	if int(GameState.run.get("o2", 0)) <= 0:
		GameState.forced_o2_retreat()
		get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")
		return
	_refresh_ui()


func _on_extract_pressed() -> void:
	GameState.extract_run()
	get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")


func _on_abort_pressed() -> void:
	GameState.abort_run()
	get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")


func _set_nav_enabled(enabled: bool) -> void:
	_step_button.disabled = not enabled
	_fight_button.disabled = not enabled
	_continue_button.disabled = not enabled
	_extract_button.disabled = not enabled
	_abort_button.disabled = not enabled