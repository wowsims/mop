import { ResourceType } from '../../../../../proto/spell';
import { ActionId, buffAuraToSpellIdMap, resourceTypeToIcon } from '../../../../../proto_utils/action_id';
import type { AuraUptimeLog, CastLog, ResourceChangedLogGroup } from '../../../../../proto_utils/logs_parser';
import { resourceNames } from '../../../../../proto_utils/names';
import type { UnitMetrics } from '../../../../../proto_utils/sim_result';
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
	if (castLog.damageDealtLogs.length === 0) return castLog.cancelTime ? 'cancelled' : 'none';
	const ddl = castLog.damageDealtLogs[0];
	if (ddl.miss || ddl.dodge || ddl.parry) return 'miss';
	if (ddl.glance || ddl.block || ddl.partialResist1_4 || ddl.partialResist2_4 || ddl.partialResist3_4) return 'partial';
	if (ddl.crit) return 'crit';
	return 'hit';
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
		const width = castLog.cancelTime || castLog.castTime + castLog.travelTime;
		const cancelled = !!castLog.cancelTime;
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

function resourceItems(resourceType: ResourceType, resourceLogs: Array<ResourceChangedLogGroup>, duration: number): Array<ResourceItem> {
	const startValue = (group: ResourceChangedLogGroup): number => (group.maxValue == null ? resourceLogs[0].valueBefore : group.maxValue);
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
		const section: Section = { id, index, kind, label, separatorKey: null, headerKey: null, rowKeys: [] };
		sections.push(section);
		if (separator) {
			section.separatorKey = `sep:${index}`;
			addRow({ kind: 'separator', key: section.separatorKey, section: id, height: ROW_HEIGHTS.separator, hideable: false });
		}
		if (header) {
			section.headerKey = `header:${id}`;
			addRow({
				kind: 'header',
				key: section.headerKey,
				section: id,
				height: ROW_HEIGHTS.header,
				hideable: false,
				label: header.label,
				actionId: header.actionId,
			});
		}
		return section;
	};

	const addResourceRow = (section: Section, scope: string, resourceType: ResourceType, resourceLogs: Array<ResourceChangedLogGroup>) => {
		if (resourceLogs.length == 0) return;

		let label = resourceNames.get(resourceType)!;
		let icon = resourceTypeToIcon[resourceType];
		if (resourceType == ResourceType.ResourceTypeGenericResource && !!secondaryResource) {
			label = secondaryResource.name ?? '';
			icon = secondaryResource.icon || '';
		}

		const items: Array<RowItem> = resourceItems(resourceType, resourceLogs, duration);
		addContentRow(section, {
			kind: 'resource',
			key: makeRowKey(section.id, 'resource', resourceBucketKey(resourceType)),
			section: section.id,
			height: ROW_HEIGHTS.resource,
			hideable: true,
			label,
			scope,
			resourceType,
			icon,
			cssName: resourceNames.get(resourceType)!.toLowerCase().replaceAll(' ', '-'),
			items,
			maxRightUpTo: sortAndPrefixMax(items),
		});
	};

	const addAuraRow = (section: Section, scope: string, auraUptimeLogs: Array<AuraUptimeLog>) => {
		const actionId = auraUptimeLogs[0].actionId!;
		const items: Array<RowItem> = auraItems(auraUptimeLogs, false);
		addContentRow(section, {
			kind: 'aura',
			key: makeRowKey(section.id, 'aura', actionId.equalityKey()),
			section: section.id,
			height: ROW_HEIGHTS.aura,
			hideable: true,
			label: IDS_TO_GROUP_FOR_ROTATION.includes(actionId.spellId) ? actionId.baseName : actionId.name,
			scope,
			actionId,
			items,
			maxRightUpTo: sortAndPrefixMax(items),
		});
	};

	const addCastRow = (section: Section, scope: string, castLogs: Array<CastLog>, aurasById: Array<Array<AuraUptimeLog>>) => {
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
			hideable: true,
			label: grouped ? actionId.baseName : actionId.name,
			scope,
			actionId,
			items,
			maxRightUpTo: sortAndPrefixMax(items),
		});
	};

	const playerSection = addSection('', 'player', '', false, null);
	ORDERED_RESOURCE_TYPES.forEach(resourceType => addResourceRow(playerSection, '', resourceType, player.groupedResourceLogs[resourceType]));

	const buffsById = groupedAurasByAbility(player.auraUptimeLogs);
	const debuffsByTargetById = targets.map(target => groupedAurasByAbility(target.auraUptimeLogs));
	const buffsAndDebuffsById = buffsById.concat(debuffsByTargetById[0]);

	AURA_AS_RESOURCE.forEach(actionId => {
		const auraUptimeLogs = buffsById.find(logs => logs[0].actionId!.equalityKey() === actionId.equalityKey());
		if (auraUptimeLogs) addAuraRow(playerSection, '', auraUptimeLogs);
	});

	const playerCastsByAbility = sortedCastsByAbility(player);
	playerCastsByAbility.forEach(castLogs => addCastRow(playerSection, '', castLogs, buffsAndDebuffsById));

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
			ORDERED_RESOURCE_TYPES.forEach(resourceType => addResourceRow(section, pet.name, resourceType, pet.groupedResourceLogs[resourceType]));
			castsByAbility.forEach(castLogs => addCastRow(section, pet.name, castLogs, buffsAndDebuffsById));
		});
	}

	const buffsToShow = buffsById.filter(
		auraUptimeLogs =>
			!playerCastsByAbility.some(casts => {
				const actionId = auraUptimeLogs[0].actionId;
				return (
					!!actionId &&
					(casts[0].actionId!.equalityKeyIgnoringTag() === actionId.equalityKeyIgnoringTag() ||
						AURA_AS_RESOURCE.some(auraId => auraId.equalityKey() === actionId.equalityKey()))
				);
			}),
	);
	if (buffsToShow.length > 0) {
		const section = addSection('buffs', 'buffs', '', true, null);
		buffsToShow.forEach(auraUptimeLogs => addAuraRow(section, '', auraUptimeLogs));
	}

	targets.forEach(target => {
		const targetCastsByAbility = sortedCastsByAbility(target);
		if (targetCastsByAbility.length > 0) {
			const section = addSection(`target-casts:${target.label}`, 'targetCasts', target.label, true, { label: target.label, actionId: null });
			targetCastsByAbility.forEach(castLogs => addCastRow(section, target.label, castLogs, buffsAndDebuffsById));
		}
	});

	debuffsByTargetById.forEach((debuffsToShow, index) => {
		if (debuffsToShow.length > 0) {
			const label = targets?.[index]?.label ?? '';
			const section = addSection(`target-debuffs:${label}`, 'targetDebuffs', label, true, { label, actionId: null });
			debuffsToShow.forEach(auraUptimeLogs => addAuraRow(section, label, auraUptimeLogs));
		}
	});

	return model;
}
