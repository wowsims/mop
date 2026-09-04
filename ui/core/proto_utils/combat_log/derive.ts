import { ResourceType } from '../../proto/spell';
import { bucket, getEnumValues, stringComparator, sum } from '../../utils';
import type { ActionId } from '../action_id';
import { computeActionIdAsString } from './parse';
import {
	AuraLog,
	AuraStacksLog,
	AuraUptimeLog,
	BaseLog,
	CastBeganLog,
	CastCancelledLog,
	CastCompletedLog,
	CastLog,
	CombatLog,
	DamageLog,
	DpsLog,
	Entity,
	isAura,
	isAuraStacks,
	isCastBegan,
	isCastCancelled,
	isCastCompleted,
	isDamage,
	isResource,
	ResourceGroupLog,
	ResourceLog,
	ThreatLogGroup,
} from './types';

export const DPS_WINDOW = 15; // Window over which to calculate DPS.

export function groupDuplicateTimestamps<T extends BaseLog>(logs: Array<T>): Array<Array<T>> {
	const grouped: Array<Array<T>> = [];
	let curGroup: Array<T> = [];

	logs.forEach(log => {
		if (curGroup.length == 0 || log.timestamp == curGroup[0].timestamp) {
			curGroup.push(log);
		} else {
			grouped.push(curGroup);
			curGroup = [log];
		}
	});
	if (curGroup.length > 0) {
		grouped.push(curGroup);
	}

	return grouped;
}

export function buildDpsLogs(damageLogs: Array<DamageLog>): Array<DpsLog> {
	const groupedDamageLogs = groupDuplicateTimestamps(damageLogs);

	let curDamageLogs: Array<DamageLog> = [];
	let curDamageTotal = 0;

	return groupedDamageLogs.map(ddLogGroup => {
		ddLogGroup.forEach(ddLog => {
			curDamageLogs.push(ddLog);
			curDamageTotal += ddLog.amount;
		});

		const newStartIdx = curDamageLogs.findIndex(curLog => {
			const inWindow = curLog.timestamp > ddLogGroup[0].timestamp - DPS_WINDOW;
			if (!inWindow) {
				curDamageTotal -= curLog.amount;
			}
			return inWindow;
		});
		if (newStartIdx == -1) {
			curDamageLogs = [];
		} else {
			curDamageLogs = curDamageLogs.slice(newStartIdx);
		}

		const dps = curDamageTotal / DPS_WINDOW;
		if (isNaN(dps)) {
			console.warn('NaN dps!');
		}

		const dpsLog: DpsLog = {
			raw: '',
			logIndex: ddLogGroup[0].logIndex,
			timestamp: ddLogGroup[0].timestamp,
			source: ddLogGroup[0].source,
			target: null,
			actionId: null,
			actionIdAsString: null,
			spellSchool: ddLogGroup[0].spellSchool,
			threat: 0,
			activeAuras: [],
			kind: 'dps',
			dps,
			damageLogs: ddLogGroup,
		};
		return dpsLog;
	});
}

export function buildThreatGroups(logs: Array<CombatLog>): Array<ThreatLogGroup> {
	const groupedLogs = groupDuplicateTimestamps(logs.filter(log => log.threat != 0));
	let curThreat = 0;
	return groupedLogs.map(logGroup => {
		const newThreat = sum(logGroup.map(log => log.threat));
		const threatLog: ThreatLogGroup = {
			raw: '',
			logIndex: logGroup[0].logIndex,
			timestamp: logGroup[0].timestamp,
			source: logGroup[0].source,
			target: logGroup[0].target,
			actionId: null,
			actionIdAsString: null,
			spellSchool: logGroup[0].spellSchool,
			threat: newThreat,
			activeAuras: [],
			kind: 'threat-group',
			threatBefore: curThreat,
			threatAfter: curThreat + newThreat,
			logs: logGroup,
		};

		curThreat += newThreat;
		return threatLog;
	});
}

const RESOURCE_TYPES = (getEnumValues(ResourceType) as Array<ResourceType>).filter(val => val != ResourceType.ResourceTypeNone);

