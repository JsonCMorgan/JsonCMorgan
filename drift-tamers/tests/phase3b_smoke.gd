extends Node

var _failures: int = 0


func _check(condition: bool, label: String) -> void:
	if condition:
		print("PASS  %s" % label)
	else:
		_failures += 1
		print("FAIL  %s" % label)


func _ready() -> void:
	_reset_state()
	_test_defaults()
	_test_fuel_gating()
	_test_payouts()
	_test_modules()
	_test_morale_and_release()
	_test_save_roundtrip()
	_clear_save()
	print("---- failures: %d" % _failures)
	get_tree().quit(1 if _failures > 0 else 0)


## This smoke test writes to the real save slot, so start and finish clean.
func _reset_state() -> void:
	_clear_save()
	GameState.stable = []
	GameState.meta = {
		"credits": GameState.START_CREDITS,
		"fuel": GameState.START_FUEL,
		"parts": GameState.START_PARTS,
		"research": GameState.START_RESEARCH,
		"morale": GameState.START_MORALE,
		"modules": [],
		"reputation_independence": 0,
		"reputation_corp": 0,
		"missions_unlocked": ["survey", "rescue", "recovery", "bounty", "escort"],
	}


func _clear_save() -> void:
	if FileAccess.file_exists(GameState.STABLE_SAVE_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(GameState.STABLE_SAVE_PATH))


func _test_defaults() -> void:
	_check(GameState.resource_amount("credits") == GameState.START_CREDITS, "start credits")
	_check(GameState.resource_amount("fuel") == GameState.START_FUEL, "start fuel")
	_check(GameState.resource_amount("parts") == GameState.START_PARTS, "start parts")
	_check(GameState.resource_amount("morale") == GameState.START_MORALE, "start morale")
	_check(GameState.resource_bar_text().begins_with("CR "), "resource bar text")
	_check(GameState.mission_fuel_cost("bounty") == 16, "bounty fuel cost from json")


func _test_fuel_gating() -> void:
	GameState.meta["fuel"] = 4
	var blocked := GameState.can_deploy("bounty")
	_check(not bool(blocked.get("ok", true)), "deploy blocked on low fuel")
	_check(str(blocked.get("message", "")).contains("Tanks read 4 units"), "in-fiction fuel message")
	var failed := GameState.try_deploy("bounty")
	_check(not bool(failed.get("ok", true)), "try_deploy refuses")
	_check(not bool(GameState.run.get("active", false)), "run not started without fuel")
	_check(GameState.siphon_available() == false, "siphon hidden while credits remain")
	GameState.meta["credits"] = 0
	_check(GameState.siphon_available(), "siphon offered when broke and dry")
	GameState.siphon_reserves()
	_check(GameState.resource_amount("fuel") == 10, "siphon adds fuel")
	_check(GameState.resource_amount("morale") == GameState.START_MORALE - GameState.SIPHON_MORALE, "siphon costs morale")
	GameState.meta["credits"] = 500
	GameState.meta["fuel"] = 40
	GameState.meta["morale"] = GameState.START_MORALE
	var ok := GameState.try_deploy("survey")
	_check(bool(ok.get("ok", false)), "deploy succeeds with fuel")
	_check(GameState.resource_amount("fuel") == 30, "deploy spends mission fuel")
	_check(bool(GameState.run.get("active", false)), "run active after deploy")


func _test_payouts() -> void:
	GameState.meta["credits"] = 0
	GameState.meta["parts"] = 0
	GameState.meta["research"] = 0
	GameState.meta["morale"] = 50
	GameState.start_run("survey")
	GameState.run["rooms_cleared"] = 5
	GameState.run["room_index"] = GameState.total_rooms()
	GameState.set_mission_flag("data_scanned", true)
	GameState.extract_run()
	_check(GameState.last_outcome == "win", "survey win outcome")
	# win 110 credits + 5 rooms * 5 salvage + extract bonus 30
	_check(GameState.resource_amount("credits") == 165, "survey win credits (got %d)" % GameState.resource_amount("credits"))
	_check(GameState.resource_amount("research") == 4, "survey win research")
	_check(GameState.resource_amount("morale") == 56, "survey win morale")
	_check(GameState.hub_payout_line().begins_with("Payout:"), "payout summary line")

	GameState.meta["credits"] = 0
	GameState.meta["morale"] = 50
	GameState.start_run("escort")
	GameState.run["rooms_cleared"] = 1
	GameState.abort_run()
	_check(GameState.last_outcome == "fail", "escort abort is a fail")
	_check(GameState.resource_amount("credits") == 25, "escort fail credits (got %d)" % GameState.resource_amount("credits"))
	_check(GameState.resource_amount("morale") == 38, "escort fail drops morale")


