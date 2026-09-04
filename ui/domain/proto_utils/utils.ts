import { Player } from '@generated/proto/api';
import { Class, Faction, Profession, Race, RaidBuffs, Spec, UnitReference, UnitReference_Type } from '@generated/proto/common';
import { ResourceType } from '@generated/proto/spell';

import { getEnumValues } from '../collections';
import { PlayerClass } from '../player_class';
import { PlayerClasses } from '../player_classes';
import { PlayerSpec } from '../player_spec';
import { PlayerSpecs } from '../player_specs';

// Converts '111111' to [1, 1, 1, 1, 1, 1].
export function getTalentTreePoints(talentsString: string): Array<number> {
	const talents = talentsString.split('');
	return talents.map(Number);
}

export function getTalentPoints(talentsString: string): number {
	return getTalentTreePoints(talentsString).filter(Boolean).length;
}

export function textCssClassForClass<ClassType extends Class>(playerClass: PlayerClass<ClassType>): string {
	return `text-${PlayerClasses.getCssClass(playerClass)}`;
}
export function textCssClassForSpec<SpecType extends Spec>(playerSpec: PlayerSpec<SpecType>): string {
	return textCssClassForClass(PlayerSpecs.getPlayerClass(playerSpec));
}

export const raceToFaction: Record<Race, Faction> = {
	[Race.RaceUnknown]: Faction.Unknown,

	[Race.RaceDraenei]: Faction.Alliance,
	[Race.RaceDwarf]: Faction.Alliance,
	[Race.RaceGnome]: Faction.Alliance,
	[Race.RaceHuman]: Faction.Alliance,
	[Race.RaceNightElf]: Faction.Alliance,
	[Race.RaceWorgen]: Faction.Alliance,
	[Race.RaceAlliancePandaren]: Faction.Alliance,

	[Race.RaceBloodElf]: Faction.Horde,
	[Race.RaceGoblin]: Faction.Horde,
	[Race.RaceOrc]: Faction.Horde,
	[Race.RaceTauren]: Faction.Horde,
	[Race.RaceTroll]: Faction.Horde,
	[Race.RaceUndead]: Faction.Horde,
	[Race.RaceHordePandaren]: Faction.Horde,
};

// Returns a copy of playerOptions, with the class field set.
export function getPlayerSpecFromPlayer<SpecType extends Spec>(player: Player): PlayerSpec<SpecType> {
	const specValues = getEnumValues(Spec);
	for (let i = 0; i < specValues.length; i++) {
		const spec = specValues[i] as SpecType;
		let specString = Spec[spec]; // Returns 'SpecBalanceDruid' for BalanceDruid.
		specString = specString.substring('Spec'.length); // 'BalanceDruid'
		specString = specString.charAt(0).toLowerCase() + specString.slice(1); // 'balanceDruid'

		if (player.spec.oneofKind == specString) {
			return PlayerSpecs.fromProto(spec);
		}
	}

	throw new Error('Unable to parse spec from player proto: ' + JSON.stringify(Player.toJson(player), null, 2));
}

export const hasBlacksmithing = (player: Player) => [player.profession1, player.profession2].includes(Profession.Blacksmithing);

// Returns all item slots to which the enchant might be applied.
//
// Note that this alone is not enough; some items have further restrictions,
// e.g. some weapon enchants may only be applied to 2H weapons.
export function newUnitReference(raidIndex: number): UnitReference {
	return UnitReference.create({
		type: UnitReference_Type.Player,
		index: raidIndex,
	});
}

export function emptyUnitReference(): UnitReference {
	return UnitReference.create();
}

export const orderedResourceTypes: Array<ResourceType> = [
	ResourceType.ResourceTypeHealth,
	ResourceType.ResourceTypeMana,
	ResourceType.ResourceTypeEnergy,
	ResourceType.ResourceTypeRage,
	ResourceType.ResourceTypeChi,
	ResourceType.ResourceTypeComboPoints,
	ResourceType.ResourceTypeFocus,
	ResourceType.ResourceTypeRunicPower,
	ResourceType.ResourceTypeBloodRune,
	ResourceType.ResourceTypeFrostRune,
	ResourceType.ResourceTypeUnholyRune,
	ResourceType.ResourceTypeDeathRune,
	ResourceType.ResourceTypeLunarEnergy,
	ResourceType.ResourceTypeSolarEnergy,
	ResourceType.ResourceTypeGenericResource,
];

export const AL_CATEGORY_HARD_MODE = 'Hard Mode';
export const AL_CATEGORY_TITAN_RUNE = 'Titan Rune';

export const defaultRaidBuffMajorDamageCooldowns = (classID?: Class): Partial<RaidBuffs> => {
	return RaidBuffs.create({
		skullBannerCount: classID == Class.ClassWarrior ? 1 : 2,
		stormlashTotemCount: classID == Class.ClassShaman ? 3 : 4,
	});
};

// Adds missing Consumables and SpellEffects to the given player proto.
