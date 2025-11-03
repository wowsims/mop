import { Encounter } from '../../core/encounter';
import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import {
	FireMage_Rotation,
	MageArmor,
	FireMage_Options as MageOptions,
	MageMajorGlyph as MajorGlyph,
	MageMinorGlyph as MinorGlyph,
} from '../../core/proto/mage';
import { SavedTalents } from '../../core/proto/ui';
import { Stats, UnitStat, UnitStatPresets } from '../../core/proto_utils/stats';
import FireApl from './apls/fire.apl.json';
import FireCleaveApl from './apls/fire_cleave.apl.json';
import P1PreBISGear from './gear_sets/p1_prebis.gear.json';
import P1BISGear from './gear_sets/p1_bis.gear.json';
import P2BISGear from './gear_sets/p2_bis.gear.json';
import P3BISGear from './gear_sets/p3_bis.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
export const P1_PREBIS = PresetUtils.makePresetGear('P1 - Pre-BIS', P1PreBISGear);
export const P1_BIS = PresetUtils.makePresetGear('P1 - BIS', P1BISGear);
export const P2_BIS = PresetUtils.makePresetGear('P2 - BIS', P2BISGear);
export const P3_BIS = PresetUtils.makePresetGear('P3 - BIS', P3BISGear);

export const P1TrollDefaultSimpleRotation = FireMage_Rotation.create({
	combustAlwaysSend: 4000000,
	combustBloodlust: 3700000,
	combustPostAlter: 2600000,
	combustNoAlter: 680000,
	combustEndOfCombat: 320000,
});
export const P1NoTrollDefaultSimpleRotation = FireMage_Rotation.create({
	...P1TrollDefaultSimpleRotation,
	combustPostAlter: 1750000,
});

export const P2TrollDefaultSimpleRotation = FireMage_Rotation.create({
	combustAlwaysSend: 5600000,
	combustBloodlust: 4600000,
	combustPostAlter: 2600000,
	combustNoAlter: 460000,
	combustEndOfCombat: 350000,
});
export const P2NoTrollDefaultSimpleRotation = FireMage_Rotation.create({
	...P2TrollDefaultSimpleRotation,
	combustAlwaysSend: 5300000,
	combustBloodlust: 4100000,
	combustPostAlter: 2150000,
});

export const P3TrollDefaultSimpleRotation = FireMage_Rotation.create({
	combustAlwaysSend: 8100000,
	combustBloodlust: 7400000,
	combustPostAlter: 5100000,
	combustNoAlter: 1100000,
	combustEndOfCombat: 700000,
});
export const P3NoTrollDefaultSimpleRotation = FireMage_Rotation.create({
	...P3TrollDefaultSimpleRotation,
	combustAlwaysSend: 7600000,
	combustBloodlust: 7400000,
	combustPostAlter: 5100000,
});

export const P1_SIMPLE_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetSimpleRotation('P1 - Default', Spec.SpecFireMage, P1TrollDefaultSimpleRotation);
export const P1_SIMPLE_ROTATION_NO_TROLL = PresetUtils.makePresetSimpleRotation('P1 - Default (No Troll)', Spec.SpecFireMage, P1NoTrollDefaultSimpleRotation);
export const P2_SIMPLE_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetSimpleRotation('P2 - Default', Spec.SpecFireMage, P2TrollDefaultSimpleRotation);
export const P2_SIMPLE_ROTATION_NO_TROLL = PresetUtils.makePresetSimpleRotation('P2 - Default (No Troll)', Spec.SpecFireMage, P2NoTrollDefaultSimpleRotation);
export const P3_SIMPLE_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetSimpleRotation('P3 - Default', Spec.SpecFireMage, P3TrollDefaultSimpleRotation);
export const P3_SIMPLE_ROTATION_NO_TROLL = PresetUtils.makePresetSimpleRotation('P3 - Default (No Troll)', Spec.SpecFireMage, P3NoTrollDefaultSimpleRotation);

export const P1_ROTATION_PRESET_APL = PresetUtils.makePresetAPLRotation('APL', FireApl);

// export const FIRE_ROTATION_PRESET_CLEAVE = PresetUtils.makePresetAPLRotation('Cleave', FireCleaveApl);

