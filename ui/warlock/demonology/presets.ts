import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Debuffs, Glyphs, IndividualBuffs, Profession, PseudoStat, Race, RaidBuffs, Stat } from '../../core/proto/common';
import { SavedTalents } from '../../core/proto/ui';
import {
	DemonologyWarlock_Options as WarlockOptions,
	WarlockMajorGlyph as MajorGlyph,
	WarlockMinorGlyph as MinorGlyph,
	WarlockOptions_Summon as Summon,
} from '../../core/proto/warlock';
import { Stats, UnitStat } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import { WARLOCK_BREAKPOINTS } from '../presets';
import DefaultAPL from './apls/default.apl.json';
import UvlsAPL from './apls/uvls.apl.json';
import P2Gear from './gear_sets/p2.gear.json';
import P3Gear from './gear_sets/p3.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P2_PRESET = PresetUtils.makePresetGear('P2 - BIS', P2Gear);
export const P3_PRESET = PresetUtils.makePresetGear('P3 - BIS', P3Gear);

export const APL_Default = PresetUtils.makePresetAPLRotation('Default', DefaultAPL);
export const APL_UVLS = PresetUtils.makePresetAPLRotation('UVLS', UvlsAPL);

// Preset options for EP weights
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Default',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.24,
		[Stat.StatSpellPower]: 1.0,
		[Stat.StatHitRating]: 0.93,
		[Stat.StatCritRating]: 0.6,
		[Stat.StatHasteRating]: 0.66,
		[Stat.StatMasteryRating]: 0.63,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wotlk.wowhead.com/talent-calc and copy the numbers in the url.
export const DemonologyTalentsDefault = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '231221',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfSoulstone,
			major2: MajorGlyph.GlyphOfSiphonLife,
			major3: MajorGlyph.GlyphOfImpSwarm,
			minor3: MinorGlyph.GlyphOfUnendingBreath,
		}),
	}),
};

export const DemonologyTalentsUVLS = {
	name: 'UVLS',
	data: SavedTalents.create({
		...DemonologyTalentsDefault.data,
		glyphs: Glyphs.create({
			...DemonologyTalentsDefault.data.glyphs,
			major2: MajorGlyph.GlyphOfEternalResolve,
		}),
	}),
};

export const DefaultOptions = WarlockOptions.create({
	classOptions: {
		summon: Summon.Felguard,
		detonateSeed: false,
	},
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
	profession2: Profession.Tailoring,
	channelClipDelay: 150,
};

export const PRESET_BUILD_P2 = PresetUtils.makePresetBuild('T14', {
	gear: P2_PRESET,
	talents: DemonologyTalentsDefault,
	rotation: APL_Default,
	settings: {
		name: 'T14',
		playerOptions: OtherDefaults,
	},
});
export const PRESET_BUILD_P3 = PresetUtils.makePresetBuild('T15', {
	gear: P3_PRESET,
	talents: DemonologyTalentsUVLS,
	rotation: APL_UVLS,
	settings: {
		name: 'T15',
		playerOptions: {
			...OtherDefaults,
			profession1: Profession.Engineering,
			profession2: Profession.Herbalism,
		},
	},
});

export const DEMONOLOGY_BREAKPOINTS = {
	unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
	presets: new Map([
		...[...WARLOCK_BREAKPOINTS.presets!],
		['16-tick - Immo Aura', 3.35918],
		['8-tick - Immolate:Inferno', 7.12373],
		['17-tick - Immo Aura', 9.95053],
		['18-tick - Immo Aura', 16.61809],
		['9-tick - Immolate:Inferno', 21.43291],
		['19-tick - Immo Aura', 23.38064],
		['20-tick - Immo Aura', 29.95453],
		['10-tick - Immolate:Inferno', 35.71591],
		['21-tick - Immo Aura', 36.70542],
		['22-tick - Immo Aura', 43.3692],
		['11-tick - Immolate:Inferno', 50.03752],
		['23-tick - Immo Aura', 50.03753],
		['24-tick - Immo Aura', 56.6171],
		['25-tick - Immo Aura', 63.26533],
		['12-tick - Immolate:Inferno', 64.24857],
		['26-tick - Immo Aura', 69.92356],
		['27-tick - Immo Aura', 76.52254],
		['13-tick - Immolate:Inferno', 78.6246],
		['28-tick - Immo Aura', 83.31809],
		['29-tick - Immo Aura', 89.93356],
		['14-tick - Immolate:Inferno', 92.86404],
		['30-tick - Immo Aura', 96.65687],
		['31-tick - Immo Aura', 103.45884],
		['15-tick - Immolate:Inferno', 107.11082],
		['32-tick - Immo Aura', 109.86363],
		// ['33-tick - Immo Aura', 116.68477],
		// ['16-tick - Immolate:Inferno', 121.48396],
		// ['34-tick - Immo Aura', 123.46374],
		// ['35-tick - Immo Aura', 130.14965],
		// ['17-tick - Immolate:Inferno', 135.7564],
		// ['36-tick - Immo Aura', 136.68645],
		// ['37-tick - Immo Aura', 143.60542],
		// ['38-tick - Immo Aura', 149.68795],
		// ['18-tick - Immolate:Inferno', 149.8959],
		// ['39-tick - Immo Aura', 156.73948],
		// ['40-tick - Immo Aura', 163.50468],
		// ['19-tick - Immolate:Inferno', 164.20082],
		// ['41-tick - Immo Aura', 169.90561],
		// ['42-tick - Immo Aura', 176.62525],
		// ['20-tick - Immolate:Inferno', 178.68094],
		// ['43-tick - Immo Aura', 183.68802],
		// ['21-tick - Immolate:Inferno', 192.8258],
		// ['22-tick - Immolate:Inferno', 207.21969],
		// ['23-tick - Immolate:Inferno', 221.37122],
		// ['24-tick - Immolate:Inferno', 235.75829],
	]),
};
