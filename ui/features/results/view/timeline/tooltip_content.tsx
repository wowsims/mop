/** @jsxImportSource @jsx-vanilla */
import { kebabCase } from '@domain/format';
import { DpsLog, ResourceChangedLogGroup, SimLog, ThreatLogGroup } from '@domain/proto_utils/logs';
import { resourceNames } from '@domain/proto_utils/names';
import i18n from '@i18n/config';

import { renderDamageResult } from '../log_lines';
import { percentageResources } from './constants';

export function DpsTooltip(log: DpsLog) {
	return (
		<div className="timeline-tooltip dps">
			<div className="timeline-tooltip-header">
				<span className="bold">{log.timestamp.toFixed(2)}s</span>
			</div>
			<div className="timeline-tooltip-body">
				<ul className="timeline-dps-events">{log.damageLogs.map(damageLog => TooltipLogItem(damageLog, renderDamageResult(damageLog)))}</ul>
				<div className="timeline-tooltip-body-row">
					<span className="series-color">
						{i18n.t('results_tab.details.timeline.tooltips.dps')}: {log.dps.toFixed(2)}
					</span>
				</div>
			</div>
			{TooltipAurasSection(log)}
		</div>
	);
}

export function ThreatTooltip(log: ThreatLogGroup) {
	return (
		<div className="timeline-tooltip threat">
			<div className="timeline-tooltip-header">
				<span className="bold">{log.timestamp.toFixed(2)}s</span>
			</div>
			<div className="timeline-tooltip-body">
				<div className="timeline-tooltip-body-row">
					<span className="series-color">
						{i18n.t('results_tab.details.timeline.tooltips.before')}: {log.threatBefore.toFixed(1)}
					</span>
				</div>
				<ul className="timeline-threat-events">
					{log.logs.map(log =>
						TooltipLogItem(
							log,
							<>
								{log.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')}
							</>,
						),
					)}
				</ul>
				<div className="timeline-tooltip-body-row">
					<span className="series-color">
						{i18n.t('results_tab.details.timeline.tooltips.after')}: {log.threatAfter.toFixed(1)}
					</span>
				</div>
			</div>
			{TooltipAurasSection(log)}
		</div>
	);
}

export function ResourceTooltip(log: ResourceChangedLogGroup, maxValue: number, includeAuras: boolean) {
	const valToDisplayString = percentageResources.includes(log.resourceType)
		? (val: number) => `${val.toFixed(1)} (${((val / maxValue) * 100).toFixed(0)}%)`
		: (val: number) => `${val.toFixed(1)}`;

	return (
		<div className={`timeline-tooltip ${kebabCase(resourceNames.get(log.resourceType)!)}`}>
			<div className="timeline-tooltip-header">
				<span className="bold">{log.timestamp.toFixed(2)}s</span>
			</div>
			<div className="timeline-tooltip-body">
				<div className="timeline-tooltip-body-row">
					<span className="series-color">
						{i18n.t('results_tab.details.timeline.tooltips.before')}: {valToDisplayString(log.valueBefore)}
					</span>
				</div>
				<ul className="timeline-mana-events">{log.logs.map(manaChangedLog => TooltipLogItem(manaChangedLog, <>{manaChangedLog.resultString()}</>))}</ul>
				<div className="timeline-tooltip-body-row">
					<span className="series-color">
						{i18n.t('results_tab.details.timeline.tooltips.after')}: {valToDisplayString(log.valueAfter)}
					</span>
				</div>
			</div>
			{includeAuras ? TooltipAurasSection(log) : null}
		</div>
	);
}

export function TooltipLogItem(log: SimLog, value: Element): JSX.Element {
	return (
		<li>
			{log.actionId && log.actionId.iconUrl && <img className="timeline-tooltip-icon" src={log.actionId.iconUrl}></img>}
			{log.actionId && <span>{log.actionId.name}</span>}
			<span className="series-color">{value}</span>
		</li>
	);
}

export function TooltipAurasSection(log: SimLog): JSX.Element | null {
	if (log.activeAuras.length == 0) {
		return null;
	}

	return (
		<div className="timeline-tooltip-auras">
			<div className="timeline-tooltip-body-row">
				<span className="bold">{i18n.t('results_tab.details.timeline.tooltips.active_auras')}</span>
			</div>
			<ul className="timeline-active-auras">
				{log.activeAuras.map(auraLog => (
					<li>
						{auraLog.actionId!.iconUrl && <img className="timeline-tooltip-icon" src={auraLog.actionId!.iconUrl}></img>}
						<span>{auraLog.actionId!.name}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