// Preset options for EP weights
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level > 500',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.37,
		[Stat.StatSpellPower]: 1.0,
		[Stat.StatHitRating]: 1.2,
		[Stat.StatCritRating]: 1.05,
		[Stat.StatHasteRating]: 0.62,
		[Stat.StatMasteryRating]: 0.79,
	}),
);

export const P1_PREBIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level < 500',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.37,
		[Stat.StatSpellPower]: 1.0,
		[Stat.StatHitRating]: 1.21,
		[Stat.StatCritRating]: 0.94,
		[Stat.StatHasteRating]: 0.95,
		[Stat.StatMasteryRating]: 0.59,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/wotlk/talent-calc and copy the numbers in the url.
export const FireTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '111122',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfCombustion,
			major2: MajorGlyph.GlyphOfInfernoBlast,
			major3: MajorGlyph.GlyphOfRapidDisplacement,
			minor1: MinorGlyph.GlyphOfMomentum,
			minor2: MinorGlyph.GlyphOfLooseMana,
			minor3: MinorGlyph.GlyphOfRapidTeleportation,
		}),
	}),
};

export const FireTalentsCleave = {
	name: 'Cleave',
	data: SavedTalents.create({
		talentsString: '111112',
		glyphs: Glyphs.create({
			...FireTalents.data.glyphs,
		}),
	}),
};

export const DefaultFireOptions = MageOptions.create({
	classOptions: {
		defaultMageArmor: MageArmor.MageArmorMoltenArmor,
	},
});

export const DefaultFireConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

export const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Single Target', Encounter.defaultEncounterProto());
export const ENCOUNTER_CLEAVE = PresetUtils.makePresetEncounter('Cleave (3 targets)', Encounter.defaultEncounterProto(3));

export const P1_PRESET_SINGLE_TARGET = PresetUtils.makePresetBuild('Single Target', {
	talents: FireTalents,
	encounter: ENCOUNTER_SINGLE_TARGET,
});

export const P1_PRESET_CLEAVE = PresetUtils.makePresetBuild('Cleave (3 targets)', {
	talents: FireTalentsCleave,
	encounter: ENCOUNTER_CLEAVE,
});

export const P2_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('P2 - Troll', {
	gear: P2_BIS,
	rotation: P2_SIMPLE_ROTATION_PRESET_DEFAULT
});
export const P2_NO_TROLL_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('P2 - No-Troll', {
	gear: P2_BIS,
	rotation: P2_SIMPLE_ROTATION_NO_TROLL
});

export const P3_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('P3 - Troll', {
	gear: P3_BIS,
	rotation: P3_SIMPLE_ROTATION_PRESET_DEFAULT
});
export const P3_NO_TROLL_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('P3 - No-Troll', {
	gear: P3_BIS,
	rotation: P3_SIMPLE_ROTATION_NO_TROLL
});

export const OtherDefaults = {
	distanceFromTarget: 20,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	race: Race.RaceTroll,
};

export const COMBUSTION_BREAKPOINT: UnitStatPresets = {
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

export const GLYPHED_COMBUSTION_BREAKPOINT: UnitStatPresets = {
	unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
	presets: new Map([
		['21-tick - Combust (Glyph)', 2.511543],
		['22-tick - Combust (Glyph)', 7.469114],
		['23-tick - Combust (Glyph)', 12.549253],
		['24-tick - Combust (Glyph)', 17.439826],
		['25-tick - Combust (Glyph)', 22.473989],
		['26-tick - Combust (Glyph)', 27.469742],
		['27-tick - Combust (Glyph)', 32.538122],
		['28-tick - Combust (Glyph)', 37.457064],
		['29-tick - Combust (Glyph)', 42.551695],
		['30-tick - Combust (Glyph)', 47.601498],
		['31-tick - Combust (Glyph)', 52.555325],
		['32-tick - Combust (Glyph)', 57.604438],
		['33-tick - Combust (Glyph)', 62.469563],
		['34-tick - Combust (Glyph)', 67.364045],
		['35-tick - Combust (Glyph)', 72.562584],
		['36-tick - Combust (Glyph)', 77.462321],
		['37-tick - Combust (Glyph)', 82.648435],
		['38-tick - Combust (Glyph)', 87.44146],
		['39-tick - Combust (Glyph)', 92.492819],
	]),
};