export function buildResourceGroups(logs: Array<CombatLog>): Record<ResourceType, Array<ResourceGroupLog>> {
	// Bucket by resource type in one pass rather than filtering the whole log array once per
	// resource type.
	const byResourceType = new Map<ResourceType, Array<ResourceLog>>();
	for (const log of logs) {
		if (!isResource(log)) continue;
		const existing = byResourceType.get(log.resourceType);
		if (existing) {
			existing.push(log);
		} else {
			byResourceType.set(log.resourceType, [log]);
		}
	}

	const maxResource = (resourceLogs: Array<ResourceLog>) => {
		let max = 0;
		resourceLogs.forEach(l => {
			if (l.total > max) max = l.total;
		});
		return max;
	};

	const results: Partial<Record<ResourceType, Array<ResourceGroupLog>>> = {};
	RESOURCE_TYPES.forEach(resourceType => {
		const resourceLogs = byResourceType.get(resourceType);
		// Skip grouping entirely for the ~15 resource types a given fight never touches, rather
		// than running an empty bucket through groupDuplicateTimestamps().map() for nothing.
		if (!resourceLogs) {
			results[resourceType] = [];
			return;
		}
		results[resourceType] = groupDuplicateTimestamps(resourceLogs).map(logGroup => {
			const groupLog: ResourceGroupLog = {
				raw: '',
				logIndex: logGroup[0].logIndex,
				timestamp: logGroup[0].timestamp,
				source: logGroup[0].source,
				target: logGroup[0].target,
				actionId: null,
				actionIdAsString: null,
				spellSchool: logGroup[0].spellSchool,
				threat: 0,
				activeAuras: [],
				kind: 'resource-group',
				resourceType,
				valueBefore: logGroup[0].valueBefore,
				valueAfter: logGroup[logGroup.length - 1].valueAfter,
				maxValue: maxResource(logGroup),
				logs: logGroup,
			};
			return groupLog;
		});
	});

	return results as Record<ResourceType, Array<ResourceGroupLog>>;
}

type UnmatchedGained = { gained: AuraLog; stacks: Array<AuraStacksLog> };

export function buildAuraUptimes(logs: Array<CombatLog>, entity: Entity, encounterDuration: number): Array<AuraUptimeLog> {
	// openEntries preserves the same append-only order as the old flat unmatchedGainedLogs
	// array; openByKey buckets its indices by equalsIgnoringTag identity so a fade/stacks event
	// finds its match in O(1) instead of rescanning every still-open aura. Old code's findIndex
	// predicate was `equals(x) || equalsIgnoringTag(x)`, which reduces to equalsIgnoringTag since
	// equals() implies it (action_id.ts:187), so bucketing on that key changes nothing about which
	// entry a given event resolves to.
	const openEntries: Array<UnmatchedGained | null> = [];
	const openByKey = new Map<string, Array<number>>();
	const uptimeLogs: Array<AuraUptimeLog> = [];

	const keyFor = (actionId: ActionId) => actionId.equalityKeyIgnoringTag();

	const pushOpen = (entry: UnmatchedGained) => {
		const index = openEntries.push(entry) - 1;
		const key = keyFor(entry.gained.actionId!);
		const indices = openByKey.get(key);
		if (indices) {
			indices.push(index);
		} else {
			openByKey.set(key, [index]);
		}
	};
	// Mutates the matched entry in place without removing it, mirroring the old code's
	// unmatchedGainedLogs[idx].stacks.push - a stacks-change log doesn't close the aura.
	const peekOpen = (actionId: ActionId): UnmatchedGained | null => {
		const indices = openByKey.get(keyFor(actionId));
		if (!indices || indices.length == 0) return null;
		return openEntries[indices[0]];
	};
	const removeOpen = (actionId: ActionId): UnmatchedGained | null => {
		const indices = openByKey.get(keyFor(actionId));
		if (!indices || indices.length == 0) return null;
		const index = indices.shift()!;
		const entry = openEntries[index];
		openEntries[index] = null;
		return entry;
	};

	logs.forEach(log => {
		if (!log.source || !log.source.equals(entity)) {
			return;
		}

		if (isAuraStacks(log)) {
			if (log.newStacks <= 0) {
				return;
			}
			const matched = peekOpen(log.actionId!);
			if (!matched) {
				console.warn('Unmatched aura stacks change log: ' + log.actionId!.name);
				return;
			}
			matched.stacks.push(log);
			return;
		}

		if (!isAura(log)) {
			return;
		}

		if (log.isGained) {
			pushOpen({ gained: log, stacks: [] });
			return;
		}

		const matched = removeOpen(log.actionId!);
		if (!matched) {
			console.warn('Unmatched aura faded log: ' + log.actionId!.name);
			return;
		}
		const gainedLog = matched.gained;

		uptimeLogs.push({
			raw: log.raw,
			logIndex: gainedLog.logIndex,
			timestamp: gainedLog.timestamp,
			source: log.source,
			target: log.target,
			actionId: gainedLog.actionId,
			actionIdAsString: gainedLog.actionIdAsString,
			spellSchool: log.spellSchool,
			threat: gainedLog.threat,
			activeAuras: [],
			kind: 'aura-uptime',
			gainedAt: gainedLog.timestamp,
			fadedAt: log.timestamp,
			stacksChange: matched.stacks,
		});

		if (log.isRefreshed) {
			pushOpen({ gained: log, stacks: [] });
		}
	});

	// Auras active at the end won't have a faded log, so need to add them separately.
	for (const entry of openEntries) {
		if (!entry) continue;
		const gainedLog = entry.gained;
		uptimeLogs.push({
			raw: gainedLog.raw,
			logIndex: gainedLog.logIndex,
			timestamp: gainedLog.timestamp,
			source: gainedLog.source,
			target: gainedLog.target,
			actionId: gainedLog.actionId,
			actionIdAsString: gainedLog.actionIdAsString,
			spellSchool: gainedLog.spellSchool,
			threat: gainedLog.threat,
			activeAuras: [],
			kind: 'aura-uptime',
			gainedAt: gainedLog.timestamp,
			fadedAt: encounterDuration,
			stacksChange: entry.stacks,
		});
	}

	uptimeLogs.sort((a, b) => a.gainedAt - b.gainedAt);
	return uptimeLogs;
}

