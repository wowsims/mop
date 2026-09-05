/** @jsxImportSource @jsx-vanilla */
// Rendering of one parsed combat log line. These were `toHTML()` / `result()`
// methods on the log classes; the classes are data now (ui/domain/proto_utils/logs.ts)
// and the JSX lives here.
import { CacheHandler } from '@domain/cache_handler';
import { setActionIdBackground, setActionIdWowheadDataset, setActionIdWowheadHref } from '@domain/proto_utils/action_id/dom';
import {
	AuraEventLog,
	AuraStacksChangeLog,
	CastBeganLog,
	CastCancelledLog,
	CastCompletedLog,
	CastLog,
	DamageDealtLog,
	Entity,
	MajorCooldownUsedLog,
	ResourceChangedLog,
	ResourceChangedLogGroup,
	SimLog,
	StatChangeLog,
} from '@domain/proto_utils/logs';
import { resourceNames, spellSchoolNames } from '@domain/proto_utils/names';
import { SECONDARY_RESOURCES } from '@domain/proto_utils/secondary_resource';
import { ResourceType } from '@generated/proto/spell';
import clsx from 'clsx';

const cachedActionIdLink = new CacheHandler<HTMLAnchorElement>();

export function renderEntity(entity: Entity) {
	if (entity.isTarget) {
		return <span className="text-danger">[Target {entity.index + 1}]</span>;
	} else if (entity.isPet) {
		return (
			<>
				<span className="text-primary">{`[${entity.ownerName} ${entity.index + 1}]`}</span>
				{` - `}
				{entity.name}
			</>
		);
	} else {
		return <span className="text-primary">{`[${entity.name} ${entity.index + 1}]`}</span>;
	}
}

function logPrefix(log: SimLog, includeTimestamp = true) {
	let prefix = '';
	if (includeTimestamp) {
		prefix = `[${log.timestamp.toFixed(2)}]`;
	}

	return (
		<>
			{prefix}
			{log.source ? renderEntity(log.source) : undefined}
		</>
	);
}

function newActionIdLink(log: SimLog, isAura?: boolean) {
	const cacheKey = log.actionIdAsString ? `${log.actionIdAsString}${isAura || ''}` : undefined;
	const cachedLink = cacheKey ? cachedActionIdLink.get(cacheKey) : null;
	if (cachedLink) return cachedLink.cloneNode(true);

	const iconElem = (<span className="icon icon-sm"></span>) as HTMLSpanElement;
	const actionAnchor = (
		<a className="log-action" target="_blank">
			<span>
				{iconElem} {log.actionId!.name}
			</span>
		</a>
	) as HTMLAnchorElement;
	if (log.actionId) {
		setActionIdBackground(log.actionId, iconElem);
		setActionIdWowheadHref(log.actionId, actionAnchor);
		setActionIdWowheadDataset(log.actionId, actionAnchor, { useBuffAura: isAura });
	}
	if (cacheKey) cachedActionIdLink.set(cacheKey, actionAnchor.cloneNode(true) as HTMLAnchorElement);
	return actionAnchor;
}

// Was DamageDealtLog.result().
export function renderDamageResult(log: DamageDealtLog) {
	const spellSchoolString = typeof log.spellSchool === 'number' ? spellSchoolNames.get(log.spellSchool) : undefined;
	return (
		<>
			{log.isHealing() ? `Healed ` : ''}
			{log.isShielding() ? `Shielded ` : ''}
			{!(log.isHealing() || log.isShielding()) && (
				<>
					{log.miss
						? 'Miss'
						: log.dodge
							? 'Dodge'
							: log.parry
								? 'Parry'
								: log.block
									? log.crit
										? 'Critical Block'
										: log.glance
											? 'Blocked Glance'
											: 'Block'
									: log.glance
										? 'Glance'
										: log.crit
											? 'Crit'
											: log.crush
												? 'Crush'
												: log.tick
													? 'Tick'
													: 'Hit'}
				</>
			)}
			{` `}
			{(log.target ? renderEntity(log.target) : undefined) || ''}
			{!log.miss && !log.dodge && !log.parry ? (
				<>
					{' '}
					for{' '}
					{log.isHealing() || log.isShielding() ? (
						<strong className={clsx('resource-health')}>{log.amount.toFixed(2)} health</strong>
					) : (
						<strong className={clsx('text-danger', spellSchoolString && `spell-school-${spellSchoolString.toLowerCase()}`)}>
							{log.amount.toFixed(2)} damage
							{spellSchoolString && <> ({spellSchoolString})</>}
						</strong>
					)}
					{log.partialResist1_4 ? <> (10% Resist)</> : log.partialResist2_4 ? <> (20% Resist)</> : log.partialResist3_4 ? <> (30% Resist)</> : ''}.
				</>
			) : (
				''
			)}
		</>
	);
}

