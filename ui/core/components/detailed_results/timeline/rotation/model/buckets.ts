import { APLActionItemSwap_SwapSet } from '../../../../../proto/apl';
import { OtherAction } from '../../../../../proto/common';
import { ResourceType } from '../../../../../proto/spell';
import { ActionId } from '../../../../../proto_utils/action_id';
import type { AuraUptimeLog, CastLog } from '../../../../../proto_utils/logs_parser';
import type { UnitMetrics } from '../../../../../proto_utils/sim_result';
import { actionCategory } from './categories';
import type { SectionId } from './types';

export const ROW_KEY_SEPARATOR = '\0';

export const ORDERED_RESOURCE_TYPES: Array<ResourceType> = [
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

export const PERCENTAGE_RESOURCES: Array<ResourceType> = [ResourceType.ResourceTypeHealth, ResourceType.ResourceTypeMana];

export const AURA_AS_RESOURCE: ActionId[] = [
	// APL Damage Amplifier
	ActionId.fromOtherId(OtherAction.OtherActionDamageAmplifier),

	// Item Swap
	ActionId.fromOtherId(OtherAction.OtherActionItemSwap, APLActionItemSwap_SwapSet.Main),
	ActionId.fromOtherId(OtherAction.OtherActionItemSwap, APLActionItemSwap_SwapSet.Swap1),

	// Vengeance
	ActionId.fromSpellId(84840), // Druid
	ActionId.fromSpellId(84839), // Paladin
	ActionId.fromSpellId(93098), // Warrior
	ActionId.fromSpellId(93099), // Death Knight
	ActionId.fromSpellId(120267), // Monk

	// Monk
	ActionId.fromSpellId(124255, 1), // Stagger
	ActionId.fromSpellId(128938), // Elusive Brew - Stacks
	ActionId.fromSpellId(115308), // Elusive Brew - Active
	ActionId.fromSpellId(1247279), // Tiger Eye Brew - Stacks
	ActionId.fromSpellId(1247275), // Tiger Eye Brew - Active

	// Mage
	ActionId.fromSpellId(148022), // Icicle
];
export const IDS_TO_GROUP_FOR_ROTATION: Array<number> = [
	5171, // Rogue - Slice and Dice
	2098, // Rogue - Eviscerate
	1943, // Rogue - Rupture
	51690, // Rogue - Killing Spree
	32645, // Rogue - Envenom
	16511, // Rogue - Hemorrhage
	121471, // Rogue - Shadow Blades
];

export function makeRowKey(section: SectionId, kind: string, bucketKey: string): string {
	return [section, kind, bucketKey].join(ROW_KEY_SEPARATOR);
}

export function actionBucketKey(actionId: ActionId): string {
	return IDS_TO_GROUP_FOR_ROTATION.includes(actionId.spellId) ? actionId.equalityKeyIgnoringTag() : actionId.equalityKey();
}

export function resourceBucketKey(resourceType: ResourceType): string {
	return `resource:${resourceType}`;
}

function compareNames(a: string, b: string): number {
	if (a < b) {
		return -1;
	} else if (b < a) {
		return 1;
	} else {
		return 0;
	}
}

function groupBy<T>(values: ReadonlyArray<T>, key: (value: T) => string): Array<Array<T>> {
	const groups = new Map<string, Array<T>>();
	for (const value of values) {
		const groupKey = key(value);
		const group = groups.get(groupKey);
		if (group) {
			group.push(value);
		} else {
			groups.set(groupKey, [value]);
		}
	}
	return [...groups.values()];
}

export function groupedAurasByAbility(auraUptimeLogs: ReadonlyArray<AuraUptimeLog>): Array<Array<AuraUptimeLog>> {
	const aurasByAbility = groupBy(auraUptimeLogs, log => log.actionId!.equalityKey());
	aurasByAbility.sort((a, b) => compareNames(a[0].actionId!.name, b[0].actionId!.name));
	return aurasByAbility;
}

export function sortedCastsByAbility(unit: UnitMetrics): Array<Array<CastLog>> {
	const meleeActionKeys = new Set(unit.getMeleeActions().map(action => action.actionId.equalityKey()));
	const spellActionKeys = new Set(unit.getSpellActions().map(action => action.actionId.equalityKey()));

	const castsByAbility = groupBy(unit.castLogs, log => actionBucketKey(log.actionId!));

	const categories = new Map<Array<CastLog>, number>();
	castsByAbility.forEach(casts => categories.set(casts, actionCategory(casts[0].actionId!, meleeActionKeys, spellActionKeys)));

	castsByAbility.sort((a, b) => {
		const categoryA = categories.get(a)!;
		const categoryB = categories.get(b)!;
		if (categoryA != categoryB) {
			return categoryA - categoryB;
		} else if (a[0].actionId!.anyId() == b[0].actionId!.anyId()) {
			return a[0].actionId!.tag - b[0].actionId!.tag;
		} else {
			return compareNames(a[0].actionId!.name, b[0].actionId!.name);
		}
	});

	return castsByAbility;
}