// Populates the activeAuras field for all logs using the provided auras.
export function populateActiveAuras(logs: Array<CombatLog>, auraLogs: Array<AuraUptimeLog>): void {
	// `curAuras` is kept sorted by name as auras come and go, rather than being filtered,
	// copied and re-sorted for every single log. Insertion goes after any equal name so
	// the result matches what a stable sort of the arrival order produced before.
	const curAuras: Array<AuraUptimeLog> = [];
	let auraLogsIndex = 0;
	let changed = true;
	// Shared by every log until the active set changes (contract invariant #2) - mutate this
	// array and every earlier log still pointing at it silently corrupts too.
	let activeAuras: Array<AuraUptimeLog> = [];

	for (const log of logs) {
		while (auraLogsIndex < auraLogs.length && auraLogs[auraLogsIndex].gainedAt <= log.timestamp) {
			const gained = auraLogs[auraLogsIndex];
			let insertAt = curAuras.length;
			while (insertAt > 0 && stringComparator(curAuras[insertAt - 1].actionId!.name, gained.actionId!.name) > 0) {
				insertAt--;
			}
			curAuras.splice(insertAt, 0, gained);
			auraLogsIndex++;
			changed = true;
		}
		for (let i = curAuras.length - 1; i >= 0; i--) {
			if (curAuras[i].fadedAt <= log.timestamp) {
				curAuras.splice(i, 1);
				changed = true;
			}
		}

		if (changed) {
			activeAuras = curAuras.slice();
			changed = false;
		}
		log.activeAuras = activeAuras;
	}
}

function buildCastLog(
	castBeganLog: CastBeganLog,
	castCompletedLog: CastCompletedLog | null,
	castCancelledLog: CastCancelledLog | null,
	damageDealtLogs: Array<DamageLog>,
): CastLog {
	const actionId = castCompletedLog?.actionId || castCancelledLog?.actionId || castBeganLog.actionId; // Use completed log because of arcane blast
	const spellSchool = castCompletedLog?.spellSchool || castCancelledLog?.spellSchool || castBeganLog.spellSchool;
	const threat = castCompletedLog?.threat || castCancelledLog?.threat || castBeganLog.threat;

	let castTime = castBeganLog.castTime;
	let effectiveTime = castBeganLog.effectiveTime;
	if (castCompletedLog) {
		castTime = castCompletedLog.timestamp - castBeganLog.timestamp;
		effectiveTime = castCompletedLog.timestamp - castBeganLog.timestamp;
	}
	const cancelTime = castCancelledLog?.cancelTime || 0;

	let travelTime = 0;
	if (castCompletedLog && damageDealtLogs.length >= 1 && castCompletedLog.timestamp < damageDealtLogs[0].timestamp && !damageDealtLogs[0].tick) {
		travelTime = damageDealtLogs[0].timestamp - castCompletedLog.timestamp;
	}

	return {
		raw: castBeganLog.raw,
		logIndex: castBeganLog.logIndex,
		timestamp: castBeganLog.timestamp,
		source: castBeganLog.source,
		target: castBeganLog.target,
		actionId,
		actionIdAsString: computeActionIdAsString(actionId),
		spellSchool,
		threat,
		activeAuras: [],
		kind: 'cast',
		castTime,
		effectiveTime,
		travelTime,
		cancelTime,
		castBeganLog,
		castCancelledLog,
		castCompletedLog,
		damageDealtLogs,
	};
}

