import { ResourceType } from '../../../../proto/spell';
import type {
	AuraLog,
	AuraStacksLog,
	CastBeganLog,
	CastCancelledLog,
	CastCompletedLog,
	CastLog,
	CombatLog,
	DamageLog,
	MajorCooldownLog,
	ResourceGroupLog,
	ResourceLog,
	StatChangeLog,
} from '../../../../proto_utils/combat_log';
import { matchTimestampPrefix } from '../../../../proto_utils/combat_log';
import { resourceNames } from '../../../../proto_utils/names';
import { SECONDARY_RESOURCES } from '../../../../proto_utils/secondary_resource';
import { ActionLink } from './action_link';
import { EntityLabel } from './entity_label';
import { Results } from './results';

function Prefix(log: CombatLog, includeTimestamp: boolean): JSX.Element {
	const prefix = includeTimestamp ? `[${log.timestamp.toFixed(2)}]` : '';
	return (
		<>
			{prefix}
			{log.source && EntityLabel(log.source)}
		</>
	);
}

function DefaultLogElem(log: CombatLog, includeTimestamp: boolean): JSX.Element {
	let html: JSX.Element = <>{log.raw}</>;
	if (!includeTimestamp) {
		// Group 3 only: combat_log's own rawWithoutTimestamp keeps the entity bracket for plain-text
		// export, while this path drops it because EntityLabel supplies a styled replacement.
		const captureArr = matchTimestampPrefix(log.raw);
		if (captureArr) {
			html = <>{captureArr[3]}</>;
		}
	}
	if (log.source) {
		html = (
			<>
				{EntityLabel(log.source)} {html}
			</>
		);
	}
	return html;
}

function DamageLogElem(log: DamageLog, includeTimestamp: boolean): JSX.Element {
	const threatPostfix = log.source?.isTarget ? '' : ` (${log.threat.toFixed(2)} Threat)`;
	return (
		<>
			{Prefix(log, includeTimestamp)} {ActionLink(log.actionId!)} {Results(log)}
			{threatPostfix}
		</>
	);
}

function ResourceLogElem(log: ResourceLog, includeTimestamp: boolean): JSX.Element {
	const signedDiff = (log.valueAfter - log.valueBefore) * (log.isSpend ? -1 : 1);
	const isHealth = log.resourceType == ResourceType.ResourceTypeHealth;
	const verb = isHealth ? (log.isSpend ? 'Lost' : 'Recovered') : log.isSpend ? 'Spent' : 'Gained';
	const resourceName =
		log.secondaryResourceType !== undefined ? SECONDARY_RESOURCES.get(log.secondaryResourceType)!.name : resourceNames.get(log.resourceType)!;
	const resourceClass = `resource-${resourceName.replace(/\s/g, '-').toLowerCase()}`;

	return (
		<>
			{Prefix(log, includeTimestamp)} {verb}{' '}
			<strong className={resourceClass}>
				{signedDiff.toFixed(1)} {resourceName}
			</strong>
			{` from `}
			{ActionLink(log.actionId!)}. ({log.valueBefore.toFixed(1)} &rarr; {log.valueAfter.toFixed(1)})
		</>
	);
}

function AuraLogElem(log: AuraLog, includeTimestamp: boolean): JSX.Element {
	return (
		<>
			{Prefix(log, includeTimestamp)}
			{`  Aura  `}
			{log.isGained ? 'gained' : log.isFaded ? 'faded' : 'refreshed'}: {ActionLink(log.actionId!, true)}.
		</>
	);
}

function AuraStacksLogElem(log: AuraStacksLog, includeTimestamp: boolean): JSX.Element {
	return (
		<>
			{Prefix(log, includeTimestamp)} {ActionLink(log.actionId!, true)} stacks: {log.oldStacks} &rarr; {log.newStacks}.
		</>
	);
}

function MajorCooldownLogElem(log: MajorCooldownLog, includeTimestamp: boolean): JSX.Element {
	return (
		<>
			{Prefix(log, includeTimestamp)} Major cooldown used: {ActionLink(log.actionId!)}.
		</>
	);
}

function CastBeganLogElem(log: CastBeganLog, includeTimestamp: boolean): JSX.Element {
	return (
		<>
			{Prefix(log, includeTimestamp)} Casting {ActionLink(log.actionId!)} (Cast time: {log.castTime.toFixed(2)}s, Cost: {log.manaCost.toFixed(1)} Mana).
		</>
	);
}

function CastCancelledLogElem(log: CastCancelledLog, includeTimestamp: boolean): JSX.Element {
	return (
		<>
			{Prefix(log, includeTimestamp)} Cancelled {ActionLink(log.actionId!)} after {log.cancelTime.toFixed(2)}s.
		</>
	);
}

function CastCompletedLogElem(log: CastCompletedLog, includeTimestamp: boolean): JSX.Element {
	return (
		<>
			{Prefix(log, includeTimestamp)} Completed cast {log.actionId!.name}.
		</>
	);
}

function StatChangeLogElem(log: StatChangeLog, includeTimestamp: boolean): JSX.Element {
	if (log.isGain) {
		return (
			<>
				{Prefix(log, includeTimestamp)} Gained {log.stats} from {ActionLink(log.actionId!)}.
			</>
		);
	}
	return (
		<>
			{Prefix(log, includeTimestamp)} Lost {log.stats} from fading {ActionLink(log.actionId!)}.
		</>
	);
}

function ResourceGroupLogElem(log: ResourceGroupLog, includeTimestamp: boolean): JSX.Element {
	return (
		<>
			{Prefix(log, includeTimestamp)} {resourceNames.get(log.resourceType)}: {log.valueBefore.toFixed(1)} &rarr; {log.valueAfter.toFixed(1)}
		</>
	);
}

function CastLogElem(log: CastLog, includeTimestamp: boolean): JSX.Element {
	return (
		<>
			{Prefix(log, includeTimestamp)} Casting {log.actionId!.name} (Cast time = {log.castTime.toFixed(2)}s).
		</>
	);
}

export function LogLineElem(log: CombatLog, includeTimestamp: boolean): JSX.Element {
	switch (log.kind) {
		case 'damage':
			return DamageLogElem(log, includeTimestamp);
		case 'resource':
			return ResourceLogElem(log, includeTimestamp);
		case 'aura':
			return AuraLogElem(log, includeTimestamp);
		case 'aura-stacks':
			return AuraStacksLogElem(log, includeTimestamp);
		case 'major-cooldown':
			return MajorCooldownLogElem(log, includeTimestamp);
		case 'cast-began':
			return CastBeganLogElem(log, includeTimestamp);
		case 'cast-cancelled':
			return CastCancelledLogElem(log, includeTimestamp);
		case 'cast-completed':
			return CastCompletedLogElem(log, includeTimestamp);
		case 'stat-change':
			return StatChangeLogElem(log, includeTimestamp);
		case 'resource-group':
			return ResourceGroupLogElem(log, includeTimestamp);
		case 'cast':
			return CastLogElem(log, includeTimestamp);
		case 'plain':
		case 'dps':
		case 'threat-group':
		case 'aura-uptime':
			return DefaultLogElem(log, includeTimestamp);
	}
}
