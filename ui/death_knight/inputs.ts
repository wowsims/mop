// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

import { Sim } from '../core/sim';

// True if any target in the selected encounter casts real magic damage at raid
// players (proto.Target.models_player_magic_damage), in which case the sim ignores
// the Avg AMS Hit intake settings and the inputs are hidden. Saved encounter
// settings from before the flag existed carry target protos without it, so fall
// back to the preset database's current definition of the same NPC id — mirroring
// the fallback in sim/core/target.go NewTarget.
export const encounterModelsMagicDamage = (sim: Sim): boolean =>
	sim.encounter.targets.some(
		target =>
			target.modelsPlayerMagicDamage ||
			!!sim.db?.getAllPresetTargets().find(preset => preset.target?.id === target.id)?.target?.modelsPlayerMagicDamage,
	);