export function buildCastLogs(logs: Array<CombatLog>): Array<CastLog> {
	// One classification pass instead of four full scans of the same array.
	const castBeganLogs: Array<CastBeganLog> = [];
	const castCompletedLogs: Array<CastCompletedLog> = [];
	const castCancelledLogs: Array<CastCancelledLog> = [];
	const damageLogs: Array<DamageLog> = [];
	for (const log of logs) {
		if (isCastBegan(log)) castBeganLogs.push(log);
		else if (isCastCompleted(log)) castCompletedLogs.push(log);
		else if (isCastCancelled(log)) castCancelledLogs.push(log);
		else if (isDamage(log)) damageLogs.push(log);
	}

	const toBucketKey = (actionId: ActionId) => {
		if (actionId.spellId == 30451 || actionId.spellId == 127632) {
			// Arcane Blast is unique because it can finish its cast as a different spell than it
			// started (if stacks drop). Also handle Shadow's Cascade for bouncing.
			return actionId.toStringIgnoringTag();
		} else {
			return actionId.toString();
		}
	};
	const castBeganLogsByAbility = bucket(castBeganLogs, log => toBucketKey(log.actionId!));
	const castCompletedLogsByAbility = bucket(castCompletedLogs, log => toBucketKey(log.actionId!));
	const castCancelledLogsByAbility = bucket(castCancelledLogs, log => toBucketKey(log.actionId!));
	const damageLogsByAbility = bucket(damageLogs, log => toBucketKey(log.actionId!));

	const castLogs: Array<CastLog> = [];
	Object.keys(castBeganLogsByAbility).forEach(bucketKey => {
		const abilityCastsBegan = castBeganLogsByAbility[bucketKey]!;
		const abilityCastsCompleted = castCompletedLogsByAbility[bucketKey];
		const abilityCastsCancelled = castCancelledLogsByAbility[bucketKey];
		const abilityDamage = damageLogsByAbility[bucketKey];

		let ddIdx = 0;
		let castSkipIdx = 0;
		// abilityCastsCancelled is in the same log order as abilityCastsBegan, and each cbLog's
		// cancel window starts where the previous one's ended - a monotonic cursor never needs to
		// revisit a candidate the old per-cbLog .find() had already passed.
		let cancelCursor = 0;
		for (let cbIdx = 0; cbIdx < abilityCastsBegan.length; cbIdx++) {
			const cbLog = abilityCastsBegan[cbIdx];

			// Assume cast completed log is the same index because they always come in pairs.
			// Only exception is final pair, where there might be a cast began without a cast completed.
			let ccLog: CastCompletedLog | null = null;
			let cCancelLog: CastCancelledLog | null = null;
			let nextCcLog: CastCompletedLog | null = null;
			if (abilityCastsCompleted && cbIdx < abilityCastsCompleted.length) {
				ccLog = abilityCastsCompleted[cbIdx + castSkipIdx];
				if (cbIdx + castSkipIdx + 1 < abilityCastsCompleted.length) {
					nextCcLog = abilityCastsCompleted[cbIdx + castSkipIdx + 1];
				}
			}

			if (abilityCastsCancelled) {
				while (cancelCursor < abilityCastsCancelled.length && abilityCastsCancelled[cancelCursor].timestamp < cbLog.timestamp) {
					cancelCursor++;
				}
				const candidate = abilityCastsCancelled[cancelCursor];
				const nextBegan = abilityCastsBegan[cbIdx + 1];
				if (candidate && (!nextBegan || candidate.timestamp <= nextBegan.timestamp)) {
					cCancelLog = candidate;
					cancelCursor++;
					castSkipIdx--;
				}
			}

			// Find all damage dealt logs between the cur and next cast completed logs.
			const ddLogs: Array<DamageLog> = [];
			while (!cCancelLog && abilityDamage && ddIdx < abilityDamage.length && (!nextCcLog || abilityDamage[ddIdx].timestamp < nextCcLog.timestamp)) {
				ddLogs.push(abilityDamage[ddIdx]);
				ddIdx++;
			}
			castLogs.push(buildCastLog(cbLog, ccLog, cCancelLog, ddLogs));
		}
	});

	castLogs.sort((a, b) => a.timestamp - b.timestamp);
	return castLogs;
}
