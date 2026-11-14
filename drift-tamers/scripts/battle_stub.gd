extends Control
## Turn-based battle UI wired to BattleEngine and GameState.

@onready var _log_label: RichTextLabel = %BattleLog
@onready var _wild_hp: Label = %WildHpLabel
@onready var _ally_hp: Label = %AllyHpLabel
@onready var _scan_label: Label = %ScanLabel
@onready var _bond_button: Button = %Bond

var _engine: BattleEngine


func _ready() -> void:
	_engine = BattleEngine.new()
	_engine.state_changed.connect(_on_battle_state_changed)
	_engine.battle_ended.connect(_on_battle_ended)
	_start_hullmite_encounter()
	_refresh_hud()
	_flush_log()


func _start_hullmite_encounter() -> void:
	var team: Array = []
	team.append(GameState.party["lead"].duplicate(true))
	for bond in GameState.party["bonds"]:
		if bond != null:
			team.append(bond.duplicate(true))
	if not GameState.run.get("active", false):
		GameState.start_run()
	GameState.spend_fight_o2()
	_engine.start_encounter("hullmite", team)


func _on_attack_pressed() -> void:
	_engine.player_attack()
	_after_action()


func _on_scan_pressed() -> void:
	_engine.player_scan()
	_after_action()


func _on_bond_pressed() -> void:
	_engine.player_bond()
	_after_action()


func _on_leave_pressed() -> void:
	_engine.player_flee()
	_sync_party_hp()
	get_tree().change_scene_to_file("res://scenes/run_stub.tscn")


func _after_action() -> void:
	_flush_log()
	_refresh_hud()
	_sync_party_hp()


func _on_battle_state_changed() -> void:
	_refresh_hud()


func _on_battle_ended(_victory: bool, did_bond: bool) -> void:
	_flush_log()
	_refresh_hud()
	_sync_party_hp()
	if did_bond:
		var captured := GameState.make_combatant("hullmite", "Hullmite")
		GameState.add_to_stable(captured)
	_set_actions_enabled(not _engine.battle_over)


func _refresh_hud() -> void:
	if _engine.wild.is_empty():
		return
	_wild_hp.text = "Wild HP: %d / %d" % [_engine.wild["hp"], _engine.wild["max_hp"]]
	_ally_hp.text = "Crew: %s" % _engine.get_ally_hp_summary()
	_scan_label.text = "Scan: %d%%" % int(round(_engine.scan_meter * 100.0))
	_bond_button.disabled = not _engine.can_bond_attempt() or _engine.battle_over
	_set_actions_enabled(not _engine.battle_over)


func _set_actions_enabled(enabled: bool) -> void:
	%Attack.disabled = not enabled
	%Scan.disabled = not enabled
	if enabled and _engine.can_bond_attempt():
		_bond_button.disabled = false
	elif enabled:
		_bond_button.disabled = true
	else:
		_bond_button.disabled = true


func _sync_party_hp() -> void:
	var idx := 0
	GameState.party["lead"] = _engine.allies[0].duplicate(true)
	idx = 1
	for slot_i in GameState.party["bonds"].size():
		if GameState.party["bonds"][slot_i] == null:
			continue
		if idx < _engine.allies.size():
			GameState.party["bonds"][slot_i] = _engine.allies[idx].duplicate(true)
			idx += 1


func _flush_log() -> void:
	_log_label.clear()
	for line in _engine.log_lines:
		_log_label.append_text(line + "\n")