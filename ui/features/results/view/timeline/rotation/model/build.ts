import { kebabCase } from '@domain/format';
import { ActionId, buffAuraToSpellIdMap, resourceTypeToIcon } from '@domain/proto_utils/action_id';
import type { AuraUptimeLog, CastLog, ResourceGroupLog } from '@domain/proto_utils/combat_log';
import { resourceNames } from '@domain/proto_utils/names';
import type { UnitMetrics } from '@domain/proto_utils/sim_result';
import { ResourceType } from '@generated/proto/spell';

import {
	actionBucketKey,
	AURA_AS_RESOURCE,
	groupedAurasByAbility,
	IDS_TO_GROUP_FOR_ROTATION,
	makeRowKey,
	ORDERED_RESOURCE_TYPES,
	PERCENTAGE_RESOURCES,
	resourceBucketKey,
	sortedCastsByAbility,
} from './buckets';
import type {
	AuraItem,
	AuraStackSegment,
	BuildRotationModelParams,
	CastOutcome,
	ContentRow,
	ResourceDisplay,
	ResourceItem,
	RotationModel,
	Row,
	RowItem,
	Section,
	SectionId,
	SectionKind,
} from './types';
import { ROW_HEIGHTS } from './types';

function castOutcome(castLog: CastLog): CastOutcome {
	if (castLog.damageDealtLogs.length === 0) return castLog.castCancelledLog ? 'cancelled' : 'none';
	const ddl = castLog.damageDealtLogs[0];
	switch (ddl.outcome) {
		case 'miss':
		case 'dodge':
		case 'parry':
			return 'miss';
		// A pre-union CriticalBlock set both `block` and `crit`, and the old chain tested
		// `block` first, so it read as partial rather than crit. Same for a plain block/glance.
		case 'block':
		case 'glance':
		case 'blocked-glance':
		case 'critical-block':
			return 'partial';
		case 'crit':
			return 'crit';
		default:
			return 'hit';
	}
}

function sortAndPrefixMax(items: Array<RowItem>): Array<number> {
	items.sort((a, b) => a.start - b.start);
	const maxRightUpTo: Array<number> = [];
	let max = -Infinity;
	for (const item of items) {
		max = Math.max(max, item.end);
		maxRightUpTo.push(max);
	}
	return maxRightUpTo;
}

function auraItems(auraUptimeLogs: ReadonlyArray<AuraUptimeLog>, sharesRowWithCast: boolean): Array<AuraItem> {
	return auraUptimeLogs.map(aul => {
		const start = aul.gainedAt;
		const width = aul.fadedAt === aul.gainedAt ? 0.001 : aul.fadedAt - aul.gainedAt;
		const stacks: Array<AuraStackSegment> = [];
		aul.stacksChange.forEach((scl, i) => {
			if (scl.timestamp == aul.fadedAt) return;
			stacks.push({
				offset: scl.timestamp - aul.timestamp,
				duration: aul.stacksChange[i + 1] ? aul.stacksChange[i + 1].timestamp - scl.timestamp : aul.fadedAt - scl.timestamp,
				stacks: scl.newStacks,
			});
		});
		return { kind: 'aura', start, end: start + width, stacks, sharesRowWithCast, log: aul };
	});
}

function castRowItems(castLogs: ReadonlyArray<CastLog>, mergedAuras: ReadonlyArray<Array<AuraUptimeLog>>): Array<RowItem> {
	const items: Array<RowItem> = [];
	castLogs.forEach(castLog => {
		const start = castLog.timestamp;
		const cancelled = !!castLog.castCancelledLog;
		const width = cancelled ? castLog.cancelTime : castLog.castTime + castLog.travelTime;
		const hasTravelTime = !cancelled && castLog.travelTime != 0;
		items.push({
			kind: 'cast',
			start,
			end: start + width,
			outcome: castOutcome(castLog),
			cancelled,
			travelStart: hasTravelTime ? castLog.castTime : null,
			travelDuration: hasTravelTime ? castLog.travelTime : null,
			log: castLog,
		});
		castLog.damageDealtLogs.filter(ddl => ddl.tick).forEach(ddl => items.push({ kind: 'tick', start: ddl.timestamp, end: ddl.timestamp, log: ddl }));
	});
	mergedAuras.forEach(auraUptimeLogs => items.push(...auraItems(auraUptimeLogs, true)));
	return items;
}

