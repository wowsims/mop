import { Encounter } from '../../core/encounter';
import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Encounter as EncounterProto, Glyphs, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { DefaultDebuffs, DefaultRaidBuffs } from '../presets';
import {
	FireMage_Rotation,
	MageArmor,
	FireMage_Options as MageOptions,
	MageMajorGlyph as MajorGlyph,
	MageMinorGlyph as MinorGlyph,
} from '../../core/proto/mage';
import { ReforgeSettings, SavedTalents } from '../../core/proto/ui';
import { Stats, UnitStat, UnitStatPresets } from '../../core/proto_utils/stats';
import FireApl from './apls/fire.apl.json';
import MasteryApl from './apls/mastery_fire.apl.json';
import P3BISGear from './gear_sets/p3_bis.gear.json';
import P3MasteryGear from './gear_sets/mastery_fire.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
// export const P1_PREBIS = PresetUtils.makePresetGear('P1 - Pre-BIS', P1PreBISGear);
// export const P1_BIS = PresetUtils.makePresetGear('P1 - BIS', P1BISGear);
// export const P2_BIS = PresetUtils.makePresetGear('P2 - BIS', P2BISGear);
export const P3_BIS = PresetUtils.makePresetGear('P3 - Crit BiS', P3BISGear);
export const P3_MASTERY = PresetUtils.makePresetGear('P3 - Mastery BiS', P3MasteryGear);

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
	combustAlwaysSend: 5250000,
	combustBloodlust: 4750000,
	combustPostAlter: 2000000,
	combustNoAlter: 500000,
	combustEndOfCombat: 200000,
});
export const P3NoTrollDefaultSimpleRotation = FireMage_Rotation.create({
	...P3TrollDefaultSimpleRotation,
	combustAlwaysSend: 11000000,
	combustBloodlust: 13000000,
	combustPostAlter: 10000000,
});

export const P3_SIMPLE_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetSimpleRotation('P3 - Crit', Spec.SpecFireMage, P3TrollDefaultSimpleRotation);
export const P3_SIMPLE_ROTATION_NO_TROLL = PresetUtils.makePresetSimpleRotation('P3 - Default (No Troll)', Spec.SpecFireMage, P3NoTrollDefaultSimpleRotation);
export const P1_ROTATION_PRESET_APL = PresetUtils.makePresetAPLRotation('APL', FireApl);
export const MASTERY_ROTATION_PRESET_APL = PresetUtils.makePresetAPLRotation('Mastery APL', MasteryApl);

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
export const MASTERY_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Mastery',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.37,
		[Stat.StatSpellPower]: 1.0,
		[Stat.StatHitRating]: 1.2,
		[Stat.StatCritRating]: 0.55,
		[Stat.StatHasteRating]: 0.62,
		[Stat.StatMasteryRating]: 1.05,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/wotlk/talent-calc and copy the numbers in the url.
export const FireTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '111121',
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
		talentsString: '111111',
		glyphs: Glyphs.create({
			...FireTalents.data.glyphs,
		}),
	}),
};

