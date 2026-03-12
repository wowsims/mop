import { Encounter } from '../../core/encounter';
import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Debuffs, Glyphs, IndividualBuffs, Profession, Race, RaidBuffs, Stat } from '../../core/proto/common';
import { SavedTalents } from '../../core/proto/ui';
import {
	AfflictionWarlock_Options as WarlockOptions,
	WarlockMajorGlyph as MajorGlyph,
	WarlockMinorGlyph as MinorGlyph,
	WarlockOptions_Summon as Summon,
} from '../../core/proto/warlock';
import { Stats } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import { WARLOCK_BREAKPOINTS } from '../presets';
import DefaultApl from './apls/default.apl.json';
import MultiTargetApl from './apls/multitarget.apl.json';
import P1Gear from './gear_sets/p1.gear.json';
import P2Gear from './gear_sets/p2.gear.json';
import P3Gear from './gear_sets/p3.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P1_PRESET = PresetUtils.makePresetGear('P1 - BIS', P1Gear);
export const P2_PRESET = PresetUtils.makePresetGear('P2 - BIS', P2Gear);
export const P3_PRESET = PresetUtils.makePresetGear('P3 - BIS', P3Gear);

export const APL_Default = PresetUtils.makePresetAPLRotation('Single Target', DefaultApl);
export const APL_Multitarget = PresetUtils.makePresetAPLRotation('Multi Target', MultiTargetApl);

// Preset options for EP weights
export const P1_BIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level < 512',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.23,
		[Stat.StatSpellPower]: 1.0,
		[Stat.StatHitRating]: 0.93,
		[Stat.StatCritRating]: 0.54,
		[Stat.StatHasteRating]: 0.83,
		[Stat.StatMasteryRating]: 0.67,
	}),
);

export const P2_BIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level >= 512',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.23,
		[Stat.StatSpellPower]: 1.0,
		[Stat.StatHitRating]: 0.9,
		[Stat.StatCritRating]: 0.56,
		[Stat.StatHasteRating]: 0.73,
		[Stat.StatMasteryRating]: 0.68,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wotlk.wowhead.com/talent-calc and copy the numbers in the url.

export const AfflictionTalents = {
	name: 'Affliction',
	data: SavedTalents.create({
		talentsString: '231211',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfUnstableAffliction,
			major2: MajorGlyph.GlyphOfSiphonLife,
			minor3: MinorGlyph.GlyphOfUnendingBreath,
		}),
	}),
};

export const DefaultOptions = WarlockOptions.create({
	classOptions: {
		summon: Summon.Felhunter,
	},
	exhaleWindow: 250,
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, //Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(),
	arcaneBrilliance: true,
	blessingOfKings: true,
	leaderOfThePack: true,
	blessingOfMight: true,
	bloodlust: true,
	moonkinAura: true,
	unholyAura: true,
});

export const DefaultIndividualBuffs = IndividualBuffs.create({});

export const DefaultDebuffs = Debuffs.create({
	curseOfElements: true,
	weakenedArmor: true,
	physicalVulnerability: true,
});

export const OtherDefaults = {
	race: Race.RaceTroll,
	distanceFromTarget: 25,
	profession1: Profession.Engineering,
	profession2: Profession.Herbalism,
	channelClipDelay: 150,
};

export const AFFLICTION_BREAKPOINTS = WARLOCK_BREAKPOINTS;

const ENCOUNTER_SINGLETARGET = PresetUtils.makePresetEncounter('Single Target Dummy', Encounter.defaultEncounterProto());
const ENCOUNTER_MULTITARGET = PresetUtils.makePresetEncounter('Multitarget', Encounter.defaultEncounterProto(3));

export const PRESET_SINGLETARGET = PresetUtils.makePresetBuild('Single Target', {
	talents: AfflictionTalents,
	rotation: APL_Default,
	encounter: ENCOUNTER_SINGLETARGET,
});

export const PRESET_MULTITARGET = PresetUtils.makePresetBuild('Multi Target', {
	talents: AfflictionTalents,
	rotation: APL_Multitarget,
	encounter: ENCOUNTER_MULTITARGET,
});
