import { Encounter } from '../../core/encounter';
import { Player } from '../../core/player';
import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, Race, Spec, Stat } from '../../core/proto/common';
import { ArcaneMage_Options as MageOptions, MageMajorGlyph as MajorGlyph, MageMinorGlyph, MageArmor } from '../../core/proto/mage';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import { TypedEvent } from '../../core/typed_event';
import { DefaultDebuffs, DefaultRaidBuffs } from '../presets';
import ArcaneCleaveApl from './apls/arcane_cleave.apl.json';
import ArcaneP3APL from './apls/arcane_t15_4pc.apl.json';
import PreBISGear from './gear_sets/prebis.gear.json';
import P2BISGear from './gear_sets/p2_bis.gear.json';
import P3BISGear from './gear_sets/p3_bis.gear.json';
import P4BISGear from './gear_sets/p4_bis.gear.json';
import P5BISGear from './gear_sets/p5_bis.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
const setFrostArmor = (player: Player<Spec.SpecArcaneMage>) => {
	const specOptions = player.getSpecOptions();
	specOptions.classOptions!.defaultMageArmor = MageArmor.MageArmorFrostArmor;
	player.setSpecOptions(TypedEvent.nextEventID(), specOptions);
};

const setMageArmor = (player: Player<Spec.SpecArcaneMage>) => {
	const specOptions = player.getSpecOptions();
	specOptions.classOptions!.defaultMageArmor = MageArmor.MageArmorMageArmor;
	player.setSpecOptions(TypedEvent.nextEventID(), specOptions);
};

export const PREBIS = PresetUtils.makePresetGear('Pre-BIS', PreBISGear, { onLoad: setFrostArmor });
export const P2_BIS = PresetUtils.makePresetGear('P2 - BIS', P2BISGear, { onLoad: setFrostArmor });
export const P3_BIS = PresetUtils.makePresetGear('P3 - BIS', P3BISGear, { onLoad: setFrostArmor });
export const P4_BIS = PresetUtils.makePresetGear('P4 - BIS', P4BISGear, { onLoad: setMageArmor });
export const P5_BIS = PresetUtils.makePresetGear('P5 - BIS', P5BISGear, { onLoad: setFrostArmor });

export const ROTATION_PRESET_T15_4PC = PresetUtils.makePresetAPLRotation('Default', ArcaneP3APL);
// export const ROTATION_PRESET_CLEAVE = PresetUtils.makePresetAPLRotation('Cleave', ArcaneCleaveApl);

// Preset options for EP weights
export const P3_BIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level >= 525',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.23,
		[Stat.StatSpellPower]: 1,
		[Stat.StatHitRating]: 1.71,
		[Stat.StatCritRating]: 0.61,
		[Stat.StatHasteRating]: 0.9,
		[Stat.StatMasteryRating]: 0.74,
	}),
);

export const P1_BIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level >= 495',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.24,
		[Stat.StatSpellPower]: 1,
		[Stat.StatHitRating]: 1.45,
		[Stat.StatCritRating]: 0.59,
		[Stat.StatHasteRating]: 0.64,
		[Stat.StatMasteryRating]: 0.7,
	}),
);

export const P1_PREBIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level < 495',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.24,
		[Stat.StatSpellPower]: 1,
		[Stat.StatHitRating]: 1.31,
		[Stat.StatCritRating]: 0.52,
		[Stat.StatHasteRating]: 0.62,
		[Stat.StatMasteryRating]: 0.6,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const ArcaneTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '311122',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfArcanePower,
			major2: MajorGlyph.GlyphOfRapidDisplacement,
			major3: MajorGlyph.GlyphOfManaGem,
			minor1: MageMinorGlyph.GlyphOfMomentum,
			minor2: MageMinorGlyph.GlyphOfRapidTeleportation,
			minor3: MageMinorGlyph.GlyphOfLooseMana,
		}),
	}),
};

export const ArcaneTalentsCleave = {
	name: 'Cleave',
	data: SavedTalents.create({
		talentsString: '311112',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfArcanePower,
			major2: MajorGlyph.GlyphOfRapidDisplacement,
			major3: MajorGlyph.GlyphOfManaGem,
			minor1: MageMinorGlyph.GlyphOfMomentum,
			minor2: MageMinorGlyph.GlyphOfRapidTeleportation,
			minor3: MageMinorGlyph.GlyphOfLooseMana,
		}),
	}),
};

export const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Single Target', Encounter.defaultEncounterProto());
export const ENCOUNTER_CLEAVE = PresetUtils.makePresetEncounter('Cleave (2 targets)', Encounter.defaultEncounterProto(2));

export const P1_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('Single Target', {
	talents: ArcaneTalents,
	rotation: ROTATION_PRESET_T15_4PC,
	encounter: ENCOUNTER_SINGLE_TARGET,
});

export const P1_PRESET_BUILD_CLEAVE = PresetUtils.makePresetBuild('Cleave (2 targets)', {
	talents: ArcaneTalentsCleave,
	rotation: ROTATION_PRESET_T15_4PC,
	encounter: ENCOUNTER_CLEAVE,
});

export const DefaultArcaneOptions = MageOptions.create({
	classOptions: {
		defaultMageArmor: MageArmor.MageArmorFrostArmor,
	},
});

export const MageArmorOptions = MageOptions.create({
	classOptions: {
		defaultMageArmor: MageArmor.MageArmorMageArmor,
	},
});
export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

export const OtherDefaults = {
	distanceFromTarget: 20,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	race: Race.RaceTroll,
};

export const DEFAULT_SETTINGS: PresetUtils.PresetSettings = {
	name: 'Default',
	specOptions: DefaultArcaneOptions,
	consumables: DefaultConsumables,
	raidBuffs: DefaultRaidBuffs,
	debuffs: DefaultDebuffs,
	playerOptions: OtherDefaults,
};

export const P4_SETTINGS: PresetUtils.PresetSettings = {
	name: 'P4',
	specOptions: MageArmorOptions,
	consumables: DefaultConsumables,
	raidBuffs: DefaultRaidBuffs,
	debuffs: DefaultDebuffs,
	playerOptions: OtherDefaults,
};

export const P5_SETTINGS: PresetUtils.PresetSettings = {
	name: 'P5',
	specOptions: DefaultArcaneOptions,
	consumables: DefaultConsumables,
	raidBuffs: DefaultRaidBuffs,
	debuffs: DefaultDebuffs,
	playerOptions: OtherDefaults,
};

export const T14_PRESET_BUILD = PresetUtils.makePresetBuild('T14', {
	gear: P2_BIS,
	rotation: ROTATION_PRESET_T15_4PC,
	epWeights: P1_BIS_EP_PRESET,
	settings: DEFAULT_SETTINGS,
});

export const T15_PRESET_BUILD = PresetUtils.makePresetBuild('T15', {
	gear: P3_BIS,
	rotation: ROTATION_PRESET_T15_4PC,
	epWeights: P3_BIS_EP_PRESET,
	settings: DEFAULT_SETTINGS,
});

export const T15_P4_PRESET_BUILD = PresetUtils.makePresetBuild('T15 P4', {
	gear: P4_BIS,
	rotation: ROTATION_PRESET_T15_4PC,
	epWeights: P3_BIS_EP_PRESET,
	settings: P4_SETTINGS,
});

export const T16_PRESET_BUILD = PresetUtils.makePresetBuild('T16', {
	gear: P5_BIS,
	rotation: ROTATION_PRESET_T15_4PC,
	epWeights: P3_BIS_EP_PRESET,
	settings: P5_SETTINGS,
});
