import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Debuffs, Glyphs, Profession, PseudoStat, Race, RaidBuffs, Spec, Stat } from '../../core/proto/common';
import { FireMage_Options as MageOptions, FireMage_Rotation, MageMajorGlyph as MajorGlyph, MageMinorGlyph as MinorGlyph } from '../../core/proto/mage';
import { SavedTalents } from '../../core/proto/ui';
import { Stats, UnitStat, UnitStatPresets } from '../../core/proto_utils/stats';
import FireApl from './apls/fire.apl.json';
//import FireAoeApl from './apls/fire_aoe.apl.json';
import P1FireBisGear from './gear_sets/p1_fire.gear.json';
import P3FireBisGear from './gear_sets/p3_fire.gear.json';
import P3FirePrebisGear from './gear_sets/p3_fire_prebis.gear.json';
import P4FireBisGear from './gear_sets/p4_fire.gear.json';
import ItemSwapP4 from './gear_sets/p4_fire_item_swap.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const FIRE_P1_PRESET = PresetUtils.makePresetGear('P1 Preset', P1FireBisGear);
export const FIRE_P3_PREBIS = PresetUtils.makePresetGear('P3 Pre-raid', P3FirePrebisGear);
export const FIRE_P3_PRESET = PresetUtils.makePresetGear('P3 Preset', P3FireBisGear);
export const FIRE_P4_PRESET = PresetUtils.makePresetGear('P4 Preset', P4FireBisGear);

export const P1DefaultSimpleRotation = FireMage_Rotation.create({
	combustThreshold: 470000,
	combustLastMomentLustPercentage: 115000,
	combustNoLustPercentage: 225000,
});

export const P3TrollDefaultSimpleRotation = FireMage_Rotation.create({
	combustThreshold: 515000,
	combustLastMomentLustPercentage: 140000,
	combustNoLustPercentage: 260000,
});

export const P3NoTrollDefaultSimpleRotation = FireMage_Rotation.create({
	combustThreshold: 370000,
	combustLastMomentLustPercentage: 140000,
	combustNoLustPercentage: 275000,
});

export const P4TrollDefaultSimpleRotation = FireMage_Rotation.create({
	combustThreshold: 715000,
	combustLastMomentLustPercentage: 150000,
	combustNoLustPercentage: 300000,
});

export const P4NoTrollDefaultSimpleRotation = FireMage_Rotation.create({
	combustThreshold: 515000,
	combustLastMomentLustPercentage: 150000,
	combustNoLustPercentage: 300000,
});

export const P4_ITEM_SWAP = PresetUtils.makePresetItemSwapGear('P4 - Haste', ItemSwapP4);

export const P1_SIMPLE_ROTATION_DEFAULT = PresetUtils.makePresetSimpleRotation('P1 - Default', Spec.SpecFireMage, P1DefaultSimpleRotation);
export const P3_SIMPLE_ROTATION_DEFAULT = PresetUtils.makePresetSimpleRotation('P3 - Default', Spec.SpecFireMage, P3TrollDefaultSimpleRotation);
export const P3_SIMPLE_ROTATION_NO_TROLL = PresetUtils.makePresetSimpleRotation('P3 - Not Troll', Spec.SpecFireMage, P3NoTrollDefaultSimpleRotation);
export const P4_SIMPLE_ROTATION_DEFAULT = PresetUtils.makePresetSimpleRotation('P4 - Default', Spec.SpecFireMage, P4TrollDefaultSimpleRotation);
export const P4_SIMPLE_ROTATION_NO_TROLL = PresetUtils.makePresetSimpleRotation('P4 - Not Troll', Spec.SpecFireMage, P4NoTrollDefaultSimpleRotation);

//export const ROTATION_PRESET_SIMPLE = PresetUtils.makePresetSimpleRotation('Simple Default', Spec.SpecFireMage, DefaultSimpleRotation);
export const FIRE_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('APL', FireApl);

// Preset options for EP weights
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Default',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.33,
		[Stat.StatSpellPower]: 1.0,
		[Stat.StatHitRating]: 1.09,
		[Stat.StatCritRating]: 0.62,
		[Stat.StatHasteRating]: 0.82,
		[Stat.StatMasteryRating]: 0.46,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/wotlk/talent-calc and copy the numbers in the url.
export const FireTalents = {
	name: 'Fire',
	data: SavedTalents.create({
		talentsString: '212111',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfEvocation,
			minor1: MinorGlyph.GlyphOfMirrorImage,
			minor3: MinorGlyph.GlyphOfTheMonkey,
		}),
	}),
};

export const DefaultFireOptions = MageOptions.create({
	classOptions: {},
});

export const DefaultFireConsumables = ConsumesSpec.create({
	flaskId: 58086, // Flask of the Draconic Mind
	foodId: 62290, // Seafood Magnifique Feast
	potId: 58091, // Volcanic Potion
	prepotId: 58091, // Volcanic Potion
});

export const OtherDefaults = {
	distanceFromTarget: 20,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
};

export const FIRE_BREAKPOINTS: UnitStatPresets = {
	unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
	presets: new Map([
		['11-tick - Combust', 4.986888],
		['12-tick - Combust', 15.008639],
		['13-tick - Combust', 25.07819],
		['14-tick - Combust', 35.043908],
		['15-tick - Combust', 45.032653],
		['16-tick - Combust', 54.918692],
		['17-tick - Combust', 64.880489],
		['18-tick - Combust', 74.978158],
		['19-tick - Combust', 85.01391],
		['20-tick - Combust', 95.121989],
		['21-tick - Combust', 105.128247],
		['22-tick - Combust', 114.822817],
		['23-tick - Combust', 124.971929],
		['24-tick - Combust', 135.017682],
		['25-tick - Combust', 144.798102],
		['26-tick - Combust', 154.777135],
		['27-tick - Combust', 164.900732],
		['28-tick - Combust', 175.103239],
		['29-tick - Combust', 185.306786],
	]),
};

export const P1_PRESET_BUILD = PresetUtils.makePresetBuild('P1 - Default', {
	race: Race.RaceTroll,
	gear: FIRE_P1_PRESET,
	rotation: P1_SIMPLE_ROTATION_DEFAULT,
	epWeights: DEFAULT_EP_PRESET,
});

export const P3_PRESET_BUILD = PresetUtils.makePresetBuild('P3 - Default (Troll)', {
	race: Race.RaceTroll,
	gear: FIRE_P3_PRESET,
	rotation: P3_SIMPLE_ROTATION_DEFAULT,
	epWeights: DEFAULT_EP_PRESET,
});

export const P3_PRESET_NO_TROLL = PresetUtils.makePresetBuild('P3 - Default (Worgen)', {
	race: Race.RaceWorgen,
	gear: FIRE_P3_PRESET,
	rotation: P3_SIMPLE_ROTATION_NO_TROLL,
	epWeights: DEFAULT_EP_PRESET,
});

export const P4_PRESET_BUILD = PresetUtils.makePresetBuild('P4 - Default (Troll)', {
	race: Race.RaceTroll,
	gear: FIRE_P4_PRESET,
	rotation: P4_SIMPLE_ROTATION_DEFAULT,
});

export const P4_PRESET_NO_TROLL = PresetUtils.makePresetBuild('P4 - Default (Worgen)', {
	race: Race.RaceWorgen,
	gear: FIRE_P4_PRESET,
	rotation: P4_SIMPLE_ROTATION_NO_TROLL,
});
