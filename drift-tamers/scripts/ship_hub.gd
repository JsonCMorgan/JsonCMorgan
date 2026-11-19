extends Control
## Ship hub — resource bar, mission board, stable, ship modules.

const LOCKED_TOOLTIP := "Coming soon"
const SMALL_FONT := 12
const TINY_FONT := 11

@onready var _resource_label: Label = %ResourceLabel
@onready var _bark_label: Label = %BarkLabel
@onready var _notice_label: Label = %NoticeLabel
@onready var _missions_tab: Button = %MissionsTab
@onready var _stable_tab: Button = %StableTab
@onready var _ship_tab: Button = %ShipTab
@onready var _missions_section: VBoxContainer = %MissionsSection
@onready var _stable_section: VBoxContainer = %StableSection
@onready var _ship_section: VBoxContainer = %ShipSection
@onready var _status_label: RichTextLabel = %StatusLabel
@onready var _payout_label: Label = %PayoutLabel
@onready var _briefing_label: RichTextLabel = %BriefingLabel
@onready var _memory_label: Label = %MemoryLabel
@onready var _mission_list: VBoxContainer = %MissionList
@onready var _locked_list: VBoxContainer = %LockedList
@onready var _deploy_button: Button = %DeployButton
@onready var _stable_list: VBoxContainer = %StableList
@onready var _stable_note: Label = %StableNote
@onready var _module_list: VBoxContainer = %ModuleList
@onready var _fuel_button: Button = %FuelButton
@onready var _siphon_button: Button = %SiphonButton

var _selected_mission_id: String = ""
var _release_dialog: ConfirmationDialog
var _pending_release_index: int = -1


func _ready() -> void:
	_missions_tab.pressed.connect(_on_tab_pressed.bind("missions"))
	_stable_tab.pressed.connect(_on_tab_pressed.bind("stable"))
	_ship_tab.pressed.connect(_on_tab_pressed.bind("ship"))
	_deploy_button.pressed.connect(_on_deploy_pressed)
	_fuel_button.pressed.connect(_on_fuel_pressed)
	_siphon_button.pressed.connect(_on_siphon_pressed)
	_build_release_dialog()

	_populate_missions()
	_status_label.text = GameState.hub_status_line()
	var memory := GameState.hub_memory_line()
	_memory_label.text = memory
	_memory_label.visible = memory != ""
	_briefing_label.text = "[i]Pick a mission. Read the briefing. Try not to void the warranty on the airlock.[/i]"
	_deploy_button.disabled = true
	_notice_label.text = ""
	_refresh_all()
	_on_tab_pressed("missions")


func _refresh_all() -> void:
	_refresh_resource_bar()
	_refresh_payout_line()
	_populate_stable()
	_populate_modules()
	_refresh_supplies()


## --- Resource bar ----------------------------------------------------------


func _refresh_resource_bar() -> void:
	_resource_label.text = GameState.resource_bar_text()
	_bark_label.text = "%s crew: %s" % [GameState.morale_tier_label(), GameState.crew_bark()]


func _refresh_payout_line() -> void:
	var payout := GameState.hub_payout_line()
	_payout_label.text = payout
	_payout_label.visible = payout != ""


func _set_notice(text: String) -> void:
	_notice_label.text = text
	_notice_label.visible = text != ""


## --- Sections --------------------------------------------------------------


func _on_tab_pressed(section: String) -> void:
	_missions_section.visible = section == "missions"
	_stable_section.visible = section == "stable"
	_ship_section.visible = section == "ship"
	_missions_tab.button_pressed = section == "missions"
	_stable_tab.button_pressed = section == "stable"
	_ship_tab.button_pressed = section == "ship"


## --- Mission board ---------------------------------------------------------


func _populate_missions() -> void:
	for child in _mission_list.get_children():
		child.queue_free()
	for child in _locked_list.get_children():
		child.queue_free()

	for mid in GameState.mission_ids_for_board():
		var mission := GameState.get_mission(mid)
		var btn := Button.new()
		btn.text = _mission_button_label(mid, mission)
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.custom_minimum_size = Vector2(0, 26)
		btn.add_theme_font_size_override("font_size", SMALL_FONT)
		btn.pressed.connect(_on_mission_selected.bind(mid))
		_mission_list.add_child(btn)

	for entry in MissionRegistry.locked_mission_entries():
		var btn := Button.new()
		btn.text = _locked_button_label(entry)
		btn.disabled = true
		btn.tooltip_text = LOCKED_TOOLTIP
		btn.add_theme_font_size_override("font_size", TINY_FONT)
		_locked_list.add_child(btn)


func _mission_button_label(mission_id: String, mission: Dictionary) -> String:
	var num := int(mission.get("type_number", 0))
	var title := str(mission.get("board_title", mission.get("display_name", "Mission")))
	return "%d. %s (%d fuel)" % [num, title, GameState.mission_fuel_cost(mission_id)]


func _locked_button_label(entry: Dictionary) -> String:
	var num := int(entry.get("type_number", 0))
	var title := str(entry.get("board_title", entry.get("display_name", "?")))
	return "%d. %s — locked" % [num, title]


