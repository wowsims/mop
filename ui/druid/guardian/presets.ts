import * as Mechanics from '../../core/constants/mechanics.js';
import * as PresetUtils from '../../core/preset_utils.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common';
import { DruidMajorGlyph, GuardianDruid_Options as DruidOptions, GuardianDruid_Rotation as DruidRotation } from '../../core/proto/druid.js';
import { SavedTalents } from '../../core/proto/ui.js';
// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
import PreraidGear from './gear_sets/preraid.gear.json';
export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-MSV BiS', PreraidGear);
import P1Gear from './gear_sets/p1.gear.json';
export const P1_PRESET = PresetUtils.makePresetGear('P1/P2', P1Gear);
import P2Gear from './gear_sets/p2.gear.json';
export const P2_PRESET = PresetUtils.makePresetGear('P2', P2Gear);
import P3Gear from './gear_sets/p3.gear.json';
export const P3_PRESET = PresetUtils.makePresetGear('P3', P3Gear);
import P4Gear from './gear_sets/p4.gear.json';
export const P4_PRESET = PresetUtils.makePresetGear('P4', P4Gear);

export const DefaultSimpleRotation = DruidRotation.create({
	maintainFaerieFire: true,
	maintainDemoralizingRoar: true,
	demoTime: 4.0,
	pulverizeTime: 4.0,
	prepullStampede: true,
});

import { Stats } from '../../core/proto_utils/stats';
import DefaultApl from './apls/default.apl.json';
import OffensiveHotwApl from './apls/offensiveHotw.apl.json';
export const ROTATION_DEFAULT = PresetUtils.makePresetAPLRotation("Gara'jal Default", DefaultApl);
export const ROTATION_HOTW = PresetUtils.makePresetAPLRotation("Gara'jal Offensive HotW", OffensiveHotwApl);

//export const ROTATION_PRESET_SIMPLE = PresetUtils.makePresetSimpleRotation('Simple Default', Spec.SpecGuardianDruid, DefaultSimpleRotation);

// Preset options for EP weights
export const SURVIVAL_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Survival',
	Stats.fromMap(
		{
			[Stat.StatHealth]: 0.08,
			[Stat.StatStamina]: 1.75,
			[Stat.StatAgility]: 1.0,
			[Stat.StatArmor]: 2.21,
			[Stat.StatBonusArmor]: 0.5,
			[Stat.StatDodgeRating]: 0.68,
			[Stat.StatMasteryRating]: 0.92,
			[Stat.StatStrength]: 0.06,
			[Stat.StatAttackPower]: 0.06,
			[Stat.StatHitRating]: 1.17,
			[Stat.StatExpertiseRating]: 1.09,
			[Stat.StatCritRating]: 1.06,
			[Stat.StatHasteRating]: 0.38,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.0,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 1.09 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[PseudoStat.PseudoStatSpellHitPercent]: 0.08 * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
		},
	),
);

export const BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Balanced',
	Stats.fromMap(
		{
			[Stat.StatHealth]: 0.06,
			[Stat.StatStamina]: 1.39,
			[Stat.StatAgility]: 1.0,
			[Stat.StatArmor]: 1.75,
			[Stat.StatBonusArmor]: 0.40,
			[Stat.StatDodgeRating]: 0.53,
			[Stat.StatMasteryRating]: 0.73,
			[Stat.StatStrength]: 0.12,
			[Stat.StatAttackPower]: 0.11,
			[Stat.StatHitRating]: 1.16,
			[Stat.StatExpertiseRating]: 1.08,
			[Stat.StatCritRating]: 1.05,
			[Stat.StatHasteRating]: 0.37,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.29,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 1.08 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[PseudoStat.PseudoStatSpellHitPercent]: 0.08 * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefensiveTalents = {
	name: 'Defensive',
	data: SavedTalents.create({
		talentsString: '010101',
		glyphs: Glyphs.create({
			major1: DruidMajorGlyph.GlyphOfMightOfUrsoc,
			major2: DruidMajorGlyph.GlyphOfMaul,
		}),
	}),
};

export const OffensiveTalents = {
	name: 'Offensive',
	data: SavedTalents.create({
		talentsString: '010103',
		glyphs: Glyphs.create({
			major1: DruidMajorGlyph.GlyphOfMightOfUrsoc,
			major2: DruidMajorGlyph.GlyphOfMaul,
		}),
	}),
};

export const DefaultOptions = DruidOptions.create({
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76087,
	foodId: 74656,
	potId: 76090,
	prepotId: 76090,
	conjuredId: 5512, // Conjured Healthstone
});
export const OtherDefaults = {
	iterationCount: 50000,
	profession1: Profession.Engineering,
	profession2: Profession.ProfessionUnknown,
};

export const PRESET_BUILD_GARAJAL = PresetUtils.makePresetBuild("Gara'jal", {
	rotation: ROTATION_DEFAULT,
	encounter: PresetUtils.makePresetEncounter(
		"Gara'jal",
		'http://localhost:5173/mop/druid/guardian/?i=rcmxe#eJzVUk1ME0EU3je7LLvTKNsRsR0iTOsPpSIpVdASzRYPwk0TjuphsUtYrW3TLRLrhZiohIMxXkRj/EEPxoMSLhoPBuQgGn8xoiEmRC5KohJv1YvubltRSDjDSzbz5r3v/XzfDvYqEIDzAOMArwFyAL0IziNhAKE9ggIhaEYKEI5+KLnMi/vj2gk9LbkUl3+N9HBCUKzPc39CCF1/IrT1bdkjPnD63OER5caRMIVk9zbH3qoz6LPg4f0uMh8iXroOr/K7sDwMIhak4X6J2ue5WZ6sp5XYHSyTRIKaOVqKSzDf0Gg66SvDQDy0YmGlhZC+BUg5JVkFC+GmiEny7QameVJN12crrejOBpOsoW5cJr3IAftdNPgLiESKgO+/xH8B1q7ZtVje3mDWsXBjU7H51RtiMRVu+j91+qVIBGqtT3y0Grv9ZXjVMGCCFGQlJ/tKKbbOR9OCHSGMVi2ETOREKlukTokOopnuxPWkDpOgIvGEn4KCLNtDm3BFsFwCIp8SC/LZYmAIOWs8tOTCNL/SZB/664+PiWQD9S3qFwltGgR7tVfX7MFAwjSE/YRh+ZlQoIXlC3zRlWYEW/kz4iDIzunU7KLNuI4EizX936Vije0uHLnDHmlXjwac6uKKb87Or2sLJdNS5zdbilRSL1aCq6USgtKcDcAoEnKSFxu/oFgOQT+/WeYs6903E3W/eG7bR9V3svxu66csitbi9zdTu/ET1SP6R6U2cKAcM6Nux+Hqo97Ll2x7qkbykdeqr9OxSbUl3+6rGp5Dqbl3fLaqVUtrNUe0OMt06aw9ZaSNTIeRiOlp60GwNnbIIwaHgFtGNhL9EJ2/9aaH6kdaFmIc4huvlbdcgp9ls/fv8dNqAZNTL0C39eJce9N6InuCZYxjevBAu3GsO65ljGTCCbCAkWCmfjiZiJm1TMuwni7jcBfLJFnMMLWOuM4yWuIoM3u0lMm0RIzpiXzUkrAjaZqs0Lyju7PTl5+bioanIDX6Y4DPetv143raEjjZydqT3XEzr/RW1sAOetCyVpvjbgVqFql9WwSb3OMlyYVXNrmxJcltW7nk2uAPnjgjFQ==',
	),
});