export const FireTalentsMastery = {
	name: 'Mastery',
	data: SavedTalents.create({
		talentsString: '111121',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfCombustion,
			major2: MajorGlyph.GlyphOfInfernoBlast,
			major3: MajorGlyph.GlyphOfArmors,
			minor1: MinorGlyph.GlyphOfMomentum,
			minor2: MinorGlyph.GlyphOfLooseMana,
			minor3: MinorGlyph.GlyphOfRapidTeleportation,
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

export const MasteryFireOptions = MageOptions.create({
	classOptions: {
		defaultMageArmor: MageArmor.MageArmorMageArmor,
	},
});

export const MasteryFireConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
	// No prepot for mastery build
});

export const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Crit (300s)', Encounter.defaultEncounterProto());
export const ENCOUNTER_CLEAVE = PresetUtils.makePresetEncounter('Cleave (3 targets)', Encounter.defaultEncounterProto(3));
export const ENCOUNTER_MASTERY = PresetUtils.makePresetEncounter(
	'Mastery (45s)',
	EncounterProto.create({
		...Encounter.defaultEncounterProto(),
		duration: 45,
		durationVariation: 5,
	}),
);

export const OtherDefaults = {
	distanceFromTarget: 20,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	race: Race.RaceTroll,
};

// Commented out - kept for reference
// export const P1_PRESET_SINGLE_TARGET = PresetUtils.makePresetBuild('Single Target', {
// 	talents: FireTalents,
// 	encounter: ENCOUNTER_SINGLE_TARGET,
// });

// export const P1_PRESET_CLEAVE = PresetUtils.makePresetBuild('Cleave (3 targets)', {
// 	talents: FireTalentsCleave,
// 	encounter: ENCOUNTER_CLEAVE,
// });

// Saved Settings presets
export const CRIT_SETTINGS: PresetUtils.PresetSettings = {
	name: 'Crit',
	race: Race.RaceTroll,
	specOptions: DefaultFireOptions,
	consumables: DefaultFireConsumables,
	raidBuffs: DefaultRaidBuffs,
	debuffs: DefaultDebuffs,
	playerOptions: OtherDefaults,
};

export const MASTERY_SETTINGS: PresetUtils.PresetSettings = {
	name: 'Mastery',
	race: Race.RaceTroll,
	specOptions: MasteryFireOptions,
	consumables: MasteryFireConsumables,
	raidBuffs: DefaultRaidBuffs,
	debuffs: DefaultDebuffs,
	playerOptions: OtherDefaults,
};

export const P3_CRIT_PRESET_BUILD = PresetUtils.makePresetBuild('P3 - Crit', {
	gear: P3_BIS,
	rotation: P3_SIMPLE_ROTATION_PRESET_DEFAULT,
	talents: FireTalents,
	epWeights: DEFAULT_EP_PRESET,
	encounter: ENCOUNTER_SINGLE_TARGET,
	settings: CRIT_SETTINGS,
	reforgeSettings: ReforgeSettings.create({
		useCustomEpValues: false,
		useSoftCapBreakpoints: true,
	}),
});
export const P3_MASTERY_PRESET_BUILD = PresetUtils.makePresetBuild('P3 - Mastery', {
	gear: P3_MASTERY,
	rotation: MASTERY_ROTATION_PRESET_APL,
	talents: FireTalentsMastery,
	epWeights: MASTERY_EP_PRESET,
	encounter: ENCOUNTER_MASTERY,
	settings: MASTERY_SETTINGS,
	reforgeSettings: ReforgeSettings.create({
		useCustomEpValues: true,
		useSoftCapBreakpoints: false,
		statCaps: new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15).toProto(),
	}),
});

// Commented out - kept for reference
// export const P2_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('P2 - Troll', {
// 	gear: P2_BIS,
// 	rotation: P2_SIMPLE_ROTATION_PRESET_DEFAULT,
// 	encounter: ENCOUNTER_SINGLE_TARGET,
// 	settings: {
// 		name: 'P2 - Troll',
// 		specOptions: DefaultFireOptions,
// 		consumables: DefaultFireConsumables,
// 	},
// });
// export const P2_NO_TROLL_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('P2 - No-Troll', {
// 	gear: P2_BIS,
// 	rotation: P2_SIMPLE_ROTATION_NO_TROLL,
// 	encounter: ENCOUNTER_SINGLE_TARGET,
// 	settings: {
// 		name: 'P2 - No-Troll',
// 		specOptions: DefaultFireOptions,
// 		consumables: DefaultFireConsumables,
// 	},
// });
// export const P3_NO_TROLL_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('P3 - No-Troll', {
// 	gear: P3_BIS,
// 	rotation: P3_SIMPLE_ROTATION_NO_TROLL,
// 	encounter: ENCOUNTER_SINGLE_TARGET,
// 	settings: {
// 		name: 'P3 - No-Troll',
// 		specOptions: DefaultFireOptions,
// 		consumables: DefaultFireConsumables,
// 	},
// });

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