function renderBaseLog(log: SimLog, includeTimestamp: boolean) {
	let html = <>{log.raw}</>;
	// Base logs already have the timestamp appended by default
	if (!includeTimestamp) {
		const regexp = /(\[[0-9.-]+\]) (\[[0-9a-zA-Z\s\-()#]+\])?(.*)/;
		if (log.raw.match(regexp)) {
			// TypeScript doesn't handle regex capture typing well
			const captureArr = regexp.exec(log.raw);

			if (captureArr && captureArr.length == 4) {
				html = <>{captureArr[3]}</>;
			}
		}
	}

	if (log.source) {
		html = (
			<>
				{renderEntity(log.source)} {html}
			</>
		);
	}
	return html;
}

// Was SimLog.toHTML() and each subclass's override.
export function renderLog(log: SimLog, includeTimestamp = true): Element {
	if (log instanceof DamageDealtLog) {
		const threatPostfix = log.source?.isTarget ? '' : ` (${log.threat.toFixed(2)} Threat)`;
		return (
			<>
				{logPrefix(log, includeTimestamp)} {newActionIdLink(log)} {renderDamageResult(log)}
				{threatPostfix}
			</>
		);
	}
	if (log instanceof AuraEventLog) {
		return (
			<>
				{logPrefix(log, includeTimestamp)}
				{`  Aura  `}
				{log.isGained ? 'gained' : log.isFaded ? 'faded' : 'refreshed'}: {newActionIdLink(log, true)}.
			</>
		);
	}
	if (log instanceof AuraStacksChangeLog) {
		return (
			<>
				{logPrefix(log, includeTimestamp)} {newActionIdLink(log, true)} stacks: {log.oldStacks} &rarr; {log.newStacks}.
			</>
		);
	}
	if (log instanceof ResourceChangedLog) {
		const signedDiff = (log.valueAfter - log.valueBefore) * (log.isSpend ? -1 : 1);
		const isHealth = log.resourceType == ResourceType.ResourceTypeHealth;
		const verb = isHealth ? (log.isSpend ? 'Lost' : 'Recovered') : log.isSpend ? 'Spent' : 'Gained';
		const resourceName =
			log.secondaryResourceType !== undefined ? SECONDARY_RESOURCES.get(log.secondaryResourceType)!.name : resourceNames.get(log.resourceType)!;
		const resourceClass = `resource-${resourceName.replace(/\s/g, '-').toLowerCase()}`;

		return (
			<>
				{logPrefix(log, includeTimestamp)} {verb}{' '}
				<strong className={resourceClass}>
					{signedDiff.toFixed(1)} {resourceName}
				</strong>
				{` from `}
				{newActionIdLink(log)}. ({log.valueBefore.toFixed(1)} &rarr; {log.valueAfter.toFixed(1)})
			</>
		);
	}
	if (log instanceof ResourceChangedLogGroup) {
		return (
			<>
				{logPrefix(log, includeTimestamp)} {resourceNames.get(log.resourceType)}: {log.valueBefore.toFixed(1)} &rarr; {log.valueAfter.toFixed(1)}
			</>
		);
	}
	if (log instanceof MajorCooldownUsedLog) {
		return (
			<>
				{logPrefix(log, includeTimestamp)} Major cooldown used: {newActionIdLink(log)}.
			</>
		);
	}
	if (log instanceof CastBeganLog) {
		return (
			<>
				{logPrefix(log, includeTimestamp)} Casting {newActionIdLink(log)} (Cast time: {log.castTime.toFixed(2)}s, Cost: {log.manaCost.toFixed(1)} Mana).
			</>
		);
	}
	if (log instanceof CastCancelledLog) {
		return (
			<>
				{logPrefix(log, includeTimestamp)} Cancelled {newActionIdLink(log)} after {log.cancelTime.toFixed(2)}s.
			</>
		);
	}
	if (log instanceof CastCompletedLog) {
		return (
			<>
				{logPrefix(log, includeTimestamp)} Completed cast {log.actionId!.name}.
			</>
		);
	}
	if (log instanceof CastLog) {
		return (
			<>
				{logPrefix(log, includeTimestamp)} Casting {log.actionId!.name} (Cast time = {log.castTime.toFixed(2)}s).
			</>
		);
	}
	if (log instanceof StatChangeLog) {
		if (log.isGain) {
			return (
				<>
					{logPrefix(log, includeTimestamp)} Gained {log.stats} from {newActionIdLink(log)}.
				</>
			);
		} else {
			return (
				<>
					{logPrefix(log, includeTimestamp)} Lost {log.stats} from fading {newActionIdLink(log)}.
				</>
			);
		}
	}
	return renderBaseLog(log, includeTimestamp);
}
