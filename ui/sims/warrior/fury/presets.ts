import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, HandType, ItemSlot, Profession, Race, Spec } from '@core/proto/common';
import { FuryWarrior_Options as WarriorOptions, WarriorMajorGlyph } from '@core/proto/warrior';
import { Player } from '@domain/player';
import { makeSpecChangeWarningToast } from '@features/settings/view/spec_change_warning_toast';

import DefaultFuryApl from './apls/default.apl.json';
import P2FurySMFGear from './gear_sets/p2_fury_smf.gear.json';
import P2FuryTGGear from './gear_sets/p2_fury_tg.gear.json';
import P4FuryTGGear from './gear_sets/p4_fury_tg.gear.json';
import P5FuryTGGear from './gear_sets/p5_fury_tg.gear.json';
import PreraidFurySMFGear from './gear_sets/preraid_fury_smf.gear.json';
import PreraidFuryTGGear from './gear_sets/preraid_fury_tg.gear.json';
import P2FurySmfEpJson from './presets/ep/p2_smf.ep.json';
import P2FuryTgEpJson from './presets/ep/p2_tg.ep.json';
import P3_4FuryTgEpJson from './presets/ep/p3_4_tg.ep.json';
import P5FuryTgEpJson from './presets/ep/p5_tg.ep.json';
import FurySmfTalentsJson from './presets/talents/smf.talents.json';
import FuryTgTalentsJson from './presets/talents/tg.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

// Handlers for spec specific load checks
const FURY_SMF_PRESET_OPTIONS = {
	onLoad: (player: Player<Spec.SpecFuryWarrior>) => {
		makeSpecChangeWarningToast(
			[
				{
					condition: (player: Player<Spec.SpecFuryWarrior>) =>
						player.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item.handType === HandType.HandTypeTwoHand,
					message: 'Check your gear: You have a two-handed weapon equipped, but the selected option is for one-handed weapons.',
				},
			],
			player,
		);
	},
};
const FURY_TG_PRESET_OPTIONS = {
	onLoad: (player: Player<any>) => {
		makeSpecChangeWarningToast(
			[
				{
					condition: (player: Player<Spec.SpecFuryWarrior>) =>
						player.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item.handType === HandType.HandTypeOneHand,
					message: 'Check your gear: You have a one-handed weapon equipped, but the selected option is for two-handed weapons.',
				},
			],
			player,
		);
	},
};

export const PRERAID_FURY_SMF_PRESET = PresetUtils.makePresetGear('Pre-BIS - 1H', PreraidFurySMFGear, FURY_SMF_PRESET_OPTIONS);
export const PRERAID_FURY_TG_PRESET = PresetUtils.makePresetGear('Pre-BIS - 2H', PreraidFuryTGGear, FURY_TG_PRESET_OPTIONS);
export const P2_BIS_FURY_SMF_PRESET = PresetUtils.makePresetGear('P2 - 1H', P2FurySMFGear, FURY_SMF_PRESET_OPTIONS);
export const P2_BIS_FURY_TG_PRESET = PresetUtils.makePresetGear('P2 - 2H', P2FuryTGGear, FURY_TG_PRESET_OPTIONS);
export const P3_4_BIS_FURY_TG_PRESET = PresetUtils.makePresetGear('P3 & P4 - 2H', P4FuryTGGear, FURY_TG_PRESET_OPTIONS);
export const P5_BIS_FURY_TG_PRESET = PresetUtils.makePresetGear('P5 - 2H', P5FuryTGGear, FURY_TG_PRESET_OPTIONS);

export const FURY_DEFAULT_ROTATION = PresetUtils.makePresetAPLRotation('Default', DefaultFuryApl);

// Preset options for EP weights
export const P2_FURY_SMF_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2FurySmfEpJson, FURY_SMF_PRESET_OPTIONS);

export const P2_FURY_TG_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2FuryTgEpJson, FURY_TG_PRESET_OPTIONS);

export const P3_4_FURY_TG_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P3_4FuryTgEpJson, FURY_TG_PRESET_OPTIONS);

export const P5_FURY_TG_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5FuryTgEpJson, FURY_TG_PRESET_OPTIONS);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.

export const FurySMFTalents = {
	...PresetUtils.makePresetTalentsFromJSON(FurySmfTalentsJson, { major: WarriorMajorGlyph }),
	...FURY_SMF_PRESET_OPTIONS,
};

export const FuryTGTalents = {
	...PresetUtils.makePresetTalentsFromJSON(FuryTgTalentsJson, { major: WarriorMajorGlyph }),
	...FURY_TG_PRESET_OPTIONS,
};

export const DefaultOptions = WarriorOptions.create({
	classOptions: {},
	syncType: 0,
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76088, // Flask of Winter's Bite
	foodId: 74646, // Black Pepper Ribs and Shrimp
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});

export const OtherDefaults = {
	race: Race.RaceOrc,
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 25,
};

export const P3_4_PRESET_BUILD_TG = PresetUtils.makePresetBuild('P3 & P4 - TG', {
	gear: P3_4_BIS_FURY_TG_PRESET,
	talents: FuryTGTalents,
	epWeights: P3_4_FURY_TG_EP_PRESET,
});
export const P5_PRESET_BUILD_TG = PresetUtils.makePresetBuild('P5 - TG', {
	gear: P5_BIS_FURY_TG_PRESET,
	talents: FuryTGTalents,
	epWeights: P5_FURY_TG_EP_PRESET,
});