func _on_mission_selected(mission_id: String) -> void:
	_selected_mission_id = mission_id
	var mission := GameState.get_mission(mission_id)
	_briefing_label.text = str(mission.get("briefing", ""))
	_deploy_button.disabled = false
	var check := GameState.can_deploy(mission_id)
	var cost := int(check.get("cost", 0))
	_deploy_button.text = "Deploy — %s (%d fuel)" % [str(mission.get("display_name", mission_id)), cost]
	if bool(check.get("ok", false)):
		_set_notice("")
	else:
		_set_notice(str(check.get("message", "")))


func _on_deploy_pressed() -> void:
	if _selected_mission_id == "":
		return
	var result := GameState.try_deploy(_selected_mission_id)
	if not bool(result.get("ok", false)):
		_set_notice(str(result.get("message", "")))
		_refresh_resource_bar()
		_refresh_supplies()
		return
	get_tree().change_scene_to_file("res://scenes/run_stub.tscn")


## --- Stable ----------------------------------------------------------------


func _populate_stable() -> void:
	for child in _stable_list.get_children():
		child.queue_free()

	if GameState.stable.is_empty():
		_stable_note.text = "No bonded xen aboard. The lamps are on anyway, in case."
		_stable_note.visible = true
		return

	_stable_note.text = "%d bonded aboard. Bond more in the field, release when the bay gets loud." % (
		GameState.stable.size()
	)
	_stable_note.visible = true

	for i in GameState.stable.size():
		var creature = GameState.stable[i]
		if not creature is Dictionary:
			continue
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)

		var info := Label.new()
		info.text = _stable_row_text(creature as Dictionary)
		info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info.add_theme_font_size_override("font_size", SMALL_FONT)
		row.add_child(info)

		var release := Button.new()
		release.text = "Release"
		release.custom_minimum_size = Vector2(0, 26)
		release.add_theme_font_size_override("font_size", TINY_FONT)
		release.pressed.connect(_on_release_pressed.bind(i))
		row.add_child(release)

		_stable_list.add_child(row)


func _stable_row_text(creature: Dictionary) -> String:
	var nickname := str(creature.get("nickname", "Xeno"))
	var element := str(creature.get("element", "?")).capitalize()
	var hp := int(creature.get("hp", 0))
	var max_hp := int(creature.get("max_hp", 1))
	return "%s (%s) — HP %d / %d" % [nickname, element, hp, max_hp]


func _build_release_dialog() -> void:
	_release_dialog = ConfirmationDialog.new()
	_release_dialog.title = "Release"
	_release_dialog.ok_button_text = "Open the bay"
	_release_dialog.cancel_button_text = "Keep it"
	_release_dialog.confirmed.connect(_on_release_confirmed)
	add_child(_release_dialog)


func _on_release_pressed(index: int) -> void:
	if index < 0 or index >= GameState.stable.size():
		return
	_pending_release_index = index
	var creature = GameState.stable[index]
	var nickname := "the xeno"
	if creature is Dictionary:
		nickname = str((creature as Dictionary).get("nickname", nickname))
	_release_dialog.dialog_text = (
		"Release %s back to the dark?\n+%d research from field notes, %d crew morale."
		% [nickname, GameState.RELEASE_RESEARCH, -GameState.RELEASE_MORALE]
	)
	_release_dialog.popup_centered()


func _on_release_confirmed() -> void:
	if _pending_release_index < 0:
		return
	var message := GameState.release_from_stable(_pending_release_index)
	_pending_release_index = -1
	_set_notice(message)
	_refresh_all()


## --- Ship modules and supplies --------------------------------------------


func _populate_modules() -> void:
	for child in _module_list.get_children():
		child.queue_free()

	for module in ShipModules.all_modules():
		var module_id := str(module.get("id", ""))
		var box := VBoxContainer.new()
		box.add_theme_constant_override("separation", 2)

		var header := Label.new()
		header.text = "%s — %s" % [
			str(module.get("display_name", module_id)),
			str(module.get("effect", "")),
		]
		header.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		header.add_theme_font_size_override("font_size", SMALL_FONT)
		box.add_child(header)

		var blurb := Label.new()
		blurb.text = str(module.get("blurb", ""))
		blurb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		blurb.add_theme_font_size_override("font_size", TINY_FONT)
		blurb.add_theme_color_override("font_color", Color(0.6, 0.68, 0.72))
		box.add_child(blurb)

		var buy := Button.new()
		buy.custom_minimum_size = Vector2(0, 26)
		buy.add_theme_font_size_override("font_size", TINY_FONT)
		if GameState.has_module(module_id):
			buy.text = "Installed"
			buy.disabled = true
		else:
			buy.text = "Buy — %d cr / %d parts" % [
				int(module.get("cost_credits", 0)),
				int(module.get("cost_parts", 0)),
			]
			buy.disabled = not GameState.can_buy_module(module_id)
			buy.pressed.connect(_on_module_buy_pressed.bind(module_id))
		box.add_child(buy)

		_module_list.add_child(box)


func _on_module_buy_pressed(module_id: String) -> void:
	_set_notice(GameState.buy_module(module_id))
	_refresh_all()


func _refresh_supplies() -> void:
	_fuel_button.text = GameState.fuel_cell_label()
	_fuel_button.disabled = not GameState.can_buy_fuel_cell()
	_siphon_button.visible = GameState.siphon_available()
	_siphon_button.text = GameState.siphon_label()


func _on_fuel_pressed() -> void:
	_set_notice(GameState.buy_fuel_cell())
	_refresh_all()


func _on_siphon_pressed() -> void:
	_set_notice(GameState.siphon_reserves())
	_refresh_all()
