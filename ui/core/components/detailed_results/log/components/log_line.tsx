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

function Prefix(log: CombatLog): JSX.Element {
	return <>{log.source && EntityLabel(log.source)}</>;
}

function DefaultLogElem(log: CombatLog): JSX.Element {
	// Group 3 only: combat_log's own rawWithoutTimestamp keeps the entity bracket for plain-text
	// export, while this path drops it because EntityLabel supplies a styled replacement.
	const captureArr = matchTimestampPrefix(log.raw);
	let html: JSX.Element = <>{captureArr ? captureArr[3] : log.raw}</>;
	if (log.source) {
		html = (
			<>
				{EntityLabel(log.source)} {html}
			</>
		);
	}
	return html;
}

function DamageLogElem(log: DamageLog): JSX.Element {
	const threatPostfix = log.source?.isTarget ? '' : ` (${log.threat.toFixed(2)} Threat)`;
	return (
		<>
			{Prefix(log)} {ActionLink(log.actionId!)} {Results(log)}
			{threatPostfix}
		</>
	);
}

function ResourceLogElem(log: ResourceLog): JSX.Element {
	const signedDiff = (log.valueAfter - log.valueBefore) * (log.isSpend ? -1 : 1);
	const isHealth = log.resourceType == ResourceType.ResourceTypeHealth;
	const verb = isHealth ? (log.isSpend ? 'Lost' : 'Recovered') : log.isSpend ? 'Spent' : 'Gained';
	const resourceName =
		log.secondaryResourceType !== undefined ? SECONDARY_RESOURCES.get(log.secondaryResourceType)!.name : resourceNames.get(log.resourceType)!;
	const resourceClass = `resource-${resourceName.replace(/\s/g, '-').toLowerCase()}`;

	return (
		<>
			{Prefix(log)} {verb}{' '}
			<strong className={resourceClass}>
				{signedDiff.toFixed(1)} {resourceName}
			</strong>
			{` from `}
			{ActionLink(log.actionId!)}. ({log.valueBefore.toFixed(1)} &rarr; {log.valueAfter.toFixed(1)})
		</>
	);
}

function AuraLogElem(log: AuraLog): JSX.Element {
	return (
		<>
			{Prefix(log)}
			{`  Aura  `}
			{log.isGained ? 'gained' : log.isFaded ? 'faded' : 'refreshed'}: {ActionLink(log.actionId!, true)}.
		</>
	);
}

function AuraStacksLogElem(log: AuraStacksLog): JSX.Element {
	return (
		<>
			{Prefix(log)} {ActionLink(log.actionId!, true)} stacks: {log.oldStacks} &rarr; {log.newStacks}.
		</>
	);
}

function MajorCooldownLogElem(log: MajorCooldownLog): JSX.Element {
	return (
		<>
			{Prefix(log)} Major cooldown used: {ActionLink(log.actionId!)}.
		</>
	);
}

function CastBeganLogElem(log: CastBeganLog): JSX.Element {
	return (
		<>
			{Prefix(log)} Casting {ActionLink(log.actionId!)} (Cast time: {log.castTime.toFixed(2)}s, Cost: {log.manaCost.toFixed(1)} Mana).
		</>
	);
}

function CastCancelledLogElem(log: CastCancelledLog): JSX.Element {
	return (
		<>
			{Prefix(log)} Cancelled {ActionLink(log.actionId!)} after {log.cancelTime.toFixed(2)}s.
		</>
	);
}

function CastCompletedLogElem(log: CastCompletedLog): JSX.Element {
	return (
		<>
			{Prefix(log)} Completed cast {log.actionId!.name}.
		</>
	);
}

function StatChangeLogElem(log: StatChangeLog): JSX.Element {
	if (log.isGain) {
		return (
			<>
				{Prefix(log)} Gained {log.stats} from {ActionLink(log.actionId!)}.
			</>
		);
	}
	return (
		<>
			{Prefix(log)} Lost {log.stats} from fading {ActionLink(log.actionId!)}.
		</>
	);
}

function ResourceGroupLogElem(log: ResourceGroupLog): JSX.Element {
	return (
		<>
			{Prefix(log)} {resourceNames.get(log.resourceType)}: {log.valueBefore.toFixed(1)} &rarr; {log.valueAfter.toFixed(1)}
		</>
	);
}

function CastLogElem(log: CastLog): JSX.Element {
	return (
		<>
			{Prefix(log)} Casting {log.actionId!.name} (Cast time = {log.castTime.toFixed(2)}s).
		</>
	);
}

export function LogLineElem(log: CombatLog): JSX.Element {
	switch (log.kind) {
		case 'damage':
			return DamageLogElem(log);
		case 'resource':
			return ResourceLogElem(log);
		case 'aura':
			return AuraLogElem(log);
		case 'aura-stacks':
			return AuraStacksLogElem(log);
		case 'major-cooldown':
			return MajorCooldownLogElem(log);
		case 'cast-began':
			return CastBeganLogElem(log);
		case 'cast-cancelled':
			return CastCancelledLogElem(log);
		case 'cast-completed':
			return CastCompletedLogElem(log);
		case 'stat-change':
			return StatChangeLogElem(log);
		case 'resource-group':
			return ResourceGroupLogElem(log);
		case 'cast':
			return CastLogElem(log);
		case 'plain':
		case 'dps':
		case 'threat-group':
		case 'aura-uptime':
			return DefaultLogElem(log);
	}
}
