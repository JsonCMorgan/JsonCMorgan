extends Node
## Boots ship_hub.tscn and clicks through one full mission to debrief.
## Run: godot --headless --path . res://tests/smoke_run.tscn [-- --mission=survey --step-delay=0.0]

const MAX_STEPS := 400
const WATCHDOG_SEC := 240.0

var is_driver := false
var _mission_id := "survey"
var _step_delay := 0.0
var _seed := 42
var _save_backup: Variant = null


func _ready() -> void:
	# The launching scene is freed by change_scene, so drive from a node parented to root.
	if not is_driver:
		var driver: Node = get_script().new()
		driver.is_driver = true
		driver.name = "SmokeDriver"
		get_tree().root.add_child.call_deferred(driver)
		return
	if FileAccess.file_exists(GameState.STABLE_SAVE_PATH):
		_save_backup = FileAccess.get_file_as_string(GameState.STABLE_SAVE_PATH)
	get_tree().create_timer(WATCHDOG_SEC).timeout.connect(_expect.bind(false, "watchdog timeout"))
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--mission="):
			_mission_id = arg.trim_prefix("--mission=")
		elif arg.begins_with("--step-delay="):
			_step_delay = float(arg.trim_prefix("--step-delay="))
		elif arg.begins_with("--seed="):
			_seed = int(arg.trim_prefix("--seed="))
	seed(_seed)
	# Repeated smoke runs share one save slot, so never let fuel block the deploy under test.
	GameState.meta["fuel"] = maxi(GameState.resource_amount("fuel"), GameState.mission_fuel_cost(_mission_id))
	_run.call_deferred()


func _run() -> void:
	get_tree().change_scene_to_file("res://scenes/ship_hub.tscn")
	await _settle()
	var hub := get_tree().current_scene
	if not _expect(hub != null and hub.name == "ShipHub", "hub boots"):
		return
	var mission_list: VBoxContainer = hub.get_node("%MissionList")
	if not _expect(mission_list.get_child_count() == 5, "five missions on the board"):
		return
	var picked: Button = null
	for btn in mission_list.get_children():
		if btn.text.begins_with("%d." % int(GameState.get_mission(_mission_id)["type_number"])):
			picked = btn
	if not _expect(picked != null, "mission button for %s" % _mission_id):
		return
	await _press(picked)
	var deploy: Button = hub.get_node("%DeployButton")
	if not _expect(not deploy.disabled, "deploy enabled after selecting"):
		return
	await _press(deploy)
	await _settle()
	if not _expect(GameState.run["active"], "run active after deploy"):
		return

	var fights := 0
	for i in MAX_STEPS:
		var scene := get_tree().current_scene
		if OS.is_stdout_verbose() or _step_delay > 0.0:
			print("step %d scene=%s room=%d in_room=%s o2=%d" % [
				i, scene.name, int(GameState.run["room_index"]), GameState.run["in_room"], int(GameState.run["o2"]),
			])
		match scene.name:
			"ShipHub":
				var status: RichTextLabel = scene.get_node("%StatusLabel")
				var mission := GameState.get_mission(_mission_id)
				var debriefs: Array = mission["debrief"].values()
				_expect(status.text in debriefs, "hub shows a %s debrief" % _mission_id)
				_expect(GameState.last_mission_memory != "", "mission memory recorded")
				print("SMOKE: %s exit=%s fights=%d credits=%d memory='%s'" % [
					_mission_id, GameState.run["last_exit_kind"], fights, int(GameState.meta["credits"]), GameState.last_mission_memory,
				])
				print("SMOKE PASSED")
				if _step_delay > 0.0:
					await get_tree().create_timer(_step_delay * 4.0).timeout
				get_tree().quit(0)
				return
			"RunStub":
				var step: Button = scene.get_node("%StepButton")
				var fight: Button = scene.get_node("%FightButton")
				var cont: Button = scene.get_node("%ContinueButton")
				var hurt := _party_hp_ratio() < 0.5 and not bool(GameState.run["in_room"])
				if GameState.run_finished() or (hurt and GameState.can_extract()):
					await _press(scene.get_node("%Extract"))
				elif step.visible:
					await _press(step)
				elif fight.visible:
					fights += 1
					await _press(fight)
				elif cont.visible:
					await _press(cont)
				else:
					_expect(false, "run screen has no available action")
					return
			"BattleStub":
				var engine: BattleEngine = scene._engine
				var wild_name := SpeciesRegistry.get_species(str(engine.wild["species_id"])).display_name
				if not _expect(wild_name in scene.get_node("Margin/VBox/Header").text, "battle header names %s" % wild_name):
					return
				if OS.is_stdout_verbose() or _step_delay > 0.0:
					print("  wild=%s hp=%d scan=%.2f over=%s | %s" % [
						engine.wild.get("species_id"), int(engine.wild.get("hp", 0)), engine.scan_meter,
						engine.battle_over, engine.log_lines.back() if not engine.log_lines.is_empty() else "",
					])
				if engine.battle_over:
					await _press(scene.get_node("%Leave"))
				elif engine.can_bond_attempt() and engine.get_wild_hp_ratio() < 0.4:
					await _press(scene.get_node("%Bond"))
				elif engine.scan_meter < 0.5 and engine.get_wild_hp_ratio() < 0.7:
					await _press(scene.get_node("%Scan"))
				else:
					await _press(scene.get_node("%Attack"))
			_:
				_expect(false, "unexpected scene %s" % scene.name)
				return
		await _settle()
	_expect(false, "mission did not finish within %d steps" % MAX_STEPS)


func _party_hp_ratio() -> float:
	var hp := 0
	var max_hp := 0
	for unit in [GameState.party["lead"]] + GameState.party["bonds"]:
		if unit is Dictionary and not unit.is_empty():
			hp += int(unit["hp"])
			max_hp += int(unit["max_hp"])
	return float(hp) / float(maxi(max_hp, 1))


func _press(btn: Button) -> void:
	if _step_delay > 0.0:
		await get_tree().create_timer(_step_delay).timeout
	if btn.disabled or not btn.is_visible_in_tree():
		_expect(false, "button %s is not clickable" % btn.name)
		return
	btn.pressed.emit()


func _settle() -> void:
	for i in 3:
		await get_tree().process_frame


func _expect(cond: bool, msg: String) -> bool:
	if not cond:
		printerr("SMOKE FAILED: " + msg)
		get_tree().quit(1)
	return cond


func _exit_tree() -> void:
	if not is_driver:
		return
	if _save_backup == null:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(GameState.STABLE_SAVE_PATH))
	else:
		FileAccess.open(GameState.STABLE_SAVE_PATH, FileAccess.WRITE).store_string(_save_backup)
