import clsx from 'clsx';

import i18n from '../../../../../../i18n/config';
import type { AuraUptimeLog, CastLog, DamageDealtLog } from '../../../../../proto_utils/logs_parser';
import { ResourceTooltip } from '../../tooltip_content';
import { addTooltip } from '../../tooltips';
import type { AuraItem, AuraStackSegment, CastItem, ContentRow, ResourceItem, RowItem, TickItem } from '../model';
import type { ItemRenderer } from '../row_track';

const setScalar = (elem: HTMLElement, name: string, value: number) => elem.style.setProperty(name, String(value));

const setSpan = (elem: HTMLElement, item: RowItem) => {
	setScalar(elem, '--t', item.start);
	setScalar(elem, '--dur', item.end - item.start);
};

const CastTooltip = (log: CastLog) => {
	const travelTime = log.travelTime == 0 ? '' : ` + ${log.travelTime.toFixed(2)}s travel time`;
	const totalDamage = log.totalDamage();
	return (
		<div className="timeline-tooltip">
			<span>
				{log.actionId!.name} from {log.timestamp.toFixed(2)}s to {(log.castCancelledLog?.timestamp || log.timestamp + log.castTime).toFixed(2)}s
				{log.castCancelledLog?.timestamp
					? ` (Cancelled after ${log.cancelTime.toFixed(2)}s)`
					: ` (${log.castTime > 0 ? `${log.castTime.toFixed(2)}s, ` : ''}${log.effectiveTime.toFixed(2)}s GCD Time)`}
				{travelTime.length > 0 && travelTime}
			</span>
			{totalDamage > 0 && (
				<span>
					Total: {totalDamage.toFixed(2)} ({(totalDamage / (log.effectiveTime || 1)).toFixed(2)} DPET)
				</span>
			)}
			{log.damageDealtLogs.length > 0 && (
				<ul className="rotation-item-damage-list">
					{log.damageDealtLogs.map(ddl => (
						<li>
							<span>
								{ddl.timestamp.toFixed(2)}s - {ddl.result()}
							</span>
							{ddl.source?.isTarget && (
								<span className="threat-metrics">
									{' '}
									({ddl.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')})
								</span>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

const TickTooltip = (log: DamageDealtLog) => (
	<div className="timeline-tooltip">
		<span>
			{log.timestamp.toFixed(2)}s - {log.actionId!.name} {log.result()}
		</span>
		{log.source?.isTarget && (
			<span className="threat-metrics">
				{' '}
				({log.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')})
			</span>
		)}
	</div>
);

const AuraTooltip = (log: AuraUptimeLog) => (
	<div className="timeline-tooltip">
		<span>
			{log.actionId!.name}: {log.gainedAt.toFixed(2)}s - {log.fadedAt.toFixed(2)}s
		</span>
	</div>
);

const AuraStackElem = ({ segment }: { segment: AuraStackSegment }) =>
	(
		<div className="rotation-item rotation-item-stacks" style={{ '--t': String(segment.offset), '--dur': String(segment.duration) }}>
			{String(segment.stacks)}
		</div>
	) as HTMLDivElement;

export const CastItemElem = ({ icon }: { icon: HTMLAnchorElement }) =>
	(
		<div className="rotation-item rotation-item-cast">
			<div className="rotation-item-travel" hidden={true} />
			{icon}
		</div>
	) as HTMLDivElement;

export const TickItemElem = () => (<div className="rotation-item rotation-item-tick" />) as HTMLDivElement;

export const AuraItemElem = () => (<div className="rotation-item rotation-item-aura" />) as HTMLDivElement;

export const ResourceItemElem = ({ cssName }: { cssName: string }) =>
	(
		<div className={clsx('rotation-item rotation-item-resource series-color', cssName)}>
			<div className={clsx('rotation-item-resource-fill', cssName)} hidden={true} />
			<span className="rotation-item-resource-text" />
		</div>
	) as HTMLDivElement;

export function applyCastItem(elem: HTMLElement, item: CastItem) {
	elem.className = clsx('rotation-item rotation-item-cast', `outcome-${item.outcome}`, item.cancelled && 'cast-cancelled');
	setSpan(elem, item);
	const travel = elem.firstElementChild as HTMLElement;
	travel.hidden = item.travelStart == null;
	if (item.travelStart != null) {
		setScalar(travel, '--t', item.travelStart);
		setScalar(travel, '--dur', item.travelDuration ?? 0);
	}
	addTooltip(elem, () => CastTooltip(item.log));
}

export function applyTickItem(elem: HTMLElement, item: TickItem) {
	setScalar(elem, '--t', item.start);
	addTooltip(elem, () => TickTooltip(item.log));
}

export function applyAuraItem(elem: HTMLElement, item: AuraItem) {
	elem.className = clsx('rotation-item rotation-item-aura', item.sharesRowWithCast && 'shares-row');
	setSpan(elem, item);
	elem.replaceChildren(...item.stacks.map(segment => AuraStackElem({ segment })));
	addTooltip(elem, () => AuraTooltip(item.log));
}

export function applyResourceItem(elem: HTMLElement, item: ResourceItem) {
	setSpan(elem, item);
	const fill = elem.firstElementChild as HTMLElement;
	fill.hidden = item.display !== 'fill';
	if (item.display === 'fill') setScalar(fill, '--fill', item.fillPercent);
	(elem.lastElementChild as HTMLElement).textContent = item.text;
	addTooltip(elem, () => ResourceTooltip(item.log, item.startValue, false));
}

export function createItemRenderer(row: ContentRow): ItemRenderer {
	// Every cast and tick in a row shares one action, so the icon is resolved once per row and
	// cloned per item instead of going through a process-wide element cache.
	let iconTemplate: HTMLAnchorElement | null = null;
	if (row.kind === 'cast') {
		iconTemplate = (<a className="rotation-item-icon" />) as HTMLAnchorElement;
		row.actionId.setBackground(iconTemplate);
	}

	const update = (elem: HTMLElement, item: RowItem) => {
		switch (item.kind) {
			case 'cast':
				applyCastItem(elem, item);
				break;
			case 'tick':
				applyTickItem(elem, item);
				break;
			case 'aura':
				applyAuraItem(elem, item);
				break;
			case 'resource':
				applyResourceItem(elem, item);
				break;
		}
	};

	const create = (item: RowItem): HTMLElement => {
		switch (item.kind) {
			case 'cast':
				return CastItemElem({ icon: iconTemplate!.cloneNode() as HTMLAnchorElement });
			case 'tick':
				return TickItemElem();
			case 'aura':
				return AuraItemElem();
			case 'resource':
				return ResourceItemElem({ cssName: row.kind === 'resource' ? row.cssName : '' });
		}
	};

	return {
		build(item) {
			const elem = create(item);
			update(elem, item);
			return elem;
		},
		update,
	};
}