function resourceItems(resourceType: ResourceType, resourceLogs: Array<ResourceGroupLog>, duration: number): Array<ResourceItem> {
	const startValue = (group: ResourceGroupLog): number => (group.maxValue == null ? resourceLogs[0].valueBefore : group.maxValue);
	const display: ResourceDisplay = PERCENTAGE_RESOURCES.includes(resourceType)
		? 'percent'
		: resourceType == ResourceType.ResourceTypeEnergy ||
			  resourceType == ResourceType.ResourceTypeFocus ||
			  resourceType == ResourceType.ResourceTypeSolarEnergy ||
			  resourceType == ResourceType.ResourceTypeLunarEnergy
			? 'fill'
			: 'number';

	return resourceLogs.map((group, i) => {
		const start = group.timestamp;
		const width = (resourceLogs[i + 1]?.timestamp || duration) - start;
		const base = startValue(group);
		const percent = ((group.valueAfter / base) * 100).toFixed(0);
		return {
			kind: 'resource',
			start,
			end: start + width,
			startValue: base,
			display,
			fillPercent: Number(percent),
			text: display === 'percent' ? `${percent}%` : display === 'number' ? Math.floor(group.valueAfter).toFixed(0) : '',
			log: group,
		};
	});
}

export function buildRotationModel({ player, targets, duration, secondaryResource }: BuildRotationModelParams): RotationModel {
	const rows: Array<Row> = [];
	const sections: Array<Section> = [];
	const byKey = new Map<string, number>();
	const model: RotationModel = { duration, rows, sections, byKey };
	if (targets.length == 0) return model;

	const addRow = (row: Row) => {
		byKey.set(row.key, rows.length);
		rows.push(row);
	};

	const addContentRow = (section: Section, row: ContentRow) => {
		addRow(row);
		section.rowKeys.push(row.key);
	};

	const addSection = (
		id: SectionId,
		kind: SectionKind,
		label: string,
		separator: boolean,
		header: { label: string; actionId: ActionId | null } | null,
	): Section => {
		const index = sections.length;
		const section: Section = { id, kind, label, separatorKey: null, headerKey: null, rowKeys: [] };
		sections.push(section);
		if (separator) {
			section.separatorKey = `sep:${index}`;
			addRow({ kind: 'separator', key: section.separatorKey, section: id, height: ROW_HEIGHTS.separator });
		}
		if (header) {
			section.headerKey = `header:${id}`;
			addRow({
				kind: 'header',
				key: section.headerKey,
				section: id,
				height: ROW_HEIGHTS.header,
				label: header.label,
				actionId: header.actionId,
			});
		}
		return section;
	};

	const addResourceRow = (section: Section, resourceType: ResourceType, resourceLogs: Array<ResourceGroupLog>) => {
		if (resourceLogs.length == 0) return;

		let label = resourceNames.get(resourceType)!;
		let icon = resourceTypeToIcon[resourceType];
		// Every generic resource is the same ResourceType, so the row is classed by the spec's
		// own resource name instead: 'Generic Resource' can carry no colour.
		let cssName = kebabCase(resourceNames.get(resourceType)!);
		if (resourceType == ResourceType.ResourceTypeGenericResource && !!secondaryResource) {
			label = secondaryResource.name ?? '';
			icon = secondaryResource.icon || '';
			if (label) cssName = `secondary-resource secondary-resource--${kebabCase(label)}`;
		}

		const items: Array<RowItem> = resourceItems(resourceType, resourceLogs, duration);
		addContentRow(section, {
			kind: 'resource',
			key: makeRowKey(section.id, 'resource', resourceBucketKey(resourceType)),
			section: section.id,
			height: ROW_HEIGHTS.resource,
			label,
			icon,
			cssName,
			items,
			maxRightUpTo: sortAndPrefixMax(items),
		});
	};

	const addAuraRow = (section: Section, auraUptimeLogs: Array<AuraUptimeLog>) => {
		const actionId = auraUptimeLogs[0].actionId!;
		const items: Array<RowItem> = auraItems(auraUptimeLogs, false);
		addContentRow(section, {
			kind: 'aura',
			key: makeRowKey(section.id, 'aura', actionId.equalityKey()),
			section: section.id,
			height: ROW_HEIGHTS.aura,
			label: IDS_TO_GROUP_FOR_ROTATION.includes(actionId.spellId) ? actionId.baseName : actionId.name,
			actionId,
			items,
			maxRightUpTo: sortAndPrefixMax(items),
		});
	};

	const addCastRow = (section: Section, castLogs: Array<CastLog>, aurasById: Array<Array<AuraUptimeLog>>) => {
		const actionId = castLogs[0].actionId!;
		const grouped = IDS_TO_GROUP_FOR_ROTATION.includes(actionId.spellId);
		const mergedAuras = aurasById.filter(auraUptimeLogs => {
			const auraActionId = auraUptimeLogs[0].actionId!;
			const mapped = buffAuraToSpellIdMap[auraActionId.spellId] ?? auraActionId;
			return grouped ? actionId.equalityKeyIgnoringTag() === mapped.equalityKeyIgnoringTag() : actionId.equalityKey() === mapped.equalityKey();
		});

		const items = castRowItems(castLogs, mergedAuras);
		addContentRow(section, {
			kind: 'cast',
			key: makeRowKey(section.id, 'cast', actionBucketKey(actionId)),
			section: section.id,
			height: ROW_HEIGHTS.cast,
			label: grouped ? actionId.baseName : actionId.name,
			actionId,
			items,
			maxRightUpTo: sortAndPrefixMax(items),
		});
	};

	const playerSection = addSection('', 'player', '', false, null);
	ORDERED_RESOURCE_TYPES.forEach(resourceType => addResourceRow(playerSection, resourceType, player.groupedResourceLogs[resourceType]));

	const buffsById = groupedAurasByAbility(player.auraUptimeLogs);
	const debuffsByTargetById = targets.map(target => groupedAurasByAbility(target.auraUptimeLogs));
	const buffsAndDebuffsById = buffsById.concat(debuffsByTargetById[0]);

	AURA_AS_RESOURCE.forEach(actionId => {
		const auraUptimeLogs = buffsById.find(logs => logs[0].actionId!.equalityKey() === actionId.equalityKey());
		if (auraUptimeLogs) addAuraRow(playerSection, auraUptimeLogs);
	});

	const playerCastsByAbility = sortedCastsByAbility(player);
	playerCastsByAbility.forEach(castLogs => addCastRow(playerSection, castLogs, buffsAndDebuffsById));

	if (player.pets.length > 0) {
		const playerPets = new Map<string, { pet: UnitMetrics; castsByAbility: Array<Array<CastLog>> }>();
		player.pets.forEach(petsLog => {
			const petCastsByAbility = sortedCastsByAbility(petsLog);
			if (petCastsByAbility.length > 0 && !playerPets.has(petsLog.name)) {
				playerPets.set(petsLog.name, { pet: petsLog, castsByAbility: petCastsByAbility });
			}
		});

		playerPets.forEach(({ pet, castsByAbility }) => {
			const section = addSection(`pet:${pet.name}`, 'pet', pet.name, true, { label: pet.name, actionId: ActionId.fromPetName(pet.name) });
			ORDERED_RESOURCE_TYPES.forEach(resourceType => addResourceRow(section, resourceType, pet.groupedResourceLogs[resourceType]));
			castsByAbility.forEach(castLogs => addCastRow(section, castLogs, buffsAndDebuffsById));
		});
	}

	const auraAsResourceKeys = new Set(AURA_AS_RESOURCE.map(auraId => auraId.equalityKey()));
	const playerCastKeys = new Set(playerCastsByAbility.map(casts => casts[0].actionId!.equalityKeyIgnoringTag()));
	const buffsToShow = buffsById.filter(auraUptimeLogs => {
		const actionId = auraUptimeLogs[0].actionId;
		// The aura-as-resource test does not depend on the cast, but it sat inside the per-cast
		// scan, so with no player casts at all it never ran. Kept that way here: this is a
		// performance change, and correcting it would move rows.
		if (!actionId || playerCastKeys.size === 0) return true;
		return !playerCastKeys.has(actionId.equalityKeyIgnoringTag()) && !auraAsResourceKeys.has(actionId.equalityKey());
	});
	if (buffsToShow.length > 0) {
		const section = addSection('buffs', 'buffs', '', true, null);
		buffsToShow.forEach(auraUptimeLogs => addAuraRow(section, auraUptimeLogs));
	}

	targets.forEach(target => {
		const targetCastsByAbility = sortedCastsByAbility(target);
		if (targetCastsByAbility.length > 0) {
			const section = addSection(`target-casts:${target.label}`, 'targetCasts', target.label, true, { label: target.label, actionId: null });
			targetCastsByAbility.forEach(castLogs => addCastRow(section, castLogs, buffsAndDebuffsById));
		}
	});

	debuffsByTargetById.forEach((debuffsToShow, index) => {
		if (debuffsToShow.length > 0) {
			const label = targets?.[index]?.label ?? '';
			const section = addSection(`target-debuffs:${label}`, 'targetDebuffs', label, true, { label, actionId: null });
			debuffsToShow.forEach(auraUptimeLogs => addAuraRow(section, auraUptimeLogs));
		}
	});

	return model;
}