func _test_modules() -> void:
	GameState.meta["modules"] = []
	GameState.meta["credits"] = 400
	GameState.meta["parts"] = 20
	_check(GameState.module_scan_bonus() == 0.0, "no scan bonus without module")
	_check(GameState.o2_cost_per_room() == GameState.O2_PER_ROOM, "base o2 per room")
	_check(GameState.can_buy_module("scanner_array"), "can buy scanner")
	GameState.buy_module("scanner_array")
	_check(GameState.has_module("scanner_array"), "scanner owned")
	_check(GameState.module_scan_bonus() > 0.2, "scanner grants scan head start")
	_check(GameState.resource_amount("credits") == 290, "scanner cost credits")
	_check(GameState.resource_amount("parts") == 14, "scanner cost parts")
	_check(GameState.buy_module("scanner_array").contains("already"), "no double buy")

	GameState.buy_module("o2_scrubber")
	_check(GameState.o2_cost_per_room() == 6, "scrubber cuts o2 per room")
	_check(GameState.o2_max_for_run(false) == 120, "scrubber raises o2 max")
	_check(GameState.o2_max_for_run(true) == 105, "scrubber raises deep scan o2 max")
	GameState.start_run("survey")
	_check(int(GameState.run.get("o2_max", 0)) == 105, "run uses module o2 max")

	GameState.buy_module("med_bay")
	GameState.party["lead"]["hp"] = 1
	var line := GameState.complete_current_room()
	_check(line.contains("Med Bay"), "med bay reports between rooms")
	_check(int(GameState.party["lead"]["hp"]) > 1, "med bay heals lead")

	GameState.meta["credits"] = 0
	GameState.meta["parts"] = 0
	GameState.meta["modules"] = []
	_check(not GameState.can_buy_module("med_bay"), "cannot buy broke")


func _test_morale_and_release() -> void:
	GameState.meta["morale"] = 90
	_check(GameState.morale_tier() == "stoked", "stoked tier")
	GameState.meta["morale"] = 60
	_check(GameState.morale_tier() == "solid", "solid tier")
	GameState.meta["morale"] = 40
	_check(GameState.morale_tier() == "frayed", "frayed tier")
	GameState.meta["morale"] = 10
	_check(GameState.morale_tier() == "grim", "grim tier")
	_check(GameState.crew_bark() != "", "grim bark present")
	var grim_bark := GameState.crew_bark()
	_check(GameState.crew_bark() == grim_bark, "bark stable inside a tier")
	GameState.adjust_morale(-100)
	_check(GameState.resource_amount("morale") == 0, "morale floors at 0")
	GameState.adjust_morale(500)
	_check(GameState.resource_amount("morale") == GameState.MORALE_MAX, "morale caps at max")

	GameState.stable = []
	GameState.add_to_stable(GameState.make_combatant("hullmite", "Shellback"))
	GameState.meta["research"] = 0
	GameState.meta["morale"] = 50
	var msg := GameState.release_from_stable(0)
	_check(GameState.stable.is_empty(), "release removes from stable")
	_check(msg.contains("Shellback"), "release names the creature")
	_check(GameState.resource_amount("research") == GameState.RELEASE_RESEARCH, "release pays research")
	_check(GameState.resource_amount("morale") == 50 - GameState.RELEASE_MORALE, "release costs morale")
	_check(GameState.release_from_stable(3) == "", "release ignores bad index")


func _test_save_roundtrip() -> void:
	GameState.meta["credits"] = 777
	GameState.meta["fuel"] = 33
	GameState.meta["parts"] = 9
	GameState.meta["research"] = 5
	GameState.meta["morale"] = 71
	GameState.meta["modules"] = ["med_bay", "bogus_module"]
	GameState.stable = [GameState.make_combatant("sparkmote", "Buzz")]
	GameState.save_game()

	GameState.meta["credits"] = 0
	GameState.meta["modules"] = []
	GameState.stable = []
	GameState._load_stable()
	_check(GameState.resource_amount("credits") == 777, "credits persisted")
	_check(GameState.resource_amount("fuel") == 33, "fuel persisted")
	_check(GameState.resource_amount("research") == 5, "research persisted")
	_check(GameState.resource_amount("morale") == 71, "morale persisted")
	_check(GameState.owned_modules() == ["med_bay"], "modules persisted, unknown ids dropped")
	_check(GameState.stable.size() == 1, "stable still persisted")

	# v1 save (stable only) must still load without wiping resources.
	var file := FileAccess.open(GameState.STABLE_SAVE_PATH, FileAccess.WRITE)
	file.store_string(JSON.stringify({"stable": []}))
	file = null
	GameState._load_stable()
	_check(GameState.resource_amount("credits") == 777, "v1 save keeps defaults in memory")
