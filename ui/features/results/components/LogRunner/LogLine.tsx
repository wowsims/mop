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
import { resourceClassName, resourceNames } from '@sim/proto/names';
import { SECONDARY_RESOURCES } from '@sim/proto/secondary_resource';
import type { ComponentType } from 'react';

import { DamageResult } from '../DamageResult';
import { EntityLabel } from '../EntityLabel';
import { ActionLink } from './ActionLink';

// One component per log kind. They stay in this file rather than taking one each: they are private
// one-expression renderers for a single discriminated union, and the file is their unit.
const SourcePrefix = ({ log }: { log: CombatLog }) => <>{log.source && <EntityLabel entity={log.source} />}</>;

const DefaultLine = ({ log }: { log: CombatLog }) => {
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

const DamageLine = ({ log }: { log: DamageLog }) => {
	const threatPostfix = log.source?.isTarget ? '' : ` (${log.threat.toFixed(2)} Threat)`;
	return (
		<>
			<SourcePrefix log={log} /> <ActionLink actionId={log.actionId!} /> <DamageResult log={log} />
			{threatPostfix}
		</>
	);
};

const ResourceLine = ({ log }: { log: ResourceLog }) => {
	const signedDiff = (log.valueAfter - log.valueBefore) * (log.isSpend ? -1 : 1);
	const isHealth = log.resourceType == ResourceType.ResourceTypeHealth;
	const verb = isHealth ? (log.isSpend ? 'Lost' : 'Recovered') : log.isSpend ? 'Spent' : 'Gained';
	const resourceName =
		log.secondaryResourceType !== undefined ? SECONDARY_RESOURCES.get(log.secondaryResourceType)!.name : resourceNames.get(log.resourceType)!;
	const resourceClass = resourceClassName(resourceName);

	return (
		<>
			<SourcePrefix log={log} /> {verb}{' '}
			<strong className={resourceClass}>
				{signedDiff.toFixed(1)} {resourceName}
			</strong>
			{` from `}
			<ActionLink actionId={log.actionId!} />. ({log.valueBefore.toFixed(1)} &rarr; {log.valueAfter.toFixed(1)})
		</>
	);
};

const AuraLine = ({ log }: { log: AuraLog }) => (
	<>
		<SourcePrefix log={log} />
		{`  Aura  `}
		{log.isGained ? 'gained' : log.isFaded ? 'faded' : 'refreshed'}: <ActionLink actionId={log.actionId!} isAura />.
	</>
);

const AuraStacksLine = ({ log }: { log: AuraStacksLog }) => (
	<>
		<SourcePrefix log={log} /> <ActionLink actionId={log.actionId!} isAura /> stacks: {log.oldStacks} &rarr; {log.newStacks}.
	</>
);

const MajorCooldownLine = ({ log }: { log: MajorCooldownLog }) => (
	<>
		<SourcePrefix log={log} /> Major cooldown used: <ActionLink actionId={log.actionId!} />.
	</>
);

const CastBeganLine = ({ log }: { log: CastBeganLog }) => (
	<>
		<SourcePrefix log={log} /> Casting <ActionLink actionId={log.actionId!} /> (Cast time: {log.castTime.toFixed(2)}s, Cost: {log.manaCost.toFixed(1)}{' '}
		Mana).
	</>
);

const CastCancelledLine = ({ log }: { log: CastCancelledLog }) => (
	<>
		<SourcePrefix log={log} /> Cancelled <ActionLink actionId={log.actionId!} /> after {log.cancelTime.toFixed(2)}s.
	</>
);

const CastCompletedLine = ({ log }: { log: CastCompletedLog }) => (
	<>
		<SourcePrefix log={log} /> Completed cast {log.actionId!.name}.
	</>
);

const StatChangeLine = ({ log }: { log: StatChangeLog }) =>
	log.isGain ? (
		<>
			<SourcePrefix log={log} /> Gained {log.stats} from <ActionLink actionId={log.actionId!} />.
		</>
	) : (
		<>
			<SourcePrefix log={log} /> Lost {log.stats} from fading <ActionLink actionId={log.actionId!} />.
		</>
	);

const ResourceGroupLine = ({ log }: { log: ResourceGroupLog }) => (
	<>
		<SourcePrefix log={log} /> {resourceNames.get(log.resourceType)}: {log.valueBefore.toFixed(1)} &rarr; {log.valueAfter.toFixed(1)}
	</>
);

const CastLine = ({ log }: { log: CastLog }) => (
	<>
		<SourcePrefix log={log} /> Casting {log.actionId!.name} (Cast time = {log.castTime.toFixed(2)}s).
	</>
);

export interface LogLineProps {
	log: CombatLog;
}

type LogOfKind<K extends CombatLog['kind']> = Extract<CombatLog, { kind: K }>;

// A mapped type rather than a switch: the compiler then requires an entry for every kind, where a
// switch only warns about a missing `return`.
const LINE_BY_KIND: { [K in CombatLog['kind']]: ComponentType<{ log: LogOfKind<K> }> } = {
	damage: DamageLine,
	resource: ResourceLine,
	aura: AuraLine,
	'aura-stacks': AuraStacksLine,
	'major-cooldown': MajorCooldownLine,
	'cast-began': CastBeganLine,
	'cast-cancelled': CastCancelledLine,
	'cast-completed': CastCompletedLine,
	'stat-change': StatChangeLine,
	'resource-group': ResourceGroupLine,
	cast: CastLine,
	plain: DefaultLine,
	dps: DefaultLine,
	'threat-group': DefaultLine,
	'aura-uptime': DefaultLine,
};

export const LogLine = ({ log }: LogLineProps) => {
	// TypeScript cannot correlate the looked-up component with the narrowed `log` — the correlated
	// union limitation — so the cast is here, once, and every component above keeps its narrow props.
	const Content = LINE_BY_KIND[log.kind] as ComponentType<LogLineProps>;
	return <Content log={log} />;
};
