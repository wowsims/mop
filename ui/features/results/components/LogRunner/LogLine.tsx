import { ResourceType } from '@generated/proto/spell';
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
} from '@sim/proto/combat_log';
import { matchTimestampPrefix } from '@sim/proto/combat_log';
import { resourceNames } from '@sim/proto/names';
import { SECONDARY_RESOURCES } from '@sim/proto/secondary_resource';
import type { ReactNode } from 'react';

import { ActionLink } from './ActionLink';
import { DamageResult } from './DamageResult';
import { EntityLabel } from './EntityLabel';

// One line per log kind, as plain functions rather than components: they are a `switch` over a
// discriminated union, and eleven one-expression components would be eleven files.
const prefix = (log: CombatLog): ReactNode => <>{log.source && <EntityLabel entity={log.source} />}</>;

const defaultLine = (log: CombatLog): ReactNode => {
	// Group 3 only: combat_log's own rawWithoutTimestamp keeps the entity bracket for plain-text
	// export, while this path drops it because EntityLabel supplies a styled replacement.
	const captureArr = matchTimestampPrefix(log.raw);
	const body = <>{captureArr ? captureArr[3] : log.raw}</>;
	if (!log.source) return body;
	return (
		<>
			<EntityLabel entity={log.source} /> {body}
		</>
	);
};

const damageLine = (log: DamageLog): ReactNode => {
	const threatPostfix = log.source?.isTarget ? '' : ` (${log.threat.toFixed(2)} Threat)`;
	return (
		<>
			{prefix(log)} <ActionLink actionId={log.actionId!} /> <DamageResult log={log} />
			{threatPostfix}
		</>
	);
};

const resourceLine = (log: ResourceLog): ReactNode => {
	const signedDiff = (log.valueAfter - log.valueBefore) * (log.isSpend ? -1 : 1);
	const isHealth = log.resourceType == ResourceType.ResourceTypeHealth;
	const verb = isHealth ? (log.isSpend ? 'Lost' : 'Recovered') : log.isSpend ? 'Spent' : 'Gained';
	const resourceName =
		log.secondaryResourceType !== undefined ? SECONDARY_RESOURCES.get(log.secondaryResourceType)!.name : resourceNames.get(log.resourceType)!;
	const resourceClass = `resource-${resourceName.replace(/\s/g, '-').toLowerCase()}`;

	return (
		<>
			{prefix(log)} {verb}{' '}
			<strong className={resourceClass}>
				{signedDiff.toFixed(1)} {resourceName}
			</strong>
			{` from `}
			<ActionLink actionId={log.actionId!} />. ({log.valueBefore.toFixed(1)} &rarr; {log.valueAfter.toFixed(1)})
		</>
	);
};

const auraLine = (log: AuraLog): ReactNode => (
	<>
		{prefix(log)}
		{`  Aura  `}
		{log.isGained ? 'gained' : log.isFaded ? 'faded' : 'refreshed'}: <ActionLink actionId={log.actionId!} isAura />.
	</>
);

const auraStacksLine = (log: AuraStacksLog): ReactNode => (
	<>
		{prefix(log)} <ActionLink actionId={log.actionId!} isAura /> stacks: {log.oldStacks} &rarr; {log.newStacks}.
	</>
);

const majorCooldownLine = (log: MajorCooldownLog): ReactNode => (
	<>
		{prefix(log)} Major cooldown used: <ActionLink actionId={log.actionId!} />.
	</>
);

const castBeganLine = (log: CastBeganLog): ReactNode => (
	<>
		{prefix(log)} Casting <ActionLink actionId={log.actionId!} /> (Cast time: {log.castTime.toFixed(2)}s, Cost: {log.manaCost.toFixed(1)} Mana).
	</>
);

const castCancelledLine = (log: CastCancelledLog): ReactNode => (
	<>
		{prefix(log)} Cancelled <ActionLink actionId={log.actionId!} /> after {log.cancelTime.toFixed(2)}s.
	</>
);

const castCompletedLine = (log: CastCompletedLog): ReactNode => (
	<>
		{prefix(log)} Completed cast {log.actionId!.name}.
	</>
);

const statChangeLine = (log: StatChangeLog): ReactNode =>
	log.isGain ? (
		<>
			{prefix(log)} Gained {log.stats} from <ActionLink actionId={log.actionId!} />.
		</>
	) : (
		<>
			{prefix(log)} Lost {log.stats} from fading <ActionLink actionId={log.actionId!} />.
		</>
	);

const resourceGroupLine = (log: ResourceGroupLog): ReactNode => (
	<>
		{prefix(log)} {resourceNames.get(log.resourceType)}: {log.valueBefore.toFixed(1)} &rarr; {log.valueAfter.toFixed(1)}
	</>
);

const castLine = (log: CastLog): ReactNode => (
	<>
		{prefix(log)} Casting {log.actionId!.name} (Cast time = {log.castTime.toFixed(2)}s).
	</>
);

export interface LogLineProps {
	log: CombatLog;
}

export const LogLine = ({ log }: LogLineProps) => {
	switch (log.kind) {
		case 'damage':
			return damageLine(log);
		case 'resource':
			return resourceLine(log);
		case 'aura':
			return auraLine(log);
		case 'aura-stacks':
			return auraStacksLine(log);
		case 'major-cooldown':
			return majorCooldownLine(log);
		case 'cast-began':
			return castBeganLine(log);
		case 'cast-cancelled':
			return castCancelledLine(log);
		case 'cast-completed':
			return castCompletedLine(log);
		case 'stat-change':
			return statChangeLine(log);
		case 'resource-group':
			return resourceGroupLine(log);
		case 'cast':
			return castLine(log);
		case 'plain':
		case 'dps':
		case 'threat-group':
		case 'aura-uptime':
			return defaultLine(log);
	}
};
